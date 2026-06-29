const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log('연결 성공!');
  console.log('스프레드시트 제목:', res.data.properties.title);
  console.log('시트 목록:');
  res.data.sheets.forEach(sheet => {
    console.log(' -', sheet.properties.title);
  });
}

main().catch(err => {
  console.error('연결 실패:', err.message);
});
