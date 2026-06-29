const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const data = [
    // E14 = 지원 수입 + 윤혜 수입 (가구 합산)
    { range: "'월 예산'!E14", values: [['=J4+P4']] },

    // C6:C13 = 각 항목 금액 / 가구 합산 (세팅 비율 자동)
    { range: "'월 예산'!C6",  values: [['=E6/$E$14']] },
    { range: "'월 예산'!C7",  values: [['=E7/$E$14']] },
    { range: "'월 예산'!C8",  values: [['=E8/$E$14']] },
    { range: "'월 예산'!C9",  values: [['=E9/$E$14']] },
    { range: "'월 예산'!C10", values: [['=E10/$E$14']] },
    { range: "'월 예산'!C11", values: [['=E11/$E$14']] },
    { range: "'월 예산'!C12", values: [['=E12/$E$14']] },
    { range: "'월 예산'!C13", values: [['=E13/$E$14']] },

    // B2 가구 합산 텍스트도 수식으로
    { range: "'월 예산'!B2", values: [['="가구 합산 (지원 + 윤혜)  = "&TEXT(J4+P4,"₩#,##0")']] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  console.log('✓ 완료');
  console.log('  - E14: 지원+윤혜 수입 자동 합산');
  console.log('  - C6:C13: E열 입력 시 세팅 비율 자동 계산');
  console.log('  - B2: 가구 합산 금액 자동 표시');
}

main().catch(e => console.error(e.message));
