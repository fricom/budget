const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;
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

  // 헤더 row2: 항목/금액 복원, 카테고리 열 비우기
  for (let m = 0; m < 12; m++) {
    const c0 = 4 + m * 4;
    valueUpdates.push({
      range: `소비내역!${colToLetter(c0+1)}2:${colToLetter(c0+3)}2`,
      values: [['항목', '금액', '']],
    });
  }

  // 데이터 행: item(col+2)→col+1, amount(col+3)→col+2, col+3 비우기
  for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    for (let m = 0; m < 12; m++) {
      const c0     = 4 + m * 4;
      const item   = (row[c0 + 2] || '').trim();
      const amount = (row[c0 + 3] || '').trim();

      if (!item && !amount) continue;

      valueUpdates.push({
        range: `소비내역!${colToLetter(c0+1)}${rowIdx+1}:${colToLetter(c0+3)}${rowIdx+1}`,
        values: [[item, amount, '']],
      });
    }

    // 해당 행 전체 색상 초기화 (col 4~51)
    colorRequests.push({
      repeatCell: {
        range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 4, endColumnIndex: 52 },
        cell: { userEnteredFormat: { backgroundColor: WHITE } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  // 헤더 row2 색상도 초기화
  colorRequests.push({
    repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 4, endColumnIndex: 52 },
      cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { bold: false, foregroundColor: { red: 0, green: 0, blue: 0 } } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // 열 너비 원래대로 (기본값)
  const widthRequests = Array.from({ length: 12 }, (_, m) => [
    { col: 4 + m * 4,     px: 80  }, // 날짜
    { col: 4 + m * 4 + 1, px: 180 }, // 항목
    { col: 4 + m * 4 + 2, px: 90  }, // 금액
    { col: 4 + m * 4 + 3, px: 20  }, // 구분 (좁게)
  ]).flat().map(({ col, px }) => ({
    updateDimensionProperties: {
      range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }));

  // 실행
  const CHUNK = 50;
  for (let i = 0; i < valueUpdates.length; i += CHUNK) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: valueUpdates.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r데이터 ${Math.min(i + CHUNK, valueUpdates.length)}/${valueUpdates.length}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [...colorRequests, ...widthRequests] },
  });

  console.log('\n완료! 원상복귀됐습니다.');
}

main().catch(e => console.error(e.message));
