const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

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

  // 금액 열: 월 m (0-indexed) → col index = 6 + m*5
  const data = Array.from({ length: 12 }, (_, m) => {
    const col = colLetter(6 + m * 5);
    return {
      range: `소비내역!${col}89`,
      values: [[`=SUM(${col}4:${col}88)`]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  console.log('완료! 합계 SUM 수식 적용:');
  data.forEach(d => console.log(' ', d.range, '←', d.values[0][0]));
}

main().catch(e => console.error(e.message));
