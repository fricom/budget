const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

const RULES = [
  { category: '교통', keywords: ['톨비','주유','주차','택시','대리비','지하철'] },
  { category: '생활', keywords: ['쿠팡 장','농협 장','레몬마트','이마트','코스트코','종량제','세탁','유연제','정수기','수세미','마스크','쌀','생수','탄산수','두루마리','정제수','캡슐','보리차','건전지','고무장갑','식용유','미숫가루','쿠팡장'] },
  { category: '자녀', keywords: ['진우','지원','기저귀','맘시터','어린이집','스승의날','나라돌봄'] },
  { category: '외식', keywords: ['저녁','점심','아침','맥도날드','파이브가이즈','아웃백','초밥','치킨','버거','꼬치','칼국수','회 ','오리고기','피자','샤브','이퓨레','김밥','타코','런던베이글','텐동','떡볶이','찜닭','베스킨','폴바셋','국밥','꼬치','볶음밥','한솥'] },
  { category: '여가', keywords: ['동물원','키즈룸','키즈카페','박물관','미술관','어린이대공원','뮤지엄','우주학교','레고카페','구름놀이','스페이스원','강강술래','가평','파주','파크 프리베'] },
  { category: '의료', keywords: ['약국','상비약','소화제','피로회복','숙취','양압기','오메가','구강청결','보조제'] },
  { category: '쇼핑', keywords: ['화장품','이케아','다이소','우산','이불','선반','상단장','알라딘','h&m','파자마','옷 ','크록스','양말','내복','드라이크리닝'] },
];

function categorize(item) {
  for (const rule of RULES) {
    if (rule.keywords.some(kw => item.includes(kw))) return rule.category;
  }
  return null;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '소비내역' });
  const rows = res.data.values || [];

  const counts = { 생활: 0, 자녀: 0, 외식: 0, 교통: 0, 여가: 0, 의료: 0, 쇼핑: 0 };

  for (const row of rows) {
    // 각 행에서 항목명(월별 col: 1,5,9,13,...인덱스)을 추출
    for (let col = 5; col < row.length; col += 4) {
      const item = (row[col] || '').trim();
      if (!item) continue;
      const cat = categorize(item);
      if (cat) counts[cat]++;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('\n카테고리별 빈도:');
  sorted.forEach(([cat, cnt]) => console.log(`  ${cat}: ${cnt}건`));

  return sorted.map(([name]) => name);
}

main().catch(e => console.error(e.message));
