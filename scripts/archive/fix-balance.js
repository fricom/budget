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

  // 년 단위 가계세팅: row27의 월별 생활비 col → D(1월)~O(12월) = index 3~14
  // 소비내역: 잔액 row90, 금액 col index = 6 + m*5 (m: 0-indexed)
  const data = Array.from({ length: 12 }, (_, m) => {
    const budgetCol  = colLetter(3 + m);      // D(1월), E(2월), ..., O(12월)
    const amountCol  = colLetter(6 + m * 5);  // G(1월), L(2월), ..., BJ(12월)
    return {
      range: `소비내역!${amountCol}90`,
      values: [[`='년 단위 가계세팅'!${budgetCol}27-${amountCol}89`]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  console.log('완료! 잔액 수식 12개월 적용:');
  data.forEach(d => console.log(' ', d.range, '←', d.values[0][0]));
}

main().catch(e => console.error(e.message));
