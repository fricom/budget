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

const WHITE = { red: 1, green: 1, blue: 1 };

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

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '소비내역' });
  const rows = res.data.values || [];

  const valueUpdates = [];
  const colorRequests = [];

  // 헤더 행(row 2, index 1): 날짜 | 카테고리 | 항목 | 금액
  for (let m = 0; m < 12; m++) {
    const c0 = 4 + m * 4; // 날짜
    const c1 = c0 + 1;    // 카테고리 (이동)
    const c2 = c0 + 2;    // 항목
    const c3 = c0 + 3;    // 금액

    valueUpdates.push({
      range: `소비내역!${colToLetter(c1)}2:${colToLetter(c3)}2`,
      values: [['카테고리', '항목', '금액']],
    });

    // 헤더 카테고리 셀 스타일
    colorRequests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: c1, endColumnIndex: c2 },
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

    // 헤더 항목/금액 셀 색상 초기화
    colorRequests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: c2, endColumnIndex: c3 + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
            textFormat: { bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  // 데이터 행: 재배치 + 색상 정리
  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    for (let m = 0; m < 12; m++) {
      const c0 = 4 + m * 4;
      const oldItem   = (row[c0 + 1] || '').trim(); // 기존 항목
      const oldAmount = (row[c0 + 2] || '').trim(); // 기존 금액
      const oldCat    = (row[c0 + 3] || '').trim(); // 기존 카테고리

      if (!oldItem && !oldCat) continue;

      const c1 = c0 + 1; // 카테고리
      const c2 = c0 + 2; // 항목
      const c3 = c0 + 3; // 금액

      // 날짜|카테고리|항목|금액 순으로 재기록
      valueUpdates.push({
        range: `소비내역!${colToLetter(c1)}${rowIdx + 1}:${colToLetter(c3)}${rowIdx + 1}`,
        values: [[oldCat, oldItem, oldAmount]],
      });

      // 날짜 셀 색상 초기화
      colorRequests.push({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: c0, endColumnIndex: c0 + 1 },
          cell: { userEnteredFormat: { backgroundColor: WHITE } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });

      // 카테고리 셀: 색상 적용
      const catColor = CATEGORY_COLORS[oldCat] || WHITE;
      colorRequests.push({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: c1, endColumnIndex: c1 + 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: catColor,
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
        },
      });

      // 항목/금액 셀 색상 초기화
      colorRequests.push({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: c2, endColumnIndex: c3 + 1 },
          cell: { userEnteredFormat: { backgroundColor: WHITE } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
  }

  const CHUNK = 50;
  for (let i = 0; i < valueUpdates.length; i += CHUNK) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: valueUpdates.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r텍스트 ${Math.min(i + CHUNK, valueUpdates.length)}/${valueUpdates.length}`);
  }

  for (let i = 0; i < colorRequests.length; i += CHUNK) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: colorRequests.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r색상 ${Math.min(i + CHUNK, colorRequests.length)}/${colorRequests.length}`);
  }

  console.log('\n완료!');
}

main().catch(e => console.error(e.message));
