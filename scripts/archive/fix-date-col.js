const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 669432140;

  // 1. 현재 A열 날짜 문자열 읽기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '유동자금 내역!A4:A138',
  });
  const rows = res.data.values || [];

  // 2. "2026.01.01" → "2026-01-01" 변환 후 다시 쓰기 (Sheets가 날짜로 인식)
  const converted = rows.map(row => {
    const v = (row[0] || '').trim();
    if (!v) return [''];
    // 2026.01.01 → 2026-01-01
    return [v.replace(/\./g, '-')];
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '유동자금 내역!A4:A138',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: converted },
  });

  // 3. A열 날짜 포맷 적용 (YYYY.MM.DD)
  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 138, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE', pattern: 'yyyy.mm.dd' },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    // 4. B열 수식 → =MONTH(A4) 로 변경
    ...Array.from({ length: 135 }, (_, i) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: i + 3, endRowIndex: i + 4, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredValue: { formulaValue: `=IF(A${i+4}="","",MONTH(A${i+4}))` },
        },
        fields: 'userEnteredValue',
      },
    })),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('날짜 변환 및 포맷 적용 완료');
}
main().catch(e => console.error(e.message));
