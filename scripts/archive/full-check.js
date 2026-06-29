const { google } = require('googleapis');
const path = require('path');

const ID       = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 2026 탭 비상금 섹션 ────────────────────────────────────
  console.log('=== 2026 탭 저축·비상금 섹션 ===');
  const r1 = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: ["'2026'!E40:S65"],
    includeGridData: true,
  });
  const rows1 = r1.data.sheets[0].data[0].rowData || [];
  rows1.forEach((row, i) => {
    const rn = 40 + i;
    const cells = row.values || [];
    const label   = cells[0]?.effectiveValue?.stringValue || cells[0]?.effectiveValue?.numberValue || '';
    const f1_val  = cells[1]?.effectiveValue?.numberValue;
    const f1_form = cells[1]?.userEnteredValue?.formulaValue || '';
    const r_form  = cells[13]?.userEnteredValue?.formulaValue || '';
    const s_form  = cells[14]?.userEnteredValue?.formulaValue || '';
    if (!label && f1_val === undefined) return;
    const tag = f1_form.includes('SUMIFS') ? '[SUMIFS]' : f1_form ? '[수식]' : '[값]';
    const v1 = f1_val !== undefined ? f1_val.toLocaleString() : '-';
    const rOk = r_form.includes('SUM') ? '✓' : (r_form ? '?' : '없음');
    const sOk = s_form.includes('2025') ? '✓' : (s_form ? '?' : '없음');
    console.log(`R${rn} ${String(label).padEnd(14)} ${tag.padEnd(9)} 1월:${String(v1).padStart(12)}  R열:${rOk}  S열:${sOk}`);
  });

  // ── 2. 게릴라지출 탭 데이터 현황 ───────────────────────────────
  console.log('\n=== 게릴라지출 탭 헤더 & 데이터 수 ===');
  const r2 = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: "'게릴라지출'!A1:E500",
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const gRows = r2.data.values || [];
  // 헤더 확인
  console.log('헤더:', gRows[0]);

  // 분류별·월별 집계
  const CATS = ['여행예금','가족경조사비','병원비','경조사','차량관리','파킹통장'];
  const monthly = {};
  CATS.forEach(c => { monthly[c] = {}; for(let m=1;m<=12;m++) monthly[c][m]=0; });

  gRows.slice(1).forEach(r => {
    const date = String(r[0]||'');
    const cat  = String(r[2]||'');  // C열 = 분류 (현재 구조)
    const amt  = parseFloat(r[3]||0); // D열 = 금액
    if (!CATS.includes(cat)) return;
    // 날짜에서 월 추출 ("2026.MM.DD" 또는 "2026-MM-DD")
    const m = date.match(/[.-]0?(\d{1,2})[.-]/);
    if (!m) return;
    const mo = parseInt(m[1]);
    if (mo >= 1 && mo <= 12) monthly[cat][mo] += amt;
  });

  console.log('\n분류별 월합계:');
  console.log('분류'.padEnd(10), [1,2,3,4,5,6,7,8,9,10,11,12].map(m=>String(m+'월').padStart(9)).join(''));
  CATS.forEach(cat => {
    const vals = Object.values(monthly[cat]).map(v => String(Math.round(v)).padStart(9));
    console.log(cat.padEnd(10), vals.join(''));
  });

  // ── 3. 2026 탭 SUMIFS 결과 vs 게릴라지출 직접 합산 비교 ────────
  console.log('\n=== SUMIFS 연동 검증 (2026 탭 실제값 vs 게릴라지출 합산) ===');
  const ROW_MAP = {
    '여행예금': 52, '가족경조사비': 53, '병원비': 54, '경조사': 55, '차량관리': 56, '파킹통장': 57
  };
  const ranges2026 = CATS.map(c => `'2026'!F${ROW_MAP[c]}:Q${ROW_MAP[c]}`);
  const r3 = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: ID,
    ranges: ranges2026,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  CATS.forEach((cat, ci) => {
    const tabVals = (r3.data.valueRanges[ci].values?.[0] || []).map(v => Math.round(parseFloat(v)||0));
    const guerVals = [1,2,3,4,5,6,7,8,9,10,11,12].map(m => Math.round(monthly[cat][m]));
    const match = tabVals.every((v, i) => v === guerVals[i]);
    const mismatch = tabVals.map((v,i) => v !== guerVals[i] ? `${i+1}월(탭:${v}/게:${guerVals[i]})` : null).filter(Boolean);
    console.log(`R${ROW_MAP[cat]} ${cat.padEnd(8)} ${match ? '✓ 일치' : '✗ 불일치: ' + mismatch.join(', ')}`);
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });
