const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

function rgb(hex) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = 1862606876;

  // Insert 1 row after R54 (임시지출), 0-based index 54
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: 54, endIndex: 55 },
            inheritFromBefore: true,
          },
        },
      ],
    },
  });

  // Write "실 잔고" to D55
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!D55',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['실 잔고']] },
  });

  // Apply light gray to B55:Q55
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 54, endRowIndex: 55, startColumnIndex: 1, endColumnIndex: 17 },
            cell: { userEnteredFormat: { backgroundColor: rgb('#f3f3f3') } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });

  console.log('실 잔고 행 추가 완료');
}

main().catch(err => console.error(err.message));
