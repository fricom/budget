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
    ranges: ['년 단위 가계세팅!A1:S10'],
  });

  const rows = res.data.sheets[0].data[0].rowData || [];
  const COLS = 'ABCDEFGHIJKLMNOPQRS'.split('');

  // Print header row to see column layout
  rows.forEach((row, i) => {
    const vals = (row.values || []).map((cell, ci) => {
      const v = cell.userEnteredValue;
      const val = v ? (v.formulaValue || v.numberValue || v.stringValue || '') : '';
      return `${COLS[ci]}:${val}`;
    });
    const nonEmpty = vals.filter(v => !v.endsWith(':'));
    if (nonEmpty.length > 0) {
      console.log(`R${i + 1}: ${nonEmpty.join(' | ')}`);
    }
  });
}

main().catch(err => console.error(err.message));
