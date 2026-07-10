const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

function colName(ci) {
  return ci < 26
    ? String.fromCharCode(65 + ci)
    : String.fromCharCode(64 + Math.floor(ci / 26)) + String.fromCharCode(65 + ci % 26);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const tabs = [
    { name: '월 예산', range: 'A1:Z100' },
    { name: '2026', range: 'A1:S70' },
    { name: '2026 소비내역', range: 'A1:BV1010' },
    { name: '비상금내역', range: 'A1:BZ40' },
    { name: '분석.그래프', range: 'A1:V60' },
    { name: '2025', range: 'A1:S70' },
    { name: '설정', range: 'A1:J30' },
  ];
  for (const tab of tabs) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tab.name + '!' + tab.range,
      });
      const errors = [];
      (res.data.values || []).forEach((row, ri) => {
        row.forEach((v, ci) => {
          if (typeof v === 'string' && v.startsWith('#')) {
            errors.push('R' + (ri + 1) + colName(ci) + ':' + v);
          }
        });
      });
      console.log(tab.name + ':', errors.length ? errors.join(', ') : '오류 없음');
    } catch (e) {
      console.log(tab.name + ': 조회 실패 -', e.message);
    }
  }
}
main().catch(e => console.error(e.message));
