const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

// 월별 컬럼 너비: 날짜 | 카테고리 | 항목 | 금액
const WIDTHS = {
  date:     80,
  category: 65,
  item:     175,
  amount:   95,
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const requests = [];

  for (let m = 0; m < 12; m++) {
    const c0 = 4 + m * 4;

    [
      [c0,     WIDTHS.date],
      [c0 + 1, WIDTHS.category],
      [c0 + 2, WIDTHS.item],
      [c0 + 3, WIDTHS.amount],
    ].forEach(([col, px]) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      });
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료!');
  console.log(`  날짜: ${WIDTHS.date}px | 카테고리: ${WIDTHS.category}px | 항목: ${WIDTHS.item}px | 금액: ${WIDTHS.amount}px`);
  console.log('  12개월 동일 적용');
}

main().catch(e => console.error(e.message));
