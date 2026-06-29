const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

// 가구 합산 요약 테이블 레이아웃 (sheet row 기준)
// Row 35: 헤더
// Row 36: 주거   ← E36 수기입력 / B36 수식(%)
// Row 37: 보험   ← B37 수기입력(%) / E37 수식(금액)
// Row 38: 고정지출
// Row 39: 생활비
// Row 40: 저축
// Row 41: 연금
// Row 42: 비상금
// Row 43: 용돈
// Row 44: 합계   ← 수식

// 총수입 참조: E4(지원) + K4(윤혜)
// 나머지: 총수입 - E36(주거비)

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const data = [
    // 주거: 금액은 수기, % 는 수식
    { range: '월 예산!B36', values: [['=ROUND(E36/(E4+K4)*100,0)']] },

    // 비주거 카테고리: 금액 = 나머지 × %
    // 나머지 = (E4+K4) - E36
    { range: '월 예산!E37', values: [['=ROUND(((E4+K4)-E36)*B37/100,0)']] },
    { range: '월 예산!E38', values: [['=ROUND(((E4+K4)-E36)*B38/100,0)']] },
    { range: '월 예산!E39', values: [['=ROUND(((E4+K4)-E36)*B39/100,0)']] },
    { range: '월 예산!E40', values: [['=ROUND(((E4+K4)-E36)*B40/100,0)']] },
    { range: '월 예산!E41', values: [['=ROUND(((E4+K4)-E36)*B41/100,0)']] },
    { range: '월 예산!E42', values: [['=ROUND(((E4+K4)-E36)*B42/100,0)']] },
    { range: '월 예산!E43', values: [['=ROUND(((E4+K4)-E36)*B43/100,0)']] },

    // 합계 행
    { range: '월 예산!E44', values: [['=SUM(E36:E43)']] },
    { range: '월 예산!B44', values: [['=ROUND(E44/(E4+K4)*100,0)']] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  console.log('완료!');
  console.log('  B36  : 수식 (주거비 % 자동계산)');
  console.log('  E37~43: 수식 (나머지 금액 × %)');
  console.log('  E44  : 합계 SUM');
  console.log('  B44  : 합계 % 수식');
  console.log('\n입력 셀:');
  console.log('  E36  : 주거비 (수기)');
  console.log('  B37~43: 각 카테고리 % (수기)');
}

main().catch(e => console.error(e.message));
