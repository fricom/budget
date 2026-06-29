const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

const CATEGORIES = ['생활', '자녀', '외식', '교통', '여가', '쇼핑', '의료'];

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 현재 구조: 월 시작 col = 3 + m*5, 카테고리 = 시작+1
  const requests = Array.from({ length: 12 }, (_, m) => ({
    setDataValidation: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: 3,   // row 4 (데이터 시작)
        endRowIndex: 88,    // row 88
        startColumnIndex: 3 + m * 5 + 1,
        endColumnIndex:   3 + m * 5 + 2,
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: CATEGORIES.map(c => ({ userEnteredValue: c })),
        },
        showCustomUi: true,
        strict: false,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료! 카테고리 드롭다운 적용');
  console.log('  선택항목:', CATEGORIES.join(', '));
}

main().catch(e => console.error(e.message));
