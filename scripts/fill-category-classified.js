const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const RESOLVED_PATH = '/private/tmp/claude-501/-Users-yunhye/925c9a4e-69d2-4453-878a-b4107830b637/scratchpad/resolved.json';

function colName(ci) { return ci < 26 ? String.fromCharCode(65 + ci) : String.fromCharCode(64 + Math.floor(ci / 26)) + String.fromCharCode(65 + ci % 26); }

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const resolved = require(RESOLVED_PATH);

  const updates = resolved.map(r => {
    const colIdx = 4 + r.mi * 6; // 카테고리 열 (D=날짜 기준 +1)
    return { range: `2026 소비내역!${colName(colIdx)}${r.row}`, values: [[r.cat]] };
  });

  console.log('기록할 셀 수:', updates.length);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
  console.log('✓ 카테고리 분류 기록 완료');
}
main().catch(e => console.error(e.message));
