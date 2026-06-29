const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // Step 1: 2026 탭 SUMIFS 먼저 업데이트 (B열 삭제 후 컬럼 이동 반영)
  // 삭제 후 유동자금 내역: A=날짜, B=분류(구 C), C=항목(구 D), D=금액(구 E)
  const categories = {
    51: '병원비', 52: '차량관리', 53: '여행비',
    54: '가족경조사', 55: '지인경조사',
    57: '유입금', 58: '임시지출'
  };

  const updateData = [];
  Object.entries(categories).forEach(([rowNum, cat]) => {
    const formulas = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? 2027 : 2026;
      return `=SUMIFS('유동자금 내역'!$D:$D,'유동자금 내역'!$B:$B,"${cat}",'유동자금 내역'!$A:$A,">="&DATE(2026,${month},1),'유동자금 내역'!$A:$A,"<"&DATE(${nextYear},${nextMonth},1))`;
    });
    updateData.push({ range: `2026!F${rowNum}:Q${rowNum}`, values: [formulas] });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updateData }
  });
  console.log('Step 1: 2026 탭 수식 업데이트 완료 (새 컬럼 기준)');

  // Step 2: 유동자금 내역 B열(월) 삭제
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: 669432140, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }
        }
      }]
    }
  });
  console.log('Step 2: B열(월) 삭제 완료');

  // Step 3: 검증
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '2026!E51:Q58'
  });
  console.log('\n=== 2026 탭 유동자금 업데이트 후 값 ===');
  (r.data.values || []).forEach((row, i) => console.log('R' + (i + 51) + ':', row.join(' | ')));
}
main().catch(e => console.error(e.message));
