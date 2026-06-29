const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

function rgb(hex) {
  return { red: parseInt(hex.slice(1,3),16)/255, green: parseInt(hex.slice(3,5),16)/255, blue: parseInt(hex.slice(5,7),16)/255 };
}

const COLORS = {
  지원: '#e7fff5',
  윤혜: '#f5ffe7',
  아이: '#fffde7',
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 1862606876;

  const requests = [];

  // 보험 섹션 태그 assignments (행: 사람)
  const tags = [
    // [startRow, endRow, person]
    [15, 20, '지원'],
    [21, 27, '윤혜'],
    [28, 28, '아이'],
  ];

  for (const [start, end, person] of tags) {
    const color = rgb(COLORS[person]);

    // A열 태그 텍스트 + 스타일
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: start-1, endRowIndex: end, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredValue: { stringValue: person },
          userEnteredFormat: {
            backgroundColor: color,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    });

    // C열 배경색 제거 (white로)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: start-1, endRowIndex: end, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { backgroundColor: rgb('#ffffff') } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  // A열 너비 조정 (태그 크기에 맞게)
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 50 },
      fields: 'pixelSize',
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('태그 적용 완료');
}

main().catch(err => console.error(err.message));
