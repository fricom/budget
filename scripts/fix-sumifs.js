const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const categories = { 51:'병원비', 52:'차량관리', 53:'여행비', 54:'가족경조사', 55:'지인경조사', 57:'유입금', 58:'임시지출' };

  const updateData = [];
  Object.entries(categories).forEach(([rowNum, cat]) => {
    const formulas = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? 2027 : 2026;
      return "=SUMIFS('유동자금 내역'!$D:$D,'유동자금 내역'!$B:$B,\"" + cat + "\",'유동자금 내역'!$A:$A,\">=\"&DATE(2026," + m + ",1),'유동자금 내역'!$A:$A,\"<\"&DATE(" + ny + "," + nm + ",1))";
    });
    updateData.push({ range: '2026!F' + rowNum + ':Q' + rowNum, values: [formulas] });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updateData }
  });
  console.log('수식 재작성 완료');

  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '2026!E51:Q58' });
  console.log('\n=== 검증 ===');
  (r.data.values||[]).forEach((row, i) => console.log('R'+(i+51)+':', row.join(' | ')));
}
main().catch(e => console.error(e.message));
