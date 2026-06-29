const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077; // 소비내역 sheet ID

const CATEGORIES = [
  { name: '생활',  color: { red: 0.671, green: 0.867, blue: 0.771 } }, // 연한 그린    (95건)
  { name: '자녀',  color: { red: 1.000, green: 0.922, blue: 0.626 } }, // 연한 노랑    (89건)
  { name: '외식',  color: { red: 1.000, green: 0.800, blue: 0.600 } }, // 복숭아 오렌지 (62건)
  { name: '교통',  color: { red: 0.630, green: 0.824, blue: 0.981 } }, // 연한 파랑    (48건)
  { name: '여가',  color: { red: 0.865, green: 0.704, blue: 0.892 } }, // 연한 보라    (14건)
  { name: '쇼핑',  color: { red: 0.651, green: 0.908, blue: 0.941 } }, // 연한 시안    (13건)
  { name: '의료',  color: { red: 1.000, green: 0.650, blue: 0.780 } }, // 핑크/로즈    (8건)
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 카테고리 텍스트 쓰기 (B3:B9)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '소비내역!B3:B9',
    valueInputOption: 'RAW',
    requestBody: {
      values: CATEGORIES.map(c => [c.name]),
    },
  });

  // 각 셀에 배경색 적용
  const colorRequests = CATEGORIES.map((cat, i) => ({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: 2 + i, // row 3 = index 2
        endRowIndex: 3 + i,
        startColumnIndex: 1,  // column B = index 1
        endColumnIndex: 2,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: cat.color,
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: colorRequests },
  });

  console.log('완료! 카테고리 적용:');
  CATEGORIES.forEach(c => console.log(` - ${c.name}`));
}

main().catch(err => console.error('오류:', err.message));
