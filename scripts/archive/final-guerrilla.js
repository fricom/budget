const { google } = require('googleapis');
const path = require('path');

const ID            = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE      = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

// 2026 탭 행번호 → 분류명
const ROW_CATS = [
  [44, '여행예금'],
  [46, '가족경조사비'],
  [54, '병원비'],
  [55, '경조사'],
  [56, '차량관리'],
  [57, '파킹통장'],
];
const CAT_NAMES = ROW_CATS.map(([, c]) => c);

// ── 레이아웃 상수 ────────────────────────────────────────────────
// 각 월 블록: 월 헤더(1) + 컬럼 헤더(1) + 데이터(30) + 합계(1) + 스페이서(2) = 35행
const BLOCK = 35;
const DATA_ROWS = 30;
// 월 m(1-indexed)의 시작 행(1-indexed)
const blockStart = m => 2 + (m - 1) * BLOCK;
const dataStart  = m => blockStart(m) + 2;  // 데이터 첫 행
const dataEnd    = m => dataStart(m) + DATA_ROWS - 1;
const sumRow     = m => dataEnd(m) + 1;

// 컬럼: A=날짜, B=분류, C=항목, D=금액, E=메모
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// 색상 헬퍼
const rgb = (r, g, b) => ({ red: r/255, green: g/255, blue: b/255 });

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 기존 데이터 읽기 (현재 구조: A=날짜, B=월, C=분류, D=금액, E=메모/항목) ──
  console.log('기존 데이터 읽는 중...');
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: '게릴라지출!A2:E',
  });
  const oldRows = (existing.data.values || []).filter(r => r[0] && r[0] !== '');

  // 월별 그룹핑 [month(1-12)] → [{date, cat, item, amount, memo}]
  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = [];

  for (const r of oldRows) {
    const dateStr = r[0] || '';
    // "2026-MM-DD" 형식에서 월 추출
    const monthMatch = dateStr.match(/2026-(\d{2})-/);
    if (!monthMatch) continue;
    const month = parseInt(monthMatch[1]);
    if (month < 1 || month > 12) continue;

    byMonth[month].push({
      date:   dateStr.replace(/-/g, '.'),  // "2026.MM.DD" 형식으로 변환
      cat:    r[2] || '',   // 분류 (old C)
      item:   r[4] || '',   // 항목 = old 메모(E, 세부항목명)
      amount: r[3] || '',   // 금액 (old D)
      memo:   '',
    });
  }
  console.log(`✓ 기존 데이터: ${oldRows.length}행`);

  // ── 2. 기존 탭 삭제 + 새 탭 생성 ────────────────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const oldSheet = meta.data.sheets.find(s => s.properties.title === '게릴라지출');
  if (oldSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: oldSheet.properties.sheetId } }] },
    });
    console.log('✓ 기존 탭 삭제');
  }

  const totalRows = 2 + 12 * BLOCK + 10;
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: '게릴라지출',
            gridProperties: { rowCount: totalRows, columnCount: 5 },
          },
        },
      }],
    },
  });
  const GID = addRes.data.replies[0].addSheet.properties.sheetId;
  console.log('✓ 새 탭 생성 (sheetId:', GID, ')');

  // ── 3. 값 채우기 ─────────────────────────────────────────────────
  const valueData = [];

  for (let m = 1; m <= 12; m++) {
    const bs = blockStart(m);
    const ds = dataStart(m);
    const de = dataEnd(m);
    const sr = sumRow(m);

    // 월 헤더
    valueData.push({ range: `게릴라지출!A${bs}`, values: [[MONTH_NAMES[m-1]]] });
    // 컬럼 헤더
    valueData.push({ range: `게릴라지출!A${bs+1}:E${bs+1}`, values: [['날짜','분류','항목','금액','메모']] });
    // 합계 수식
    valueData.push({
      range: `게릴라지출!A${sr}:D${sr}`,
      values: [['합계', '', '', `=SUM(D${ds}:D${de})`]],
    });

    // 데이터 행 (최대 DATA_ROWS)
    const entries = byMonth[m].slice(0, DATA_ROWS);
    if (entries.length > 0) {
      valueData.push({
        range: `게릴라지출!A${ds}:E${ds + entries.length - 1}`,
        values: entries.map(e => [e.date, e.cat, e.item, e.amount, e.memo]),
      });
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
  });
  console.log('✓ 값 입력 완료');

  // ── 4. 포맷 요청 수집 ────────────────────────────────────────────
  const requests = [];

  // 열 너비: A=110, B=100, C=180, D=100, E=200
  [110, 100, 180, 100, 200].forEach((px, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px }, fields: 'pixelSize',
      },
    });
  });

  // 1행 고정
  requests.push({
    updateSheetProperties: {
      properties: { sheetId: GID, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  for (let m = 1; m <= 12; m++) {
    const bs  = blockStart(m) - 1;  // 0-indexed
    const chs = bs + 1;              // 컬럼 헤더 행
    const ds  = bs + 2;              // 데이터 시작
    const de  = ds + DATA_ROWS;      // 데이터 끝 (exclusive)
    const sr  = de;                  // 합계 행

    // 월 헤더: 배경 진녹색 + 흰 굵은 글씨 + 5개 셀 병합
    requests.push({
      mergeCells: {
        range: { sheetId: GID, startRowIndex: bs, endRowIndex: bs+1, startColumnIndex: 0, endColumnIndex: 5 },
        mergeType: 'MERGE_ALL',
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: bs, endRowIndex: bs+1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(84, 130, 53),
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red:1,green:1,blue:1 } },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
            padding: { left: 8 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
      },
    });

    // 컬럼 헤더: 연녹색 배경 + 굵은 글씨 + 가운데 정렬
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: chs, endRowIndex: chs+1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(198, 224, 180),
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 데이터 영역: D열 금액 우측 정렬 + 통화 포맷
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: ds, endRowIndex: de, startColumnIndex: 3, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // 합계 행: 연한 노란 배경 + 굵은 글씨
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: sr, endRowIndex: sr+1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(255, 242, 204),
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    // 합계 D열도 통화 포맷
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: sr, endRowIndex: sr+1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // 데이터 영역 전체 아웃라인 보더
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: bs, endRowIndex: sr+1, startColumnIndex: 0, endColumnIndex: 5 },
        top:    { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        bottom: { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        left:   { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        right:  { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
      },
    });
    // 데이터 행 안쪽 얇은 가로선
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: ds, endRowIndex: sr, startColumnIndex: 0, endColumnIndex: 5 },
        innerHorizontal: { style: 'SOLID', color: rgb(217,217,217) },
        innerVertical:   { style: 'SOLID', color: rgb(217,217,217) },
      },
    });

    // B열 분류 드롭다운 (데이터 행)
    requests.push({
      setDataValidation: {
        range: { sheetId: GID, startRowIndex: ds, endRowIndex: de, startColumnIndex: 1, endColumnIndex: 2 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: CAT_NAMES.map(c => ({ userEnteredValue: c })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: { requests },
  });
  console.log('✓ 포맷 적용');

  // ── 5. 2026 탭 SUMIFS → 월별 행범위 기반으로 업데이트 ──────────
  const formulaData = [];
  for (const [sheetRow, cat] of ROW_CATS) {
    for (let m = 1; m <= 12; m++) {
      const ds = dataStart(m);
      const de = dataEnd(m);
      const col = String.fromCharCode(64 + 5 + m); // F=1월 … Q=12월
      formulaData.push({
        range: `'2026'!${col}${sheetRow}`,
        values: [[`=SUMIFS('게릴라지출'!D${ds}:D${de},'게릴라지출'!B${ds}:B${de},"${cat}")`]],
      });
    }
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: formulaData },
  });
  console.log('✓ 2026 탭 SUMIFS 업데이트');

  // 이전 항목별 합계 확인
  let totalEntries = 0;
  for (let m = 1; m <= 12; m++) totalEntries += byMonth[m].length;

  console.log('\n─── 완료 ───');
  console.log(`게릴라지출 탭: 1월~12월 블록 레이아웃`);
  console.log(`마이그레이션: ${totalEntries}행`);
  console.log(`2026 탭: SUMIFS 행범위 기반 (D${dataStart(1)}:D${dataEnd(1)} ... D${dataStart(12)}:D${dataEnd(12)})`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
