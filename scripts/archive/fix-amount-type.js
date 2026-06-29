const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

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

function parseAmount(str) {
  if (!str) return null;
  const n = Number(str.replace(/[₩,\s]/g, ''));
  return isNaN(n) ? null : n;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 금액 열 col index: 6 + m*5
  const amountCols = Array.from({ length: 12 }, (_, m) => 6 + m * 5);

  // 전체 시트 읽기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '소비내역!A1:BZ88',
  });
  const rows = res.data.values || [];

  const valueUpdates = [];
  const formatRequests = [];

  for (const colIdx of amountCols) {
    const col = colLetter(colIdx);
    const updates = [];

    for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) { // row 4부터 (0-indexed: 3)
      const row = rows[rowIdx] || [];
      const raw = (row[colIdx] || '').trim();
      const num = parseAmount(raw);
      if (num === null) continue;

      updates.push([num]);
    }

    if (updates.length > 0) {
      valueUpdates.push({
        range: `소비내역!${col}4:${col}${3 + updates.length}`,
        values: updates,
      });
    }

    // 통화 형식 적용 (데이터 범위)
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: 3,
          endRowIndex: 88,
          startColumnIndex: colIdx,
          endColumnIndex: colIdx + 1,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  // 값 업데이트
  const CHUNK = 20;
  for (let i = 0; i < valueUpdates.length; i += CHUNK) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: valueUpdates.slice(i, i + CHUNK) },
    });
    process.stdout.write(`\r값 변환 ${Math.min(i + CHUNK, valueUpdates.length)}/${valueUpdates.length}`);
  }

  // 형식 적용
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: formatRequests },
  });

  console.log('\n완료! 금액 숫자 변환 + 통화 형식 적용');
}

main().catch(e => console.error(e.message));
