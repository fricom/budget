const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 669432140; // 유동자금 내역

  const categories = ['병원비', '차량관리', '여행비', '가족경조사', '지인경조사', '유입금', '임시지출'];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 138, startColumnIndex: 2, endColumnIndex: 3 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: categories.map(v => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: false, // 직접 입력도 허용
          },
        },
      }],
    },
  });

  console.log(`드롭다운 적용 완료: B4:B138 (${categories.join(', ')})`);
}
main().catch(e => console.error(e.message));
