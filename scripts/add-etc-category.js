const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const CONSUMPTION_SHEET_ID = 775397077; // 2026 소비내역
const GRAPH_SHEET_ID = 1049613277;      // 분석.그래프

const CATEGORIES = ['생활', '자녀', '외식', '교통', '여가', '쇼핑', '의료', '기타'];

// 월별 카테고리 열 (0-based colIndex), 금액 열
const months = [
  { catCol: 'E', sumCol: 'G' },   // 1월
  { catCol: 'K', sumCol: 'M' },   // 2월
  { catCol: 'Q', sumCol: 'S' },   // 3월
  { catCol: 'W', sumCol: 'Y' },   // 4월
  { catCol: 'AC', sumCol: 'AE' }, // 5월
  { catCol: 'AI', sumCol: 'AK' }, // 6월
  { catCol: 'AO', sumCol: 'AQ' }, // 7월
  { catCol: 'AU', sumCol: 'AW' }, // 8월
  { catCol: 'BA', sumCol: 'BC' }, // 9월
  { catCol: 'BG', sumCol: 'BI' }, // 10월
  { catCol: 'BM', sumCol: 'BO' }, // 11월
  { catCol: 'BS', sumCol: 'BU' }, // 12월
];

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1; // 0-based
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. 카테고리 열 드롭다운에 "기타" 추가 (12개월, R4:R103)
  const validationRequests = months.map(({ catCol }) => ({
    setDataValidation: {
      range: {
        sheetId: CONSUMPTION_SHEET_ID,
        startRowIndex: 3, endRowIndex: 103,
        startColumnIndex: colIndex(catCol), endColumnIndex: colIndex(catCol) + 1,
      },
      rule: {
        condition: { type: 'ONE_OF_LIST', values: CATEGORIES.map(v => ({ userEnteredValue: v })) },
        showCustomUi: true,
      },
    },
  }));

  // 2. 오분류 2건 수정 (재하 옷 답례딸기 → 기타, 왕사남 → 여가)
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '2026 소비내역!Q73', values: [['기타']] },
        { range: '2026 소비내역!W77', values: [['여가']] },
      ],
    },
  });
  console.log('✓ 오분류 2건 수정 완료 (Q73→기타, W77→여가)');

  // 3. 분석.그래프 Table2(카테고리별 월별) J열에 "기타" SUMIF 추가
  const jFormulas = months.map(({ catCol, sumCol }) =>
    [`=SUMIF('2026 소비내역'!${catCol}$4:${catCol}$1011,"기타",'2026 소비내역'!${sumCol}$4:${sumCol}$1011)`]
  );
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '분석.그래프!J45', values: [['기타']] },
        { range: '분석.그래프!J46:J57', values: jFormulas },
        { range: '분석.그래프!B31', values: [['기타']] },
        { range: '분석.그래프!C31', values: [['=SUM(J46:J57)']] },
      ],
    },
  });
  console.log('✓ 분석.그래프 기타 열/행 수식 추가 완료');

  // 4. 드롭다운 검증 + 차트 series/도메인 확장 (batchUpdate)
  const chartRes = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ['분석.그래프'],
    fields: 'sheets(charts(chartId,spec))',
  });
  const charts = chartRes.data.sheets[0].charts;
  const pieChart = charts.find(c => c.spec.pieChart);
  const colChart = charts.find(c => c.spec.basicChart && c.spec.basicChart.chartType === 'COLUMN');

  const newColSeries = JSON.parse(JSON.stringify(colChart.spec.basicChart.series[colChart.spec.basicChart.series.length - 1]));
  newColSeries.series.sourceRange.sources[0].startColumnIndex = 9; // J
  newColSeries.series.sourceRange.sources[0].endColumnIndex = 10;
  newColSeries.color = { red: 0.8, green: 0.8, blue: 0.8 };
  newColSeries.colorStyle = { rgbColor: { red: 0.8, green: 0.8, blue: 0.8 } };

  const updatedColSpec = JSON.parse(JSON.stringify(colChart.spec));
  updatedColSpec.basicChart.series.push(newColSeries);

  const updatedPieSpec = JSON.parse(JSON.stringify(pieChart.spec));
  updatedPieSpec.pieChart.domain.sourceRange.sources[0].endRowIndex = 31;
  updatedPieSpec.pieChart.series.sourceRange.sources[0].endRowIndex = 31;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        ...validationRequests,
        { updateChartSpec: { chartId: colChart.chartId, spec: updatedColSpec } },
        { updateChartSpec: { chartId: pieChart.chartId, spec: updatedPieSpec } },
      ],
    },
  });
  console.log('✓ 드롭다운 검증(12개월) + COLUMN/PIE 차트 기타 계열 추가 완료');
}
main().catch(e => console.error(e.message));
