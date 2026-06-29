const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 775397077;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const requests = [
    // 전체 월 컬럼 자동 너비 (col 4~51, 12개월×4열)
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId: SHEET_ID,
          dimension: 'COLUMNS',
          startIndex: 4,
          endIndex: 52,
        },
      },
    },
    // 항목 열(col+2) 좌측 정렬 — 12개월
    ...Array.from({ length: 12 }, (_, m) => ({
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: 2,
          endRowIndex: 100,
          startColumnIndex: 4 + m * 4 + 2,
          endColumnIndex: 4 + m * 4 + 3,
        },
        cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    })),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('완료! 자동 너비 + 항목 좌측 정렬 적용');
}

main().catch(e => console.error(e.message));
