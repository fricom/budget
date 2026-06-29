const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const GRAPH_SHEET_ID = 1049613277;
const CHART_LINE_ID   = 509513795;
const CHART_PIE_ID    = 1274769575;
const CHART_COL_ID    = 1187173014;

const CATEGORIES = ['생활', '자녀', '외식', '교통', '여가', '쇼핑', '의료'];
const BUDGET_COLS = ['D','E','F','G','H','I','J','K','L','M','N','O'];

function colLetter(idx) {
  let letter = '';
  idx += 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    idx = Math.floor((idx - 1) / 26);
  }
  return letter;
}

function src(startRow, endRow, startCol, endCol) {
  return { sheetId: GRAPH_SHEET_ID, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol };
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 데이터 테이블 수식 연동 ─────────────────────────────────

  // Table1 B3:B14 — 월별 총 지출 (소비내역 합계 행 직접 참조)
  const table1 = Array.from({ length: 12 }, (_, m) => {
    const col = colLetter(6 * (m + 1));
    return [`='소비내역'!${col}89`];
  });

  // Table1 예산 열 — C2: 헤더, C3:C14: 년 단위 가계세팅 생활비
  const budgetHeader = [['예산']];
  const budgetValues = BUDGET_COLS.map(c => [`='년 단위 가계세팅'!${c}27`]);

  // Table2 P2:V13 — 카테고리별 월별 SUMIF
  // 소비내역 cat col: 4+m*6, amt col: 6*(m+1)
  const table2Rows = Array.from({ length: 12 }, (_, m) => {
    const catCol = colLetter(4 + m * 6);
    const amtCol = colLetter(6 * (m + 1));
    return CATEGORIES.map(cat =>
      `=SUMIF('소비내역'!${catCol}$4:${catCol}$88,"${cat}",'소비내역'!${amtCol}$4:${amtCol}$88)`
    );
  });

  // Table3 B18:B24 — 카테고리별 합계 (Table2 열 합계)
  const catTotalCols = ['P','Q','R','S','T','U','V'];
  const table3 = catTotalCols.map(c => [`=SUM(${c}2:${c}13)`]);

  // Table4 B28:M34 — 카테고리별 월별 (Table2 전치 참조)
  const table4Rows = CATEGORIES.map((_, ci) => {
    const col = catTotalCols[ci];
    return Array.from({ length: 12 }, (_, m) => `=${col}${m + 2}`);
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '분석.그래프!B3:B14',  values: table1 },
        { range: '분석.그래프!C2:C2',   values: budgetHeader },
        { range: '분석.그래프!C3:C14',  values: budgetValues },
        { range: '분석.그래프!P2:V13',  values: table2Rows },
        { range: '분석.그래프!B18:B24', values: table3 },
        { range: '분석.그래프!B28:M34', values: table4Rows },
      ],
    },
  });
  console.log('✓ 데이터 테이블 소비내역 연동 완료');

  // ── 2 & 3. 차트 위치 + LINE 예산 비교선 추가 ──────────────────
  const chartRequests = [
    // LINE 차트: 상단 배치 + 예산 시리즈 추가 + 레전드
    {
      updateChartSpec: {
        chartId: CHART_LINE_ID,
        spec: {
          title: '월별 지출 추이',
          basicChart: {
            chartType: 'LINE',
            legendPosition: 'TOP_LEGEND',
            headerCount: 1,
            axis: [
              { position: 'BOTTOM_AXIS', title: '월' },
              { position: 'LEFT_AXIS',   title: '지출 (원)' },
            ],
            domains: [{ domain: { sourceRange: { sources: [src(1, 14, 0, 1)] } } }],
            series: [
              {
                series: { sourceRange: { sources: [src(1, 14, 1, 2)] } },
                targetAxis: 'LEFT_AXIS',
                lineStyle: { width: 3 },
                color: { red: 0.259, green: 0.643, blue: 0.961 },
              },
              {
                series: { sourceRange: { sources: [src(1, 14, 2, 3)] } },
                targetAxis: 'LEFT_AXIS',
                lineStyle: { width: 2 },
                color: { red: 0.85, green: 0.33, blue: 0.33 },
              },
            ],
          },
        },
      },
    },
    // LINE 차트 위치: 최상단
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_LINE_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 0, columnIndex: 0 },
            widthPixels: 1160,
            heightPixels: 360,
          },
        },
        fields: '*',
      },
    },
    // PIE 차트 위치
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_PIE_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 20, columnIndex: 0 },
            widthPixels: 520,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
    // COLUMN 차트 위치
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_COL_ID,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: GRAPH_SHEET_ID, rowIndex: 20, columnIndex: 9 },
            widthPixels: 640,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: chartRequests },
  });
  console.log('✓ 차트 위치 조정 + 예산 비교선 추가 완료');
  console.log('\n전체 완료!');
}

main().catch(e => console.error(e.message));
