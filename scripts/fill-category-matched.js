const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function colName(ci) {
  return ci < 26
    ? String.fromCharCode(65 + ci)
    : String.fromCharCode(64 + Math.floor(ci / 26)) + String.fromCharCode(65 + ci % 26);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '2026 소비내역!D4:BV103' });
  const rows = res.data.values || [];

  // item명 -> 기존 카테고리 매핑 수집
  const map = {};
  const blanks = [];
  MONTHS.forEach((mname, mi) => {
    const off = mi * 6; // D 기준 0-based: 날짜=off,카테고리=off+1,항목=off+2,금액=off+3
    rows.forEach((row, ri) => {
      const cat = (row[off + 1] || '').trim();
      const item = (row[off + 2] || '').trim();
      const amt = row[off + 3] || '';
      if (!item) return;
      if (cat) {
        map[item] = map[item] || {};
        map[item][cat] = (map[item][cat] || 0) + 1;
      } else if (amt !== '') {
        blanks.push({ mi, ri, item, row: ri + 4 });
      }
    });
  });

  // 모호하지 않게(단일 카테고리로만 쓰인 항목명) 매칭
  const updates = [];
  blanks.forEach(b => {
    const cats = map[b.item];
    if (cats && Object.keys(cats).length === 1) {
      const cat = Object.keys(cats)[0];
      const colIdx = 4 + b.mi * 6; // D(3) + off(mi*6) + 1(카테고리열)
      const cell = `${colName(colIdx)}${b.row}`;
      updates.push({ range: `2026 소비내역!${cell}`, values: [[cat]] });
    }
  });

  console.log('기록할 셀 수:', updates.length);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
  console.log('✓ 카테고리 자동 채우기 완료');
}
main().catch(e => console.error(e.message));
