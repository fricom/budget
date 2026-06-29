const { google } = require('googleapis');
const path = require('path');

const ID            = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE      = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_2026_ID = 1862606876;

const ROW_CATS = [
  [44, '여행예금'],
  [46, '가족경조사비'],
  [54, '병원비'],
  [55, '경조사'],
  [56, '차량관리'],
  [57, '파킹통장'],
];
const CAT_NAMES = ROW_CATS.map(([, c]) => c);
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// ── 레이아웃 상수 ────────────────────────────────────────────────
// 각 월 블록 = 날짜(0), 분류(1), 항목(2), 금액(3), 스페이서(4) = 5열
const BLOCK_W   = 5;
const DATA_ROWS = 30;

// 월 m(1-indexed) 컬럼 인덱스 (0-indexed)
const cDate  = m => (m - 1) * BLOCK_W;
const cCat   = m => (m - 1) * BLOCK_W + 1;
const cItem  = m => (m - 1) * BLOCK_W + 2;
const cAmt   = m => (m - 1) * BLOCK_W + 3;
const cSpace = m => (m - 1) * BLOCK_W + 4;

// 0-indexed 컬럼 → 알파벳 (A, B, …, Z, AA, AB, …)
function col(idx) {
  let r = '', n = idx + 1;
  while (n > 0) { r = String.fromCharCode(65 + (n - 1) % 26) + r; n = Math.floor((n - 1) / 26); }
  return r;
}

// 행 번호 (1-indexed)
const ROW_MONTH = 2;   // 월 헤더
const ROW_COL   = 3;   // 컬럼 헤더
const ROW_DS    = 4;   // 데이터 시작
const ROW_DE    = ROW_DS + DATA_ROWS - 1;  // 데이터 끝
const ROW_SUM   = ROW_DE + 1;              // 합계

