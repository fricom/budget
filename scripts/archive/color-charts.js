const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const ANALYSIS_SHEET_ID = 1049613277;

const CHART_LINE = 509513795;
const CHART_PIE  = 1274769575;
const CHART_BAR  = 1187173014;

const CATEGORIES = ['생활', '자녀', '외식', '교통', '여가', '쇼핑', '의료'];
const MONTHS     = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CATEGORY_COLORS = {
  생활: { red: 0.671, green: 0.867, blue: 0.771 },
  자녀: { red: 1.000, green: 0.922, blue: 0.626 },
  외식: { red: 1.000, green: 0.800, blue: 0.600 },
  교통: { red: 0.630, green: 0.824, blue: 0.981 },
  여가: { red: 0.865, green: 0.704, blue: 0.892 },
  쇼핑: { red: 0.651, green: 0.908, blue: 0.941 },
  의료: { red: 1.000, green: 0.650, blue: 0.780 },
};

const RULES = [
  { category: '교통', keywords: ['톨비','주유','주차','택시','대리비','지하철'] },
  { category: '생활', keywords: ['쿠팡 장','농협 장','레몬마트','이마트','코스트코','종량제','세탁','유연제','정수기','수세미','마스크','쌀','생수','탄산수','두루마리','정제수','캡슐','보리차','건전지','고무장갑','식용유','미숫가루','쿠팡장','세차','우유','두유','와우멤버십','물티슈','브라운물티슈','국 소분용기','3구 반찬통','과일','채소','깻잎','계란','바디로션','염색약','샴푸','바디샴푸','파스타','편의점','탄산 수','돌돌이'] },
  { category: '자녀', keywords: ['진우','지원','기저귀','맘시터','어린이집','스승의날','나라돌봄','이서','조재영선생님','선생님 스승'] },
  { category: '외식', keywords: ['저녁','점심','아침','맥도날드','파이브가이즈','아웃백','초밥','치킨','버거','꼬치','칼국수','오리고기','피자','샤브','이퓨레','김밥','타코','런던베이글','텐도','떡볶이','찜닭','베스킨','폴바셋','국밥','볶음밥','한솥','소고기','회식','정육점','고기','윤주','진하 ','영진이네','은비영진','본죽','라면','젤리','호두과자','맥주','막걸리','왕사남','재하'] },
  { category: '여가', keywords: ['동물원','키즈룸','키즈카페','박물관','미술관','어린이대공원','뮤지엄','우주학교','레고카페','구름놀이','스페이스원','강강술래','가평','파주','파크 프리베','스타필드','현대프리미엄','더현대','상상나라'] },
  { category: '의료', keywords: ['약국','상비약','소화제','피로회복','숙취','양압기','오메가3','구강청결','보조제','밀크씨슬','윤혜 유산균','다이슨 필터'] },
  { category: '쇼핑', keywords: ['화장품','이케아','다이소','우산','이불','선반','상단장','알라딘','h&m','파자마','크록스','드라이크리닝','정수기필터','양복','문구','윤혜 커피'] },
];

function categorize(item) {
  const lower = item.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw.toLowerCase()))) return rule.category;
  }
  return null;
}

function parseAmount(str) {
  if (!str) return 0;
  const num = parseInt(str.replace(/[₩,\s]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 소비내역 집계
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '소비내역' });
  const rows = res.data.values || [];

  const monthlyByCategory = Array.from({ length: 12 }, () =>
    Object.fromEntries(CATEGORIES.map(c => [c, 0]))
  );

  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    for (let m = 0; m < 12; m++) {
      const colStart = 4 + m * 4;
      const item   = (row[colStart + 1] || '').trim();
      const amount = parseAmount(row[colStart + 2] || '');
      if (!item || !amount) continue;
      const cat = categorize(item);
      if (cat) monthlyByCategory[m][cat] += amount;
    }
  }

  // 전치 테이블 작성: O1:V14 (col 14~21, row 0~13)
  // col 14 = 월, col 15~21 = 카테고리별
  const transposed = [
    ['월', ...CATEGORIES],
    ...MONTHS.map((m, i) => [m, ...CATEGORIES.map(c => monthlyByCategory[i][c])]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '분석.그래프!O1',
    valueInputOption: 'RAW',
    requestBody: { values: transposed },
  });
  console.log('전치 테이블 작성 완료 (O1:V13)');

  // 카테고리 합계 (파이용)
  const categoryTotal = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (let m = 0; m < 12; m++) CATEGORIES.forEach(c => { categoryTotal[c] += monthlyByCategory[m][c]; });

  const requests = [
    // ── 라인 차트: 색상만 업데이트 ──
    {
      updateChartSpec: {
        chartId: CHART_LINE,
        spec: {
          title: '월별 지출 추이',
          basicChart: {
            chartType: 'LINE',
            legendPosition: 'NO_LEGEND',
            axis: [
              { position: 'BOTTOM_AXIS', title: '월' },
              { position: 'LEFT_AXIS',   title: '지출 (원)' },
            ],
            domains: [{
              domain: { sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 1, endRowIndex: 13, startColumnIndex: 0, endColumnIndex: 1 }] } },
            }],
            series: [{
              series: { sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 1, endRowIndex: 13, startColumnIndex: 1, endColumnIndex: 2 }] } },
              targetAxis: 'LEFT_AXIS',
              colorStyle: { rgbColor: { red: 0.259, green: 0.647, blue: 0.961 } },
              lineStyle: { width: 3 },
            }],
            headerCount: 1,
          },
        },
      },
    },

    // ── 파이 차트: 스펙 유지 (API 슬라이스 색상 미지원) ──
    {
      updateChartSpec: {
        chartId: CHART_PIE,
        spec: {
          title: '카테고리별 지출 비율',
          pieChart: {
            legendPosition: 'RIGHT_LEGEND',
            threeDimensional: false,
            domain: { sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 17, endRowIndex: 24, startColumnIndex: 0, endColumnIndex: 1 }] } },
            series: { sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 17, endRowIndex: 24, startColumnIndex: 1, endColumnIndex: 2 }] } },
          },
        },
      },
    },

    // ── 누적 컬럼 차트: 전치 테이블 기반, 카테고리 색상 ──
    {
      updateChartSpec: {
        chartId: CHART_BAR,
        spec: {
          title: '카테고리별 월별 지출',
          basicChart: {
            chartType: 'COLUMN',
            stackedType: 'STACKED',
            legendPosition: 'BOTTOM_LEGEND',
            axis: [
              { position: 'BOTTOM_AXIS', title: '월' },
              { position: 'LEFT_AXIS',   title: '지출 (원)' },
            ],
            domains: [{
              domain: {
                sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 1, endRowIndex: 13, startColumnIndex: 14, endColumnIndex: 15 }] },
              },
            }],
            series: CATEGORIES.map((cat, i) => ({
              series: {
                sourceRange: { sources: [{ sheetId: ANALYSIS_SHEET_ID, startRowIndex: 1, endRowIndex: 13, startColumnIndex: 15 + i, endColumnIndex: 16 + i }] },
              },
              targetAxis: 'LEFT_AXIS',
              colorStyle: { rgbColor: CATEGORY_COLORS[cat] },
            })),
            headerCount: 1,
          },
        },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  console.log('차트 색상 업데이트 완료');
}

main().catch(e => console.error(e.message));
