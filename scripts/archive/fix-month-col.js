const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // B4:B138 → 날짜에서 월 추출 수식
  const formulas = [];
  for (let i = 4; i <= 138; i++) {
    formulas.push([`=IF(A${i}="","",VALUE(MID(A${i},6,2)))`]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '유동자금 내역!B4:B138',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: formulas },
  });
  console.log('B열 수식 완료');
}
main().catch(e => console.error(e.message));
