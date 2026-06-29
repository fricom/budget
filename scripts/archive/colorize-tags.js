const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

function rgb(hex) {
  return { red: parseInt(hex.slice(1,3),16)/255, green: parseInt(hex.slice(3,5),16)/255, blue: parseInt(hex.slice(5,7),16)/255 };
}

const PERSON_COLORS = {
  '지원': '#e7fff5',
  '윤혜': '#f5ffe7',
  '아이': '#fffde7',
};

// 이미 알고 있는 할당 [row(1-based), person]
const KNOWN = [
  // 보험
  ...[14,15,16,17,18,19].map(r => [r, '지원']),
  ...[20,21,22,23,24,25,26].map(r => [r, '윤혜']),
  [27, '아이'],
  // 고정지출
  [31, '윤혜'], [32, '윤혜'],
  [33, '지원'], [34, '지원'],
];

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 1862606876;

  // 1. 알고 있는 행에 태그 텍스트 쓰기
  const knownUpdates = KNOWN.map(([row, person]) => ({
    range: `년 단위 가계세팅!A${row}`,
    values: [[person]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: knownUpdates },
  });

  // 2. A열 전체 읽기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!A1:A80',
  });
  const rows = res.data.values || [];

  // 3. 지원/윤혜/아이 텍스트 있는 셀에 색 + 볼드 + 가운데 적용
  const requests = [];
  rows.forEach((row, i) => {
    const text = (row[0] || '').trim();
    const color = PERSON_COLORS[text];
    if (!color) return;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: i, endRowIndex: i+1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(color),
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    });
  });

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  console.log(`태그 색상 적용 완료 (${requests.length}개 셀)`);
}

main().catch(err => console.error(err.message));
