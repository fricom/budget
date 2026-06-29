const { google } = require('googleapis');
const path = require('path');

const ID       = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

const BLOCK_W   = 5;
const DATA_ROWS = 30;
const ROW_MONTH = 2;
const ROW_COL   = 3;
const ROW_DS    = 4;
const ROW_DE    = ROW_DS + DATA_ROWS - 1;
const ROW_SUM   = ROW_DE + 1;

const cDate = m => (m - 1) * BLOCK_W;
const cAmt  = m => (m - 1) * BLOCK_W + 3;

const rgb = (r, g, b) => ({ red: r/255, green: g/255, blue: b/255 });

// 초록 팔레트 (최초 버전)
const C = {
  headerBg : rgb(84,  130, 53),   // 짙은 초록 — 월 헤더
  headerFg : { red:1, green:1, blue:1 },
  colHdrBg : rgb(198, 224, 180),  // 연초록 — 컬럼 헤더
  sumBg    : rgb(255, 242, 204),  // 연노랑 — 합계
  dataBg   : { red:1, green:1, blue:1 },
  borderOut: rgb(84,  130, 53),   // 짙은 초록 — 아웃라인
  borderIn : rgb(217, 217, 217),  // 연회색 — 내부선
  black    : { red:0, green:0, blue:0 },
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === '게릴라지출');
  const GID = sheet.properties.sheetId;

  const requests = [];

  for (let m = 1; m <= 12; m++) {
    const cd = cDate(m), ca = cAmt(m);
    const mhR = ROW_MONTH - 1;
    const chR = ROW_COL - 1;
    const dsR = ROW_DS - 1;
    const deR = ROW_DE;
    const srR = ROW_SUM - 1;

    // 월 헤더: 거의 검정 + 흰 굵은 글씨
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: mhR, endRowIndex: mhR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.headerBg,
            textFormat: { bold: true, fontSize: 11, foregroundColor: C.headerFg },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // 컬럼 헤더: 연회색 + 검정 굵은 글씨
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: chR, endRowIndex: chR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.colHdrBg,
            textFormat: { bold: true, foregroundColor: C.black },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 데이터 영역: 흰 배경
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: dsR, endRowIndex: deR, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.dataBg,
            textFormat: { foregroundColor: C.black },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // 합계 행: 중간 회색
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: srR, endRowIndex: srR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.sumBg,
            textFormat: { bold: true, foregroundColor: C.black },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // 합계 금액 통화 포맷
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: srR, endRowIndex: srR+1, startColumnIndex: ca, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // 아웃라인 보더
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: mhR, endRowIndex: srR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        top:    { style: 'SOLID_MEDIUM', color: C.borderOut },
        bottom: { style: 'SOLID_MEDIUM', color: C.borderOut },
        left:   { style: 'SOLID_MEDIUM', color: C.borderOut },
        right:  { style: 'SOLID_MEDIUM', color: C.borderOut },
      },
    });

    // 내부 선
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: dsR, endRowIndex: srR, startColumnIndex: cd, endColumnIndex: ca+1 },
        innerHorizontal: { style: 'SOLID', color: C.borderIn },
        innerVertical:   { style: 'SOLID', color: C.borderIn },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });
  console.log('✓ 모노톤 색상 적용');
}

main().catch(e => { console.error(e.message); process.exit(1); });
