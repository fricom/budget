const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

const months = [
  { labelCol: 'D', catCol: 'E', sumCol: 'G', budgetCol: 'F' },   // 1월
  { labelCol: 'J', catCol: 'K', sumCol: 'M', budgetCol: 'G' },   // 2월
  { labelCol: 'P', catCol: 'Q', sumCol: 'S', budgetCol: 'H' },   // 3월
  { labelCol: 'V', catCol: 'W', sumCol: 'Y', budgetCol: 'I' },   // 4월
  { labelCol: 'AB', catCol: 'AC', sumCol: 'AE', budgetCol: 'J' }, // 5월
  { labelCol: 'AH', catCol: 'AI', sumCol: 'AK', budgetCol: 'K' }, // 6월
  { labelCol: 'AN', catCol: 'AO', sumCol: 'AQ', budgetCol: 'L' }, // 7월
  { labelCol: 'AT', catCol: 'AU', sumCol: 'AW', budgetCol: 'M' }, // 8월
  { labelCol: 'AZ', catCol: 'BA', sumCol: 'BC', budgetCol: 'N' }, // 9월
  { labelCol: 'BF', catCol: 'BG', sumCol: 'BI', budgetCol: 'O' }, // 10월
  { labelCol: 'BL', catCol: 'BM', sumCol: 'BO', budgetCol: 'P' }, // 11월
  { labelCol: 'BR', catCol: 'BS', sumCol: 'BU', budgetCol: 'Q' }, // 12월
];

const CATEGORIES = ['생활', '자녀', '외식', '교통', '여가', '쇼핑', '의료'];

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const updateData = [];

  // 1. 소비내역 row 1001 (합계) - SUM 범위 1000으로 확장
  months.forEach(({ labelCol, sumCol }) => {
    updateData.push({ range: `2026 소비내역!${labelCol}1001`, values: [['합계']] });
    updateData.push({ range: `2026 소비내역!${sumCol}1001`, values: [[`=SUM(${sumCol}4:${sumCol}1000)`]] });
  });

  // 2. 소비내역 row 1002 (잔액) - 올바른 예산 참조 + 합계행 1001 참조
  months.forEach(({ labelCol, sumCol, budgetCol }) => {
    updateData.push({ range: `2026 소비내역!${labelCol}1002`, values: [['잔액']] });
    updateData.push({ range: `2026 소비내역!${sumCol}1002`, values: [[`='2026'!${budgetCol}31-${sumCol}1001`]] });
  });

  // 3. 분석.그래프 월별 지출 - 합계 참조 89 → 1001
  months.forEach(({ sumCol }, i) => {
    updateData.push({ range: `분석.그래프!C${i + 4}`, values: [[`='2026 소비내역'!${sumCol}1001`]] });
  });

  // 4. 분석.그래프 카테고리별 월별 SUMIF - $88 → $1000
  months.forEach(({ catCol, sumCol }, mi) => {
    const row = 46 + mi;
    const formulas = CATEGORIES.map(cat =>
      `=SUMIF('2026 소비내역'!${catCol}$4:${catCol}$1000,"${cat}",'2026 소비내역'!${sumCol}$4:${sumCol}$1000)`
    );
    updateData.push({ range: `분석.그래프!C${row}:I${row}`, values: [formulas] });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updateData },
  });
  console.log('Step 1-4 완료: row 1001/1002 작성, 분석.그래프 수식 업데이트');

  // 5. 소비내역 기존 row 89-90 클리어
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { ranges: ['2026 소비내역!A89:BV90'] },
  });
  console.log('Step 5 완료: 소비내역 row 89-90 클리어');

  // 검증
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026 소비내역!G1001:G1002',
  });
  console.log('소비내역 G1001:G1002:', JSON.stringify(r.data.values));

  const r2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '분석.그래프!B4:D5',
  });
  console.log('분석.그래프 월별 지출:', JSON.stringify(r2.data.values));
}
main().catch(e => console.error(e.message));
