const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const GRAPH_SHEET_ID = 1049613277;
const CHART_LINE_ID  = 509513795;
const CHART_PIE_ID   = 1274769575;
const CHART_COL_ID   = 1187173014;

function src(sheetId, r1, r2, c1, c2) {
  return { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 };
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 데이터 열 너비 조정 (A-D 콤팩트, E이후 차트 영역) ─────
  const colWidths = [
    { col: 0, px: 90  }, // A — 라벨
    { col: 1, px: 100 }, // B — 값
    { col: 2, px: 100 }, // C — 예산
    { col: 3, px: 15  }, // D — 스페이서
  ];
  const widthRequests = colWidths.map(({ col, px }) => ({
    updateDimensionProperties: {
      range: { sheetId: GRAPH_SHEET_ID, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }));

  // ── 2. Table4 (A26:M34) → row 40 이하로 이동 (시야에서 제거) ──
  // 기존 Table4 내용 지우기
  const clearTable4 = {
    updateCells: {
      range: src(GRAPH_SHEET_ID, 24, 40, 0, 14),
      fields: 'userEnteredValue',
    },
  };

  // ── 3. 차트 위치 & 크기 재배치 ────────────────────────────────
  // 전체(상단): LINE — row 0, col 4 (E), 1060×360
  // 세부(하단): PIE — row 20, col 4 (E), 500×400
  //            COLUMN — row 20, col 10 (K), 700×400
  const chartRequests = [
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_LINE_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 0, columnIndex: 4 },
            widthPixels: 1060,
            heightPixels: 360,
          },
        },
        fields: '*',
      },
    },
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_PIE_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 20, columnIndex: 4 },
            widthPixels: 500,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_COL_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 20, columnIndex: 10 },
            widthPixels: 700,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [...widthRequests, clearTable4, ...chartRequests] },
  });
  console.log('✓ 데이터 열 너비 + 차트 레이아웃 완료');

  // ── 4. 섹션 레이블 추가 (A열 좌측 데이터 구역 정리) ──────────
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: '분석.그래프!A1',  values: [['[ 전체 ]']] },
        { range: '분석.그래프!A15', values: [['[ 세부 ]']] },
      ],
    },
  });
  console.log('✓ 섹션 레이블 설정');

  console.log('\n완료!');
  console.log('레이아웃:');
  console.log('  A-C열: 데이터 테이블 | D: 스페이서 | E열~: 차트');
  console.log('  상단(전체): LINE 차트 (월별 추이 + 예산 비교)');
  console.log('  하단(세부): PIE (카테고리 비율) + COLUMN (카테고리별 월별)');
}

main().catch(e => console.error(e.message));
