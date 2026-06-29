const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function readRange(sheets, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('=== 월 예산 (항목명) ===');
  const budget = await readRange(sheets, '월 예산!B4:F17');
  budget.forEach((r, i) => { if (r.some(v => v)) console.log(`R${i+4}: ${JSON.stringify(r)}`); });

  console.log('\n=== 년 단위 가계세팅 (항목/소항목) ===');
  const annual = await readRange(sheets, '년 단위 가계세팅!B4:C56');
  annual.forEach((r, i) => { if (r.some(v => v)) console.log(`R${i+4}: ${JSON.stringify(r)}`); });

  console.log('\n=== 소비내역 (카테고리 헤더) ===');
  const expense = await readRange(sheets, '소비내역!A1:H5');
  expense.forEach((r, i) => { if (r.some(v => v)) console.log(`R${i+1}: ${JSON.stringify(r)}`); });

  console.log('\n=== 분석.그래프 (카테고리 레이블) ===');
  const analysis = await readRange(sheets, '분석.그래프!A1:H10');
  analysis.forEach((r, i) => { if (r.some(v => v)) console.log(`R${i+1}: ${JSON.stringify(r)}`); });
}

main().catch(err => console.error(err.message));
