const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

const CATEGORY_COLORS = {
  생활: { red: 0.671, green: 0.867, blue: 0.771 },
  자녀: { red: 1.000, green: 0.922, blue: 0.626 },
  외식: { red: 1.000, green: 0.800, blue: 0.600 },
  교통: { red: 0.630, green: 0.824, blue: 0.981 },
  여가: { red: 0.865, green: 0.704, blue: 0.892 },
  쇼핑: { red: 0.651, green: 0.908, blue: 0.941 },
  의료: { red: 1.000, green: 0.650, blue: 0.780 },
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '소비내역' });
  const rows = res.data.values || [];

  const requests = [];

  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    for (let m = 0; m < 12; m++) {
      const c0  = 4 + m * 4;
      const cat = (row[c0 + 1] || '').trim(); // 카테고리는 현재 col+1
      if (!cat || !CATEGORY_COLORS[cat]) continue;

      requests.push({
        repeatCell: {
          range: {
            sheetId: SHEET_ID,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: c0 + 3,
            endColumnIndex: c0 + 4,
          },
          cell: { userEnteredFormat: { backgroundColor: CATEGORY_COLORS[cat] } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
  }

  const CHUNK = 50;
  for (let i = 0; i < requests.length; i += CHUNK) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: requests.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r${Math.min(i + CHUNK, requests.length)}/${requests.length}`);
  }

  console.log('\n완료!');
}

main().catch(e => console.error(e.message));
