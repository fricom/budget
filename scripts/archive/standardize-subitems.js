const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Read current 소항목 values (C4:C56)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!C4:C56',
  });
  const cValues = res.data.values || [];

  // 2. Write to R column as 메모 (R4:R56)
  const memoData = cValues.map(row => [row[0] || '']);
  memoData[0] = ['메모']; // R4 header

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!R4',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: memoData },
  });
  console.log('메모 컬럼 복사 완료');

  // 3. Standardize 보험 소항목 (C15:C24)
  const insuranceNames = [
    ['실손보험'],       // R15: 메리츠1
    ['손해보험'],       // R16: 한화손해보험
    ['손해보험'],       // R17: KB손해보험
    ['운전자보험'],     // R18: 운전자보험 (유지)
    ['운전자보험'],     // R19: 운전자보험 (유지)
    ['생명보험'],       // R20: 교보생명보험
    ['실비보험'],       // R21: 실비(기)보험
    ['실비보험(진단추가)'], // R22: 실비(진단추가)보험
    ['생활보험(화재)'], // R23: 화재보험
    ['어린이보험'],     // R24: 태아보험
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '년 단위 가계세팅!C15',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: insuranceNames },
  });
  console.log('보험 소항목 표준화 완료');
}

main().catch(err => console.error(err.message));
