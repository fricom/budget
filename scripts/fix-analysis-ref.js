const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

// 합계 행이 1001 → 104로 이동 (빈 행 정리 중 딸려 올라감)
const sumCols = ['G', 'M', 'S', 'Y', 'AE', 'AK', 'AQ', 'AW', 'BC', 'BI', 'BO', 'BU'];

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const data = sumCols.map((col, i) => ({
    range: `분석.그래프!C${i + 4}`,
    values: [[`='2026 소비내역'!${col}104`]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
  console.log('✓ 분석.그래프!C4:C15 수식 재연결 완료 (1001 → 104)');

  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '분석.그래프!B4:D15',
  });
  console.log('검증:', JSON.stringify(r.data.values, null, 2));
}
main().catch(e => console.error(e.message));
