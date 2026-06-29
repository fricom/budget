const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 1559332089; // 월 예산

function parseAmount(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[₩,\s]/g, ''), 10) || 0;
}

function pct(amount, income) {
  return Math.round(amount / income * 100);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '월 예산',
  });
  const rows = res.data.values || [];

  // 금액 파싱 헬퍼
  const e = (r, c) => parseAmount((rows[r] || [])[c]);

  // ── 지원 (수입 col:4, 퍼센트 col:B=1) ──────────────────────
  const incomeJ = e(3, 4); // row4, E열

  const groups_J = [
    { row: 6,  label: '주거',    total: e(5,4) + e(6,4) },
    { row: 8,  label: '보험',    total: e(7,4) + e(8,4) + e(9,4) + e(10,4) + e(11,4) },
    { row: 13, label: '고정지출', total: e(12,4) + e(13,4) + e(14,4) + e(15,4) + e(16,4) + e(17,4) },
    { row: 19, label: '생활비',  total: e(18,4) },
    { row: 20, label: '저축',    total: e(19,4) + e(20,4) + e(21,4) + e(22,4) },
    { row: 24, label: '연금',    total: e(23,4) + e(24,4) },
    { row: 26, label: '비상금',  total: e(25,4) },
    { row: 27, label: '합계',    total: e(26,4) },
    { row: 29, label: '용돈',    total: e(28,4) },
  ];

  // ── 윤혜 (수입 col:10, 퍼센트 col:H=7) ──────────────────────
  const incomeY = e(3, 10); // row4, K열

  const groups_Y = [
    { row: 6,  label: '보험',    total: e(5,10) + e(6,10) + e(7,10) + e(8,10) + e(9,10) },
    { row: 11, label: '고정지출', total: e(10,10) + e(11,10) + e(12,10) + e(13,10) + e(14,10) + e(15,10) + e(16,10) },
    { row: 18, label: '생활비',  total: e(17,10) },
    { row: 19, label: '저축',    total: e(18,10) + e(19,10) + e(20,10) + e(21,10) + e(22,10) + e(23,10) },
    { row: 25, label: '연금',    total: e(24,10) + e(25,10) },
    { row: 27, label: '비상금',  total: e(26,10) + e(27,10) + e(28,10) },
    { row: 30, label: '합계',    total: e(29,10) },
    { row: 32, label: '용돈',    total: e(31,10) },
  ];

  console.log(`\n── 지원 (수입 ${incomeJ.toLocaleString()}원) ──`);
  groups_J.forEach(g => console.log(`  ${g.label.padEnd(6)} ${g.total.toLocaleString()}원 → ${pct(g.total, incomeJ)}%`));

  console.log(`\n── 윤혜 (수입 ${incomeY.toLocaleString()}원) ──`);
  groups_Y.forEach(g => console.log(`  ${g.label.padEnd(6)} ${g.total.toLocaleString()}원 → ${pct(g.total, incomeY)}%`));

  // ── 셀 업데이트 ──────────────────────────────────────────────
  const data = [
    ...groups_J.map(g => ({
      range: `월 예산!B${g.row}`,
      values: [[pct(g.total, incomeJ)]],
    })),
    ...groups_Y.map(g => ({
      range: `월 예산!H${g.row}`,
      values: [[pct(g.total, incomeY)]],
    })),
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });

  console.log('\n완료! 퍼센트 입력됨');
}

main().catch(e => console.error(e.message));
