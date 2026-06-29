const { google } = require('googleapis');
const path = require('path');
const ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 2026 탭 복사 → "2025" ─────────────────────────────────────
  const dupRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: SHEET_2026_ID,
          insertSheetIndex: 1,
          newSheetName: '2025',
        },
      }],
    },
  });
  const NEW_ID = dupRes.data.replies[0].duplicateSheet.properties.sheetId;
  console.log('✓ 2025 탭 생성 (sheetId:', NEW_ID, ')');

  // ── 2. 새 탭 전체 데이터 읽기 (A1:S75) ───────────────────────────
  const r = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: [`'2025'!A1:S75`],
    includeGridData: true,
  });
  const rows = r.data.sheets[0].data[0].rowData || [];

  // ── 3. 초기화 요청 수집 ──────────────────────────────────────────
  const requests = [];

  // F2: 연도 2026 → 2025
  requests.push({
    updateCells: {
      range: { sheetId: NEW_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 5, endColumnIndex: 6 },
      rows: [{ values: [{ userEnteredValue: { numberValue: 2025 } }] }],
      fields: 'userEnteredValue',
    },
  });

  rows.forEach((row, ri) => {
    const cells = row.values || [];
    cells.forEach((cell, ci) => {
      const uv = cell.userEnteredValue;
      if (!uv) return;

      const colLetter = String.fromCharCode(65 + ci);
      const isDataCol = ci >= 5 && ci <= 16; // F~Q
      const isSCol = ci === 18;              // S열
      const isRCol = ci === 17;              // R열 (건드리지 않음)

      // S열: 전부 0으로
      if (isSCol && uv.formulaValue) {
        requests.push({
          updateCells: {
            range: { sheetId: NEW_ID, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: ci, endColumnIndex: ci+1 },
            rows: [{ values: [{ userEnteredValue: { numberValue: 0 } }] }],
            fields: 'userEnteredValue',
          },
        });
        return;
      }

      // F~Q: 숫자값 초기화 + SUMIFS 수식 제거
      if (isDataCol) {
        if (uv.numberValue !== undefined) {
          // 직접 입력된 숫자값 → 비우기
          requests.push({
            updateCells: {
              range: { sheetId: NEW_ID, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: ci, endColumnIndex: ci+1 },
              rows: [{ values: [{}] }],
              fields: 'userEnteredValue',
            },
          });
        } else if (uv.formulaValue && uv.formulaValue.includes('SUMIFS')) {
          // SUMIFS 수식 → 비우기 (나중에 2025 유동자금 내역 연결 예정)
          requests.push({
            updateCells: {
              range: { sheetId: NEW_ID, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: ci, endColumnIndex: ci+1 },
              rows: [{ values: [{}] }],
              fields: 'userEnteredValue',
            },
          });
        }
      }
    });
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });
  console.log('✓ 연도 2025 변경');
  console.log('✓ F~Q 숫자값 초기화');
  console.log('✓ SUMIFS 수식 제거');
  console.log('✓ S열 0으로 처리');
  console.log('\n완료: 2025 탭 준비됨 (2026과 동일 형식, 데이터 입력 대기)');
}

main().catch(e => console.error(e.message));
