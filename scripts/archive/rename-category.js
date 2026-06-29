const { google } = require('googleapis');
const path = require('path');
const ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

const col = n => { let r='', m=n+1; while(m>0){r=String.fromCharCode(65+(m-1)%26)+r;m=Math.floor((m-1)/26);} return r; };
const catIdx = m => 2 + (m-1)*5;
const amtIdx = m => 4 + (m-1)*5;

const FROM = '여행예금';
const TO   = '여행비';
const ROW_2026 = 51; // R52 (0-indexed)

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const gSheet = meta.data.sheets.find(s => s.properties.title === '유동자금 내역');
  const GID = gSheet.properties.sheetId;

  // 1. 유동자금 내역 기존 데이터 치환
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: "'유동자금 내역'!A1:BH40",
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const grid = r.data.values || [];
  const hits = [];
  grid.forEach((row, ri) => row.forEach((cell, ci) => {
    if (cell === FROM) hits.push({ r: ri, c: ci });
  }));
  console.log(`'${FROM}' 셀 ${hits.length}개 발견`);

  const requests = [];

  hits.forEach(({ r, c }) => {
    requests.push({
      updateCells: {
        range: { sheetId: GID, startRowIndex: r, endRowIndex: r+1, startColumnIndex: c, endColumnIndex: c+1 },
        rows: [{ values: [{ userEnteredValue: { stringValue: TO } }] }],
        fields: 'userEnteredValue',
      },
    });
  });

  // 2. 드롭다운 업데이트
  const NEW_CATS = ['여행비', '가족경조사', '병원비', '지인경조사', '차량관리', '비상금'];
  Array.from({length:12}, (_, m) => catIdx(m+1)).forEach(ci => {
    requests.push({
      setDataValidation: {
        range: { sheetId: GID, startRowIndex: 3, endRowIndex: 33, startColumnIndex: ci, endColumnIndex: ci+1 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: NEW_CATS.map(c => ({ userEnteredValue: c })) },
          showCustomUi: true, strict: false,
        },
      },
    });
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });
  console.log('✓ 유동자금 내역: 데이터 치환 + 드롭다운 업데이트');

  // 3. 2026 탭 R55 항목명 + SUMIFS
  const req2026 = [{
    updateCells: {
      range: { sheetId: SHEET_2026_ID, startRowIndex: ROW_2026, endRowIndex: ROW_2026+1, startColumnIndex: 4, endColumnIndex: 5 },
      rows: [{ values: [{ userEnteredValue: { stringValue: TO } }] }],
      fields: 'userEnteredValue',
    },
  }];

  for (let m = 1; m <= 12; m++) {
    const cCol = col(catIdx(m));
    const aCol = col(amtIdx(m));
    const formula = `=SUMIFS('유동자금 내역'!${aCol}4:${aCol}33,'유동자금 내역'!${cCol}4:${cCol}33,"${TO}")`;
    req2026.push({
      updateCells: {
        range: { sheetId: SHEET_2026_ID, startRowIndex: ROW_2026, endRowIndex: ROW_2026+1, startColumnIndex: 4+m, endColumnIndex: 5+m },
        rows: [{ values: [{ userEnteredValue: { formulaValue: formula } }] }],
        fields: 'userEnteredValue',
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests: req2026 } });
  console.log('✓ 2026 탭 R55 항목명 + SUMIFS 업데이트');
}

main().catch(e => console.error(e.message));
