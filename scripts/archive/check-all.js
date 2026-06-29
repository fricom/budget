const { google } = require('googleapis');
const path = require('path');
const ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

const col = n => { let r='', m=n+1; while(m>0){r=String.fromCharCode(65+(m-1)%26)+r;m=Math.floor((m-1)/26);} return r; };
const catIdx = m => 2 + (m-1)*5;  // 1월=C(2), 2월=H(7)...
const amtIdx = m => 4 + (m-1)*5;  // 1월=E(4), 2월=J(9)...
const ROW_DS = 4, ROW_DE = 33;    // 유동자금 내역 데이터 행 (1-indexed)

const CATS = ['병원비','차량관리','여행비','가족경조사','지인경조사','비상금'];
const CAT_ROW = { '병원비':52,'차량관리':53,'여행비':54,'가족경조사':55,'지인경조사':56,'비상금':57 };

const fmt = n => n === undefined ? '-' : Number(n).toLocaleString();
const ok = b => b ? '✓' : '✗';

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ══ 1. 유동자금 내역 드롭다운 확인 ══════════════════════════════
  console.log('\n▶ 1. 유동자금 내역 드롭다운');
  const r1 = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'유동자금 내역'!${col(catIdx(1))}${ROW_DS}`],
    includeGridData: true,
  });
  const dv = r1.data.sheets[0].data[0].rowData?.[0]?.values?.[0]?.dataValidation?.condition?.values || [];
  const dvList = dv.map(v => v.userEnteredValue);
  console.log('  목록:', dvList.join(' / '));
  const dvOk = CATS.every(c => dvList.includes(c)) && dvList.length === CATS.length;
  console.log('  기대:', CATS.join(' / '));
  console.log('  결과:', ok(dvOk), dvOk ? '일치' : '불일치!');

  // ══ 2. 2026 탭 SUMIFS 수식 열 검증 ═════════════════════════════
  console.log('\n▶ 2. SUMIFS 수식 열 검증 (1월 기준)');
  const r2 = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'2026'!F52:F57`],
    includeGridData: true,
  });
  const sumRows = r2.data.sheets[0].data[0].rowData || [];
  const expectedAmtCol = col(amtIdx(1));
  const expectedCatCol = col(catIdx(1));
  sumRows.forEach((row, i) => {
    const formula = row.values?.[0]?.userEnteredValue?.formulaValue || '';
    const hasAmt = formula.includes(`!${expectedAmtCol}${ROW_DS}`);
    const hasCat = formula.includes(`!${expectedCatCol}${ROW_DS}`);
    const catName = CATS[i] || '?';
    console.log(`  R${52+i} ${catName.padEnd(8)} ${ok(hasAmt && hasCat)} 금액:${expectedAmtCol} 분류:${expectedCatCol} | ${formula.slice(0,55)}`);
  });

  // ══ 3. 유동자금 내역 실제 데이터 vs SUMIFS 결과 비교 ════════════
  console.log('\n▶ 3. SUMIFS 연동 검증 (분류별 직접합산 vs 2026 탭 값)');

  // 유동자금 내역 전체 읽기
  const r3 = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: `'유동자금 내역'!A1:BH40`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const grid = r3.data.values || [];

  // 월별·분류별 직접 합산
  const direct = {};
  CATS.forEach(c => { direct[c] = {}; for(let m=1;m<=12;m++) direct[c][m]=0; });

  for (let m = 1; m <= 12; m++) {
    const ci = catIdx(m), ai = amtIdx(m);
    for (let rowIdx = ROW_DS - 1; rowIdx <= ROW_DE - 1; rowIdx++) {
      const row = grid[rowIdx] || [];
      const cat = row[ci] || '';
      const amt = parseFloat(row[ai] || 0);
      if (CATS.includes(cat) && !isNaN(amt)) direct[cat][m] += amt;
    }
  }

  // 2026 탭 SUMIFS 실제 값
  const ranges2026 = CATS.map(c => `'2026'!F${CAT_ROW[c]}:Q${CAT_ROW[c]}`);
  const r4 = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: ID,
    ranges: ranges2026,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  let allMatch = true;
  CATS.forEach((cat, ci) => {
    const tabVals = (r4.data.valueRanges[ci].values?.[0] || []).map(v => Math.round(parseFloat(v)||0));
    const mismatches = [];
    for (let m = 1; m <= 12; m++) {
      const tab = tabVals[m-1] ?? 0;
      const dir = Math.round(direct[cat][m]);
      if (tab !== dir) mismatches.push(`${m}월(탭:${fmt(tab)}/직접:${fmt(dir)})`);
    }
    const match = mismatches.length === 0;
    if (!match) allMatch = false;
    console.log(`  ${ok(match)} R${CAT_ROW[cat]} ${cat.padEnd(8)} ${match ? '전월 일치' : '불일치: '+mismatches.slice(0,3).join(', ')}`);
  });

  // ══ 4. 2026 탭 합계 수식 확인 ═══════════════════════════════════
  console.log('\n▶ 4. 2026 탭 합계 수식');
  const r5 = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'2026'!F49:Q49`, `'2026'!F61:Q61`, `'2026'!F50:F50`, `'2026'!R49:R61`],
    includeGridData: true,
  });

  // 저축 합계 R50 (F49 = 합계행 1월)
  const sum49F = r5.data.sheets[0].data[0].rowData?.[0]?.values?.[0];
  const f49formula = sum49F?.userEnteredValue?.formulaValue || '';
  const f49val = sum49F?.effectiveValue?.numberValue;
  // R44(부모님노후)가 범위에 포함되는지 확인
  const includes44 = f49formula.match(/F(\d+):F(\d+)/);
  const rangeOk = includes44 ? parseInt(includes44[1]) <= 44 && parseInt(includes44[2]) >= 49 : false;
  console.log(`  R50 저축합계 1월수식: ${f49formula} → ${ok(rangeOk)} 부모님노후(R44) 포함`);
  console.log(`  R50 저축합계 1월값: ${fmt(f49val)}`);

  // 유동자금 합계 R61
  const sum61F = r5.data.sheets[0].data[1].rowData?.[0]?.values?.[0];
  const f61formula = sum61F?.userEnteredValue?.formulaValue || '';
  const f61val = sum61F?.effectiveValue?.numberValue;
  console.log(`  R62 유동자금합계 수식: ${f61formula} → 값: ${fmt(f61val)}`);

  // ══ 5. 월 예산 탭 연동 ══════════════════════════════════════════
  console.log('\n▶ 5. 월 예산 탭 연동');
  const r6 = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: `'월 예산'!C15:E18`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const budRows = r6.data.values || [];
  budRows.forEach((row, i) => {
    if (row.some(c=>c)) console.log(`  R${15+i}`, row.join(' | '));
  });

  console.log('\n══ 요약 ══════════════════════════════════');
  console.log('드롭다운 목록:', ok(dvOk));
  console.log('SUMIFS 연동:', ok(allMatch));
}

main().catch(e => console.error(e.message));
