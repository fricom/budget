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

  const valueUpdates = [];  // 텍스트 업데이트
  const colorRequests = []; // 색상 업데이트

  // 헤더 행(row 2, index 1)에 각 월 카테고리 헤더 추가
  for (let m = 0; m < 12; m++) {
    const catCol = 4 + m * 4 + 3; // 구분 열
    const colLetter = colToLetter(catCol);
    valueUpdates.push({ range: `소비내역!${colLetter}2`, values: [['카테고리']] });

    // 헤더 셀 스타일
    colorRequests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: catCol, endColumnIndex: catCol + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.267, green: 0.267, blue: 0.267 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });
  }

  // 각 거래 행에 카테고리 텍스트 + 색상
  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    for (let m = 0; m < 12; m++) {
      const colStart = 4 + m * 4;
      const catCol   = colStart + 3;
      const item     = (row[colStart + 1] || '').trim();
      if (!item) continue;

      const cat = categorize(item);
      if (!cat) continue;

      const colLetter = colToLetter(catCol);
      valueUpdates.push({
        range: `소비내역!${colLetter}${rowIdx + 1}`,
        values: [[cat]],
      });

      colorRequests.push({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: catCol, endColumnIndex: catCol + 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: CATEGORY_COLORS[cat],
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
        },
      });
    }
  }

  // 값 업데이트 (50개씩)
  const CHUNK = 50;
  for (let i = 0; i < valueUpdates.length; i += CHUNK) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: valueUpdates.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r텍스트 ${Math.min(i + CHUNK, valueUpdates.length)}/${valueUpdates.length}`);
  }

  // 색상 업데이트 (50개씩)
  for (let i = 0; i < colorRequests.length; i += CHUNK) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: colorRequests.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r색상 ${Math.min(i + CHUNK, colorRequests.length)}/${colorRequests.length}`);
  }

  console.log('\n완료!');
}

function colToLetter(col) {
  let letter = '';
  col += 1;
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

main().catch(e => console.error(e.message));
