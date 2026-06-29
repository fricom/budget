/**
 * 여행예금(R44)과 가족 경조사비(R46)를 저축 → 비상금 섹션으로 이동
 *
 * 순서:
 *   1. R44, R46 수식/값 읽기
 *   2. R53 뒤에 2행 삽입 (R54, R55 생성, 비상금 스타일 상속)
 *   3. 새 R54/R55에 수식 쓰기
 *   4. 원본 R44, R46 내용 지우기
 *   5. R46(index 45) 삭제 → R44(index 43) 삭제
 *      (Google Sheets가 이후 수식 자동 업데이트)
 */
const { google } = require('googleapis');
const path = require('path');

const ID            = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE      = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 원본 수식 읽기 ────────────────────────────────────────────
  const src = await sheets.spreadsheets.get({
    spreadsheetId: ID,
    ranges: ["'2026'!E44:S44", "'2026'!E46:S46"],
    includeGridData: true,
  });

  // [row 44 cells, row 46 cells] — E=index0 … S=index14
  const [cells44, cells46] = src.data.sheets[0].data.map(d =>
    d.rowData?.[0]?.values || []
  );

  // 셀의 userEnteredValue를 배열로 추출
  function extractValues(cells, targetRow) {
    return cells.map((c, j) => {
      const uv = c.userEnteredValue;
      if (!uv) return null;

      if (uv.formulaValue) {
        // SUM(Fxx:Qxx)+Sxx  → 타겟 행 번호로 교체
        // '2025'!Rxx → 원본 행 번호 유지 (2025 시트는 안 바뀜)
        const formula = uv.formulaValue
          .replace(/\bSUM\(F\d+:Q\d+\)\+S\d+/g, `SUM(F${targetRow}:Q${targetRow})+S${targetRow}`);
        return { userEnteredValue: { formulaValue: formula } };
      }
      if (uv.numberValue !== undefined) return { userEnteredValue: { numberValue: uv.numberValue } };
      if (uv.stringValue  !== undefined) return { userEnteredValue: { stringValue:  uv.stringValue  } };
      return null;
    });
  }

  // 새 행 번호: insert 후 R54=여행예금, R55=가족경조사비
  const row44values = extractValues(cells44, 54);
  const row46values = extractValues(cells46, 55);

  console.log('✓ 수식 읽기 완료');
  console.log('  여행예금 E→S:', row44values.map(v => {
    if (!v) return '-';
    const uv = v.userEnteredValue;
    return uv.formulaValue?.slice(0,30) || uv.stringValue || uv.numberValue;
  }).join(' | '));

  // ── 2. R53 뒤에 2행 삽입 (index 53 = R54 위치에 삽입) ─────────
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        insertDimension: {
          range: { sheetId: SHEET_2026_ID, dimension: 'ROWS', startIndex: 53, endIndex: 55 },
          inheritFromBefore: true,   // R53(부모님 노후) 스타일 상속
        },
      }],
    },
  });
  console.log('✓ R54-R55 행 삽입');

  // ── 3. 수식 쓰기 + 원본 비우기 + 원본 행 삭제 ────────────────────
  const ECOL = 4;   // E열 index
  const SCOL = 19;  // S열 다음 index (exclusive: S=18, 포함하려면 19)

  // rows: null 제거 후 빈 셀은 {} 로 채움
  const makeRow = (values) => ({
    values: values.map(v => v || {}),
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [
        // 3-a. 새 R54에 여행예금 수식 쓰기
        {
          updateCells: {
            range: { sheetId: SHEET_2026_ID, startRowIndex: 53, endRowIndex: 54, startColumnIndex: ECOL, endColumnIndex: SCOL },
            rows: [makeRow(row44values)],
            fields: 'userEnteredValue',
          },
        },
        // 3-b. 새 R55에 가족 경조사비 수식 쓰기
        {
          updateCells: {
            range: { sheetId: SHEET_2026_ID, startRowIndex: 54, endRowIndex: 55, startColumnIndex: ECOL, endColumnIndex: SCOL },
            rows: [makeRow(row46values)],
            fields: 'userEnteredValue',
          },
        },
        // 3-c. 원본 R44 내용 지우기
        {
          updateCells: {
            range: { sheetId: SHEET_2026_ID, startRowIndex: 43, endRowIndex: 44, startColumnIndex: ECOL, endColumnIndex: SCOL },
            rows: [{ values: Array(SCOL - ECOL).fill({}) }],
            fields: 'userEnteredValue',
          },
        },
        // 3-d. 원본 R46 내용 지우기
        {
          updateCells: {
            range: { sheetId: SHEET_2026_ID, startRowIndex: 45, endRowIndex: 46, startColumnIndex: ECOL, endColumnIndex: SCOL },
            rows: [{ values: Array(SCOL - ECOL).fill({}) }],
            fields: 'userEnteredValue',
          },
        },
        // 3-e. 빈 R46 삭제 (index 45) — R44는 그대로 43
        {
          deleteDimension: {
            range: { sheetId: SHEET_2026_ID, dimension: 'ROWS', startIndex: 45, endIndex: 46 },
          },
        },
        // 3-f. 빈 R44 삭제 (index 43)
        {
          deleteDimension: {
            range: { sheetId: SHEET_2026_ID, dimension: 'ROWS', startIndex: 43, endIndex: 44 },
          },
        },
      ],
    },
  });
  console.log('✓ 이동 + 원본 삭제 완료');
  console.log('');
  console.log('최종 위치 (Google Sheets 자동 업데이트 포함):');
  console.log('  여행예금    → R52');
  console.log('  가족경조사비 → R53');
  console.log('  병원비/경조사/차량관리/파킹통장 → R54-R57 (변동 없음)');
  console.log('  비상금 합계  → R61 (변동 없음)');
}

main().catch(e => { console.error(e.message); process.exit(1); });
