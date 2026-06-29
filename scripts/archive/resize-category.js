const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const requests = Array.from({ length: 12 }, (_, m) => ({
    updateDimensionProperties: {
      range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: 4 + m * 4 + 1, endIndex: 4 + m * 4 + 2 },
      properties: { pixelSize: 50 },
      fields: 'pixelSize',
    },
  }));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  console.log('완료! 카테고리 열 50px');
}

main().catch(e => console.error(e.message));
