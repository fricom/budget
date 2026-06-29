const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const ANALYSIS_SHEET_ID = 1049613277;

// 기존 차트 ID
const CHART_LINE = 509513795;
const CHART_PIE  = 1274769575;
const CHART_BAR  = 1187173014;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const requests = [
    // 라인 차트: 데이터 아래 상단, 전체 너비
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_LINE,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: ANALYSIS_SHEET_ID, rowIndex: 35, columnIndex: 0 },
            offsetXPixels: 0,
            offsetYPixels: 0,
            widthPixels: 1160,
            heightPixels: 360,
          },
        },
        fields: '*',
      },
    },
    // 파이 차트: 하단 왼쪽
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_PIE,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: ANALYSIS_SHEET_ID, rowIndex: 57, columnIndex: 0 },
            offsetXPixels: 0,
            offsetYPixels: 0,
            widthPixels: 520,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
    // 누적 바 차트: 하단 오른쪽
    {
      updateEmbeddedObjectPosition: {
        objectId: CHART_BAR,
        newPosition: {
          overlayPosition: {
            anchorCell: { sheetId: ANALYSIS_SHEET_ID, rowIndex: 57, columnIndex: 9 },
            offsetXPixels: 0,
            offsetYPixels: 0,
            widthPixels: 640,
            heightPixels: 400,
          },
        },
        fields: '*',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('차트 재배치 완료');
  console.log('  📈 월별 지출 추이: 상단 전체 너비 (1160×360)');
  console.log('  🥧 카테고리 비율: 하단 좌 (520×400)');
  console.log('  📊 카테고리별 월별: 하단 우 (640×400)');
}

main().catch(e => console.error(e.message));
