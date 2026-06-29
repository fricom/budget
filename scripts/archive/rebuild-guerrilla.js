const { google } = require('googleapis');
const path = require('path');

const ID            = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE      = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

// 2026 탭 행번호 → 분류명 매핑
const CATEGORIES = [
  [44, '여행예금'],
  [46, '가족경조사비'],
  [54, '병원비'],
  [55, '경조사'],
  [56, '차량관리'],
  [57, '파킹통장'],
];

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 기존 게릴라지출 탭 데이터 읽기 ────────────────────────
  console.log('기존 게릴라지출 데이터 읽는 중...');
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: '게릴라지출!A2:F',
  });
  const oldRows = (existing.data.values || []).filter(r => r[0]); // 날짜 있는 행만

  // 구조 변환: [날짜(A), 월(B), 항목-세부(C), 금액(D), 분류(E), 메모(F)]
  //         → [날짜(A), 항목=구분류(C=E), 금액(D), 메모=구항목(E=C)]
  const migratedRows = oldRows.map(r => [
    r[0] || '',       // A: 날짜
    r[4] || '',       // C: 항목 (← 구 분류)
    r[3] || '',       // D: 금액
    r[2] || '',       // E: 메모 (← 구 항목/세부명)
  ]);
  console.log(`✓ 기존 데이터: ${migratedRows.length}행`);

  // ── 2. 기존 탭 삭제 ────────────────────────────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const oldSheet = meta.data.sheets.find(s => s.properties.title === '게릴라지출');
  if (oldSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: oldSheet.properties.sheetId } }] },
    });
    console.log('✓ 기존 게릴라지출 탭 삭제');
  }

  // ── 3. 새 탭 생성 ─────────────────────────────────────────────
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: '게릴라지출',
            gridProperties: { rowCount: 500, columnCount: 5 },
          },
        },
      }],
    },
  });
  const GID = addRes.data.replies[0].addSheet.properties.sheetId;
  console.log('✓ 새 게릴라지출 탭 생성 (sheetId:', GID, ')');

  // ── 4. 헤더 + 월 자동 수식 + 데이터 ─────────────────────────
  // 컬럼: A=날짜, B=월(자동), C=항목, D=금액, E=메모
  const writeData = [
    // 헤더
    { range: '게릴라지출!A1:E1', values: [['날짜', '월', '항목', '금액', '메모']] },
    // B2: ARRAYFORMULA로 전체 월 자동 계산
    { range: '게릴라지출!B2', values: [['=ARRAYFORMULA(IFERROR(MONTH(A2:A500),\"\"))']] },
  ];

  if (migratedRows.length > 0) {
    // A열 날짜
    writeData.push({ range: `게릴라지출!A2:A${migratedRows.length + 1}`, values: migratedRows.map(r => [r[0]]) });
    // C열 항목
    writeData.push({ range: `게릴라지출!C2:C${migratedRows.length + 1}`, values: migratedRows.map(r => [r[1]]) });
    // D열 금액
    writeData.push({ range: `게릴라지출!D2:D${migratedRows.length + 1}`, values: migratedRows.map(r => [r[2]]) });
    // E열 메모
    writeData.push({ range: `게릴라지출!E2:E${migratedRows.length + 1}`, values: migratedRows.map(r => [r[3]]) });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: writeData },
  });
  console.log('✓ 헤더 + 데이터 입력');

  // ── 5. 스타일 + 드롭다운 ─────────────────────────────────────
  const CAT_NAMES = CATEGORIES.map(([, c]) => c);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [
        // 헤더 볼드 + 배경
        {
          repeatCell: {
            range: { sheetId: GID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.851, green: 0.918, blue: 0.827 },
                textFormat: { bold: true },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        // D열 통화 포맷
        {
          repeatCell: {
            range: { sheetId: GID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 3, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // B열 월 숫자 센터 + 연한 회색
        {
          repeatCell: {
            range: { sheetId: GID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 1, endColumnIndex: 2 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                backgroundColor: { red: 0.96, green: 0.96, blue: 0.96 },
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,backgroundColor)',
          },
        },
        // C열 항목 드롭다운
        {
          setDataValidation: {
            range: { sheetId: GID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 2, endColumnIndex: 3 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: CAT_NAMES.map(c => ({ userEnteredValue: c })),
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        // 열 너비: A=110, B=40, C=120, D=100, E=250
        ...[110, 40, 120, 100, 250].map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        // 헤더 고정
        {
          updateSheetProperties: {
            properties: { sheetId: GID, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  });
  console.log('✓ 스타일 적용');

  // ── 6. 2026 탭 SUMIFS 수식 업데이트 (E:E → C:C, D:D 동일) ──
  // 새 구조: 월=B, 항목=C, 금액=D
  const formulaData = [];
  for (const [sheetRow, cat] of CATEGORIES) {
    for (let m = 1; m <= 12; m++) {
      const col = String.fromCharCode(64 + 5 + m); // F=1 … Q=12
      formulaData.push({
        range: `'2026'!${col}${sheetRow}`,
        values: [[`=SUMIFS(게릴라지출!D:D,게릴라지출!B:B,${m},게릴라지출!C:C,"${cat}")`]],
      });
    }
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: formulaData },
  });
  console.log('✓ 2026 탭 SUMIFS 업데이트 (C열 항목 기준)');

  console.log('\n─── 완료 ───');
  console.log(`구조: 날짜(A) | 월(B, 자동) | 항목(C, 드롭다운) | 금액(D) | 메모(E)`);
  console.log(`마이그레이션: ${migratedRows.length}행`);
  console.log(`2026 탭: SUMIFS → 게릴라지출!C열(항목) 기준으로 업데이트`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
