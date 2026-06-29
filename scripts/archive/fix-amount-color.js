const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

const GRAY  = { red: 0.9372549, green: 0.9372549, blue: 0.9372549 };
const WHITE = { red: 1, green: 1, blue: 1 };

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const requests = [];

  for (let m = 0; m < 12; m++) {
    const amountCol = 4 + m * 4 + 3;

    // 헤더(row 2)에 회색 적용
    requests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: amountCol, endColumnIndex: amountCol + 1 },
        cell: { userEnteredFormat: { backgroundColor: GRAY } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });

    // 데이터 행 금액 셀 색상 제거 (흰색)
    requests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: 2, endRowIndex: 100, startColumnIndex: amountCol, endColumnIndex: amountCol + 1 },
        cell: { userEnteredFormat: { backgroundColor: WHITE } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료!');
}

main().catch(e => console.error(e.message));
