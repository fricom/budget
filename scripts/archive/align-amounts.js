const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 금액 열: 월 m (0-indexed) → col index = 6 + m*5
  // row 2(헤더) ~ row 90(잔액) 전체 우측 정렬
  const requests = Array.from({ length: 12 }, (_, m) => {
    const colIdx = 6 + m * 5;
    return {
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: 1,   // row 2 (헤더)
          endRowIndex: 90,    // row 90 (잔액)
          startColumnIndex: colIdx,
          endColumnIndex: colIdx + 1,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    };
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료! 12개월 금액 열 우측 정렬 적용');
}

main().catch(e => console.error(e.message));
