const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

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
  { category: '외식', keywords: ['저녁','점심','아침','맥도날드','파이브가이즈','아웃백','초밥','치킨','버거','꼬치','칼국수','오리고기','피자','샤브','이퓨레','김밥','타코','런던베이글','텐동','떡볶이','찜닭','베스킨','폴바셋','국밥','볶음밥','한솥','소고기','회식','정육점','고기','윤주','진하 ','영진이네','은비영진','본죽','라면','젤리','호두과자','맥주','막걸리','왕사남','재하'] },
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

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '소비내역' });
  const rows = res.data.values || [];

  const colorRequests = [];
  const counts = Object.fromEntries(Object.keys(CATEGORY_COLORS).map(k => [k, 0]));
  let unmatched = [];

  // 데이터는 row 3(index 2)부터 시작, 월별 블록: startCol=4, 각 월마다 +4
  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length === 0) continue;

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const colStart = 4 + monthIdx * 4;
      const itemCol = colStart + 1;
      const item = (row[itemCol] || '').trim();
      if (!item) continue;

      const cat = categorize(item);
      if (!cat) {
        unmatched.push(item);
        continue;
      }

      counts[cat]++;
      const color = CATEGORY_COLORS[cat];

      // 날짜 + 항목 + 금액 셀 3개에 색상 적용
      colorRequests.push({
        repeatCell: {
          range: {
            sheetId: SHEET_ID,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: colStart,
            endColumnIndex: colStart + 3,
          },
          cell: { userEnteredFormat: { backgroundColor: color } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
  }

  // 50개씩 나눠서 batchUpdate
  const CHUNK = 50;
  for (let i = 0; i < colorRequests.length; i += CHUNK) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: colorRequests.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r진행 중... ${Math.min(i + CHUNK, colorRequests.length)}/${colorRequests.length}`);
  }

  console.log('\n\n카테고리별 매핑 결과:');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([cat, cnt]) => console.log(`  ${cat}: ${cnt}건`));

  if (unmatched.length > 0) {
    console.log(`\n미분류 항목 (${unmatched.length}건):`);
    [...new Set(unmatched)].forEach(i => console.log(`  - ${i}`));
  }
}

main().catch(e => console.error(e.message));
