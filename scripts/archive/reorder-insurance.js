const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 1862606876;

  // 1. Read current insurance items R15:R25 (11 items, excl. 합계)
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: ['년 단위 가계세팅!C15:R25'],
  });
  const rows = res.data.sheets[0].data[0].rowData || [];

  function getVal(cell) {
    if (!cell || !cell.userEnteredValue) return '';
    const v = cell.userEnteredValue;
    if (v.numberValue !== undefined) return v.numberValue;
    return v.stringValue || v.formulaValue || '';
  }
  function extract(row) {
    const vals = row.values || [];
    return {
      months: Array.from({ length: 12 }, (_, i) => getVal(vals[1 + i])), // D-O
      memo: getVal(vals[15]), // R column
    };
  }

  // Current row order (0-indexed):
  // 0=실손보험(윤혜), 1=손해보험한화(윤혜), 2=손해보험KB(윤혜),
  // 3=운전자보험(지원), 4=운전자보험(윤혜),
  // 5=생명보험(지원), 6=실비보험(지원), 7=실비보험진단(지원),
  // 8=생활보험화재(지원), 9=어린이보험(아이), 10=암보험(0)
  const d = rows.map(extract);
  const Z = Array(12).fill(''); // zeros

  const newOrder = [
    // 지원
    { sub: '생명보험',           months: d[5].months, memo: '지원 / ' + d[5].memo },
    { sub: '운전자보험',          months: d[3].months, memo: '지원' },
    { sub: '실비보험',            months: d[6].months, memo: '지원 / ' + d[6].memo },
    { sub: '실비보험(진단추가)',   months: d[7].months, memo: '지원 / ' + d[7].memo },
    { sub: '생활보험(화재)',       months: d[8].months, memo: '지원 / ' + d[8].memo },
    { sub: '암보험',              months: Z,            memo: '지원' },
    // 윤혜
    { sub: '실손보험',            months: d[0].months, memo: '윤혜 / ' + d[0].memo },
    { sub: '손해보험',            months: d[1].months, memo: '윤혜 / ' + d[1].memo },
    { sub: '손해보험',            months: d[2].months, memo: '윤혜 / ' + d[2].memo },
    { sub: '운전자보험',          months: d[4].months, memo: '윤혜' },
    { sub: '실비보험',            months: Z,            memo: '윤혜' },
    { sub: '실비보험(진단추가)',   months: Z,            memo: '윤혜' },
    { sub: '암보험',              months: Z,            memo: '윤혜' },
    // 아이
    { sub: '어린이보험',          months: d[9].months, memo: '아이 / ' + d[9].memo },
  ];

  // 2. Insert 3 rows before 합계 (currently at R26, 0-based index 25)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: 25, endIndex: 28 },
            inheritFromBefore: true,
          },
        },
      ],
    },
  });
  console.log('3 rows inserted');

  // 3. Write subitem names (C15:C28)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!C15',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newOrder.map(r => [r.sub]) },
  });

  // 4. Write monthly amounts (D15:O28)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!D15',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newOrder.map(r => r.months) },
  });

  // 5. Write memos (R15:R28)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!R15',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newOrder.map(r => [r.memo]) },
  });

  // 6. Update 합계 row formulas (now at R29, D29:O29)
  const sumFormulas = [Array.from({ length: 12 }, (_, i) => {
    const col = String.fromCharCode(68 + i); // D=68
    return `=SUM(${col}15:${col}28)`;
  })];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!D29',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: sumFormulas },
  });

  // 7. Extend 보험 B column merge to B15:B28
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { unmergeCells: { range: { sheetId, startRowIndex: 14, endRowIndex: 26, startColumnIndex: 1, endColumnIndex: 2 } } },
        { mergeCells: { range: { sheetId, startRowIndex: 14, endRowIndex: 28, startColumnIndex: 1, endColumnIndex: 2 }, mergeType: 'MERGE_ALL' } },
      ],
    },
  });

  console.log('보험 섹션 재구성 완료');
}

main().catch(err => console.error(err.message));
