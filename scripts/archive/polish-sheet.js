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

// "2026.1.3" → Google Sheets 날짜 시리얼 넘버
function parseDate(str) {
  const m = str.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const epoch = new Date(1899, 11, 30);
  const date  = new Date(y, mo - 1, d);
  return Math.round((date - epoch) / 86400000);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const batchRequests = [];

  // ── 1. 행 고정 (row 1~3) ──────────────────────────────────────
  batchRequests.push({
    updateSheetProperties: {
      properties: { sheetId: SHEET_ID, gridProperties: { frozenRowCount: 3 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // ── 2. 잔액 음수 → 빨간 글씨 (row 90, 금액 열 12개) ──────────
  // 금액 열: 6*(m+1) for m 0~11
  for (let m = 0; m < 12; m++) {
    const colIdx = 6 * (m + 1);
    batchRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: SHEET_ID,
            startRowIndex: 89,
            endRowIndex: 90,
            startColumnIndex: colIdx,
            endColumnIndex: colIdx + 1,
          }],
          booleanRule: {
            condition: { type: 'NUMBER_LESS', values: [{ userEnteredValue: '0' }] },
            format: { textFormat: { foregroundColor: { red: 0.85, green: 0.11, blue: 0.11 } } },
          },
        },
        index: 0,
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: batchRequests },
  });
  console.log('✓ 행 고정 + 잔액 음수 빨간 글씨 적용');

  // ── 4. 날짜 텍스트 → 실제 날짜 값 변환 ──────────────────────
  // 날짜 열: 3 + m*6 (m: 0~11)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '소비내역!A1:BZ88',
  });
  const rows = res.data.values || [];

  const dateFormatRequests = [];
  const dateValueUpdates  = [];

  for (let m = 0; m < 12; m++) {
    const dateColIdx = 3 + m * 6;
    const col = colLetter(dateColIdx);
    const updates = [];

    for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx] || [];
      const raw = (row[dateColIdx] || '').trim();
      const serial = parseDate(raw);
      if (serial === null) continue;
      updates.push([serial]);
    }

    if (updates.length === 0) continue;

    dateValueUpdates.push({
      range: `소비내역!${col}4:${col}${3 + updates.length}`,
      values: updates,
    });

    // 날짜 형식 적용
    dateFormatRequests.push({
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: 3,
          endRowIndex: 3 + updates.length,
          startColumnIndex: dateColIdx,
          endColumnIndex: dateColIdx + 1,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE', pattern: 'yyyy.m.d' },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  if (dateValueUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: dateValueUpdates },
    });
  }

  if (dateFormatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: dateFormatRequests },
    });
  }
  console.log('✓ 날짜 텍스트 → 날짜 값 변환 완료');

  console.log('\n전체 완료!');
}

main().catch(e => console.error(e.message));
