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
    includeGridData: true,
    ranges: ['년 단위 가계세팅!B1:E60'],
  });

  const rows = res.data.sheets[0].data[0].rowData || [];
  rows.forEach((row, i) => {
    const vals = (row.values || []).map(cell => {
      const v = cell.userEnteredValue;
      if (!v) return '';
      return v.formulaValue || v.numberValue || v.stringValue || '';
    });
    if (vals.some(v => v !== '')) {
      console.log(`R${i + 1}: ${JSON.stringify(vals)}`);
    }
  });
}

main().catch(err => console.error(err.message));