const rgb = (r, g, b) => ({ red: r/255, green: g/255, blue: b/255 });

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 기존 데이터 읽기 ──────────────────────────────────────────
  console.log('기존 데이터 읽는 중...');
  const raw = await sheets.spreadsheets.values.get({
    spreadsheetId: ID,
    range: '게릴라지출!A2:E',
  });
  const allRows = raw.data.values || [];

  // 월별 파싱 (현재 세로 구조: 월헤더 행, 컬럼헤더 행, 데이터 행 반복)
  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = [];

  let curMonth = null;
  let isColHeader = false;
  for (const r of allRows) {
    const first = (r[0] || '').trim();
    // 월 헤더 감지 (예: "1월", "2월" …)
    const mMatch = first.match(/^(\d{1,2})월$/);
    if (mMatch) { curMonth = parseInt(mMatch[1]); isColHeader = true; continue; }
    if (isColHeader) { isColHeader = false; continue; } // 컬럼 헤더 행 스킵
    if (!curMonth) continue;
    if (first === '합계' || !first) continue;

    byMonth[curMonth].push({
      date:   r[0] || '',
      cat:    r[1] || '',
      item:   r[2] || '',
      amount: (r[3] || '').replace(/₩/g, '').replace(/,/g, ''),
    });
  }
  const total = Object.values(byMonth).reduce((s, v) => s + v.length, 0);
  console.log(`✓ 기존 데이터: ${total}행`);

  // ── 2. 기존 탭 삭제 + 새 탭 생성 ────────────────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const oldSheet = meta.data.sheets.find(s => s.properties.title === '게릴라지출');
  if (oldSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: oldSheet.properties.sheetId } }] },
    });
    console.log('✓ 기존 탭 삭제');
  }

  const totalCols = 12 * BLOCK_W;  // 60
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: '게릴라지출',
            gridProperties: { rowCount: ROW_SUM + 5, columnCount: totalCols },
          },
        },
      }],
    },
  });
  const GID = addRes.data.replies[0].addSheet.properties.sheetId;
  console.log('✓ 새 탭 생성 (sheetId:', GID, ')');

  // ── 3. 값 채우기 ─────────────────────────────────────────────────
  const valueData = [];

  for (let m = 1; m <= 12; m++) {
    const dc = col(cDate(m));
    const cc = col(cCat(m));
    const ic = col(cItem(m));
    const ac = col(cAmt(m));

    // 월 헤더
    valueData.push({ range: `게릴라지출!${dc}${ROW_MONTH}`, values: [[MONTH_NAMES[m-1]]] });
    // 컬럼 헤더
    valueData.push({ range: `게릴라지출!${dc}${ROW_COL}:${ac}${ROW_COL}`, values: [['날짜','분류','항목','금액']] });
    // 합계
    valueData.push({ range: `게릴라지출!${dc}${ROW_SUM}:${ac}${ROW_SUM}`, values: [['합계','','',`=SUM(${ac}${ROW_DS}:${ac}${ROW_DE})`]] });

    // 데이터
    const entries = byMonth[m].slice(0, DATA_ROWS);
    if (entries.length > 0) {
      valueData.push({
        range: `게릴라지출!${dc}${ROW_DS}:${ac}${ROW_DS + entries.length - 1}`,
        values: entries.map(e => [e.date, e.cat, e.item, e.amount]),
      });
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
  });
  console.log('✓ 값 입력');

  // ── 4. 포맷 ─────────────────────────────────────────────────────
  const requests = [];

  // 행 고정 (월/컬럼 헤더)
  requests.push({
    updateSheetProperties: {
      properties: { sheetId: GID, gridProperties: { frozenRowCount: ROW_COL } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // 1행 높이 (타이틀 여백)
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: GID, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 8 }, fields: 'pixelSize',
    },
  });

  for (let m = 1; m <= 12; m++) {
    const cd = cDate(m), cc = cCat(m), ci = cItem(m), ca = cAmt(m), cs = cSpace(m);
    const mhR = ROW_MONTH - 1;  // 0-indexed
    const chR = ROW_COL - 1;
    const dsR = ROW_DS - 1;
    const deR = ROW_DE;         // exclusive
    const srR = ROW_SUM - 1;

    // 열 너비: 날짜(90), 분류(90), 항목(150), 금액(90), 스페이서(10)
    [[cd,90],[cc,90],[ci,150],[ca,90],[cs,10]].forEach(([i,px]) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i+1 },
          properties: { pixelSize: px }, fields: 'pixelSize',
        },
      });
    });

    // 월 헤더 셀 병합 (날짜~금액 4열)
    requests.push({
      mergeCells: {
        range: { sheetId: GID, startRowIndex: mhR, endRowIndex: mhR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        mergeType: 'MERGE_ALL',
      },
    });

    // 월 헤더 스타일
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: mhR, endRowIndex: mhR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(84, 130, 53),
            textFormat: { bold: true, fontSize: 11, foregroundColor: {red:1,green:1,blue:1} },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // 컬럼 헤더 스타일
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: chR, endRowIndex: chR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(198, 224, 180),
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 금액 열 통화 포맷 (데이터 + 합계)
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: dsR, endRowIndex: srR+1, startColumnIndex: ca, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // 합계 행 스타일
    requests.push({
      repeatCell: {
        range: { sheetId: GID, startRowIndex: srR, endRowIndex: srR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(255, 242, 204),
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // 아웃라인 보더 (월헤더~합계)
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: mhR, endRowIndex: srR+1, startColumnIndex: cd, endColumnIndex: ca+1 },
        top:    { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        bottom: { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        left:   { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
        right:  { style: 'SOLID_MEDIUM', color: rgb(84,130,53) },
      },
    });

    // 데이터 안쪽 선
    requests.push({
      updateBorders: {
        range: { sheetId: GID, startRowIndex: dsR, endRowIndex: srR, startColumnIndex: cd, endColumnIndex: ca+1 },
        innerHorizontal: { style: 'SOLID', color: rgb(217,217,217) },
        innerVertical:   { style: 'SOLID', color: rgb(217,217,217) },
      },
    });

    // 분류 드롭다운
    requests.push({
      setDataValidation: {
        range: { sheetId: GID, startRowIndex: dsR, endRowIndex: deR, startColumnIndex: cc, endColumnIndex: cc+1 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: CAT_NAMES.map(c => ({ userEnteredValue: c })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: { requests },
  });
  console.log('✓ 포맷 적용');

  // ── 5. 2026 탭 SUMIFS 업데이트 ──────────────────────────────────
  const formulaData = [];
  for (const [sheetRow, cat] of ROW_CATS) {
    for (let m = 1; m <= 12; m++) {
      const aCol = col(cAmt(m));
      const bCol = col(cCat(m));
      const tCol = String.fromCharCode(64 + 5 + m); // 2026탭 F=1월 … Q=12월
      formulaData.push({
        range: `'2026'!${tCol}${sheetRow}`,
        values: [[`=SUMIFS('게릴라지출'!${aCol}${ROW_DS}:${aCol}${ROW_DE},'게릴라지출'!${bCol}${ROW_DS}:${bCol}${ROW_DE},"${cat}")`]],
      });
    }
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: formulaData },
  });
  console.log('✓ 2026 탭 SUMIFS 업데이트');

  console.log('\n─── 완료 ───');
  console.log(`레이아웃: 12개월 가로 배열 (${totalCols}열 × ${ROW_SUM}행)`);
  console.log(`마이그레이션: ${total}행`);
  console.log(`SUMIFS: 월별 독립 열 범위 (${col(cAmt(1))}${ROW_DS}:${col(cAmt(1))}${ROW_DE} … ${col(cAmt(12))}${ROW_DS}:${col(cAmt(12))}${ROW_DE})`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
