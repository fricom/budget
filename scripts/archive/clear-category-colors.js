const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;
const WHITE = { red: 1, green: 1, blue: 1 };

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 카테고리 열: 월 m → col index = 4 + m*5
  const requests = Array.from({ length: 12 }, (_, m) => ({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: 2,   // row 3 (열헤더)부터
        endRowIndex: 90,    // row 90까지
        startColumnIndex: 4 + m * 5,
        endColumnIndex:   4 + m * 5 + 1,
      },
      cell: { userEnteredFormat: { backgroundColor: WHITE } },
      fields: 'userEnteredFormat.backgroundColor',
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료! 카테고리 열 색상 제거');
}

main().catch(e => console.error(e.message));
