const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

function colLetter(idx) {
  let letter = '';
  idx += 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    idx = Math.floor((idx - 1) / 26);
  }
  return letter;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 현재 3~12월 금액 열 (0-indexed): 18,23,28,33,38,43,48,53,58,63
  // 삽입 위치 (금액 바로 뒤): 19,24,29,34,39,44,49,54,59,64
  // 오른쪽→왼쪽 순서로 삽입해야 인덱스 안 밀림
  const insertPositions = [64, 59, 54, 49, 44, 39, 34, 29, 24, 19];

  const insertRequests = insertPositions.map(pos => ({
    insertDimension: {
      range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: pos, endIndex: pos + 1 },
      inheritFromBefore: false,
    },
  }));

  // 삽입 후 메모 열 너비 90px 설정
  // 새 메모 열 위치: 19,25,31,37,43,49,55,61,67,73 (months 3~12)
  const newMemoCols = [19, 25, 31, 37, 43, 49, 55, 61, 67, 73];
  const widthRequests = newMemoCols.map(colIdx => ({
    updateDimensionProperties: {
      range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: colIdx, endIndex: colIdx + 1 },
      properties: { pixelSize: 90 },
      fields: 'pixelSize',
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [...insertRequests, ...widthRequests] },
  });
  console.log('✓ 메모 열 삽입 + 너비 설정');

  // 메모 헤더 (row 3) 설정 — 3~12월
  const headerData = newMemoCols.map(colIdx => ({
    range: `소비내역!${colLetter(colIdx)}3`,
    values: [['메모']],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: headerData },
  });
  console.log('✓ 메모 헤더 설정');

  // 삽입 후 새 금액 열 위치: 6,12,18,24,30,36,42,48,54,60,66,72 (= 6*(m+1))
  // SUM 수식 재적용 (12개월 전부)
  const sumData = Array.from({ length: 12 }, (_, m) => {
    const col = colLetter(6 * (m + 1));
    return { range: `소비내역!${col}89`, values: [[`=SUM(${col}4:${col}88)`]] };
  });

  // 잔액 수식 재적용 (12개월 전부)
  const budgetCols = ['D','E','F','G','H','I','J','K','L','M','N','O'];
  const balanceData = Array.from({ length: 12 }, (_, m) => {
    const col = colLetter(6 * (m + 1));
    return { range: `소비내역!${col}90`, values: [[`='년 단위 가계세팅'!${budgetCols[m]}27-${col}89`]] };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: [...sumData, ...balanceData] },
  });
  console.log('✓ SUM / 잔액 수식 재설정');

  console.log('\n완료! 새 금액 열 위치:');
  Array.from({ length: 12 }, (_, m) => {
    console.log(`  ${m+1}월 금액: ${colLetter(6*(m+1))} (col ${6*(m+1)})`);
  });
}

main().catch(e => console.error(e.message));
