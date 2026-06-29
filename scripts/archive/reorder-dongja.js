const { google } = require('googleapis');
const path = require('path');
const ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

// 새 순서: 병원비/차량관리/여행비/가족경조사/지인경조사/비상금
// 현재:    여행비(52)/가족경조사(53)/병원비(54)/지인경조사(55)/차량관리(56)/비상금(57)
const NEW_ORDER = ['병원비', '차량관리', '여행비', '가족경조사', '지인경조사', '비상금'];
const START_ROW = 52; // 1-indexed

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // E~S (15열) 읽기
  const r = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'2026'!E${START_ROW}:S${START_ROW + 5}`],
    includeGridData: true,
  });
  const rows = r.data.sheets[0].data[0].rowData || [];

  // 항목별 데이터 맵 (E열 항목명 → 셀 배열)
  const dataMap = {};
  rows.forEach((row, i) => {
    const cells = row.values || [];
    const label = cells[0]?.effectiveValue?.stringValue || '';
    if (label) dataMap[label] = cells;
  });

  console.log('읽은 항목:', Object.keys(dataMap).join(', '));

  const requests = [];

  NEW_ORDER.forEach((name, i) => {
    const newRow = START_ROW + i; // 1-indexed
    const cells = dataMap[name];
    if (!cells) { console.warn(`'${name}' 데이터 없음`); return; }

    // E열: 항목명
    const rowValues = [{ userEnteredValue: { stringValue: name } }];

    // F~Q열 (index 1~12): SUMIFS 수식 그대로
    for (let j = 1; j <= 12; j++) {
      const uv = cells[j]?.userEnteredValue;
      rowValues.push(uv ? { userEnteredValue: { ...uv } } : {});
    }

    // R열 (index 13): 새 행 번호로 업데이트
    rowValues.push({ userEnteredValue: { formulaValue: `=SUM(F${newRow}:Q${newRow})+S${newRow}` } });

    // S열 (index 14): 2025 참조 그대로
    const sUv = cells[14]?.userEnteredValue;
    rowValues.push(sUv ? { userEnteredValue: { ...sUv } } : {});

    requests.push({
      updateCells: {
        range: {
          sheetId: SHEET_2026_ID,
          startRowIndex: newRow - 1,
          endRowIndex: newRow,
          startColumnIndex: 4,   // E
          endColumnIndex: 19,    // S+1
        },
        rows: [{ values: rowValues }],
        fields: 'userEnteredValue',
      },
    });

    console.log(`R${newRow} ← ${name} (S열: ${cells[14]?.userEnteredValue?.formulaValue || ''})`);
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });
  console.log('✓ 순서 변경 완료');
}

main().catch(e => console.error(e.message));
