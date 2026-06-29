const { google } = require('googleapis');
const path = require('path');

const ID       = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

// [row index in sheet, 분류명, 항목명]
const CATEGORIES = [
  [44, '여행예금',   '여행예금'],
  [46, '가족경조사비', '가족 경조사비'],
  [54, '병원비',    '우리집 병원비'],
  [55, '경조사',    '지인 축의.부조'],
  [56, '차량관리',   '차량관리'],
  [57, '파킹통장',   '파킹통장'],
];

// 한 줄에서 { item, amount } 파싱
function parseLine(line) {
  const l = line.trim();
  if (!l) return null;
  // "항목 -금액" or "항목 +금액" — 마지막 부호+숫자 추출
  const m = l.match(/^(.*?)\s+([+-])\s*([\d,]+)\s*(\([^)]*\))?\s*$/);
  if (!m) return null;
  const amount = parseInt(m[3].replace(/,/g, '')) * (m[2] === '+' ? 1 : -1);
  const item = m[1].replace(/\t/g, '').trim();
  if (!item) return null;
  return { item, amount };
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 2026 탭에서 현재 값 + 노트 읽기 ─────────────────────────
  console.log('2026 탭 데이터 읽는 중...');
  const rowNums = CATEGORIES.map(([r]) => r);
  const minRow = Math.min(...rowNums);
  const maxRow = Math.max(...rowNums);

  const resp = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'2026'!F${minRow}:Q${maxRow}`],
    includeGridData: true,
  });

  const gridRows = resp.data.sheets[0].data[0].rowData || [];
  // gridRows[i] corresponds to sheet row minRow + i
  // Map: sheetRow -> rowData
  const rowDataMap = {};
  gridRows.forEach((rd, i) => {
    rowDataMap[minRow + i] = rd;
  });

  // ── 2. 엔트리 수집 ──────────────────────────────────────────────
  const allEntries = []; // [날짜, 월, 항목, 금액, 분류, 메모]

  for (const [sheetRow, cat, label] of CATEGORIES) {
    const rd = rowDataMap[sheetRow];
    if (!rd || !rd.values) continue;

    for (let colIdx = 0; colIdx < 12; colIdx++) {
      const month = colIdx + 1;
      const cell = rd.values[colIdx] || {};
      const note = cell.note || '';
      const rawVal = cell.effectiveValue;
      const cellValue = rawVal ? (rawVal.numberValue || 0) : 0;

      if (note.trim()) {
        // 노트가 있으면 라인별 파싱
        const parsed = note.split('\n')
          .map(l => parseLine(l))
          .filter(Boolean)
          .map(({ item, amount }) => [
            `2026-${String(month).padStart(2, '0')}-01`,
            month, item, amount, cat, ''
          ]);

        if (parsed.length > 0) {
          allEntries.push(...parsed);
        } else if (cellValue !== 0) {
          // 파싱 실패 시 원본 노트를 메모로 보존
          allEntries.push([
            `2026-${String(month).padStart(2, '0')}-01`,
            month, label, Math.round(cellValue), cat, note.replace(/\n/g, ' | ')
          ]);
        }
      } else if (cellValue !== 0) {
        // 노트 없이 값만 있는 경우 → 단순 집계 엔트리
        allEntries.push([
          `2026-${String(month).padStart(2, '0')}-01`,
          month, label, Math.round(cellValue), cat, ''
        ]);
      }
    }
  }

  console.log(`✓ 엔트리 수집 완료: ${allEntries.length}개`);
  allEntries.forEach(e => console.log(`  ${e[4]} ${e[1]}월: ${e[2]} ${e[3].toLocaleString()}`));

  // ── 3. 게릴라지출 탭 생성 ────────────────────────────────────────
  const addSheet = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: '게릴라지출',
            gridProperties: { rowCount: 500, columnCount: 7 },
          },
        },
      }],
    },
  });
  const GUERRILLA_ID = addSheet.data.replies[0].addSheet.properties.sheetId;
  console.log('✓ 게릴라지출 탭 생성 (sheetId:', GUERRILLA_ID, ')');

  // ── 4. 헤더 + 데이터 입력 ──────────────────────────────────────
  const header = [['날짜', '월', '항목', '금액', '분류', '메모']];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '게릴라지출!A1:F1', values: header },
        ...(allEntries.length > 0 ? [{
          range: `게릴라지출!A2:F${allEntries.length + 1}`,
          values: allEntries,
        }] : []),
      ],
    },
  });
  console.log('✓ 데이터 입력');

  // ── 5. 스타일 + 드롭다운 ────────────────────────────────────────
  const CAT_NAMES = CATEGORIES.map(([, c]) => c);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [
        // 헤더 볼드 + 연녹색 배경
        {
          repeatCell: {
            range: { sheetId: GUERRILLA_ID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
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
            range: { sheetId: GUERRILLA_ID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 3, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // B열 월 센터
        {
          repeatCell: {
            range: { sheetId: GUERRILLA_ID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 1, endColumnIndex: 2 },
            cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
            fields: 'userEnteredFormat.horizontalAlignment',
          },
        },
        // E열 분류 드롭다운
        {
          setDataValidation: {
            range: { sheetId: GUERRILLA_ID, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 4, endColumnIndex: 5 },
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
        // 열 너비
        ...[110, 40, 200, 100, 100, 250].map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId: GUERRILLA_ID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        // 헤더 고정
        {
          updateSheetProperties: {
            properties: { sheetId: GUERRILLA_ID, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  });
  console.log('✓ 스타일 적용');

  // ── 6. 2026 탭 SUMIFS 수식 삽입 ────────────────────────────────
  const formulaData = [];
  for (const [sheetRow, cat] of CATEGORIES) {
    for (let m = 1; m <= 12; m++) {
      const col = String.fromCharCode(64 + 5 + m); // F=1, G=2 … Q=12
      formulaData.push({
        range: `'2026'!${col}${sheetRow}`,
        values: [[`=SUMIFS(게릴라지출!D:D,게릴라지출!B:B,${m},게릴라지출!E:E,"${cat}")`]],
      });
    }
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: formulaData },
  });
  console.log('✓ 2026 탭 SUMIFS 연결');

  // ── 7. 2026 탭 기존 노트 삭제 ──────────────────────────────────
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: CATEGORIES.map(([sheetRow]) => ({
        updateCells: {
          range: {
            sheetId: SHEET_2026_ID,
            startRowIndex: sheetRow - 1,
            endRowIndex: sheetRow,
            startColumnIndex: 5,   // F
            endColumnIndex: 17,    // Q (inclusive end = 17)
          },
          rows: [{ values: Array(12).fill({ note: '' }) }],
          fields: 'note',
        },
      })),
    },
  });
  console.log('✓ 2026 탭 기존 노트 삭제');

  console.log('\n─── 완료 ───');
  console.log(`게릴라지출 탭: ${allEntries.length}행 생성`);
  console.log(`2026 탭: ${CATEGORIES.length}개 항목 × 12개월 = ${CATEGORIES.length * 12}개 SUMIFS 수식`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
