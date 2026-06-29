const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 가구 합산 테이블: 수식 vs 값 확인
  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '월 예산!B35:E44',
    valueRenderOption: 'FORMULA',
  });
  const valRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '월 예산!B35:E44',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const fRows = formulaRes.data.values || [];
  const vRows = valRes.data.values || [];

  console.log('가구 합산 테이블 (row 35~44)\n');
  console.log('row  | B(%)           | C(카테고리)    | E(금액)');
  console.log('-----+----------------+----------------+--------------------');
  fRows.forEach((fr, i) => {
    const vr = vRows[i] || [];
    const b = fr[0] !== undefined ? String(fr[0]).substring(0, 30) : '';
    const c = fr[1] !== undefined ? String(fr[1]).substring(0, 14) : '';
    const e = fr[3] !== undefined ? String(fr[3]).substring(0, 30) : '';
    const bv = vr[0] !== undefined ? vr[0] : '';
    const ev = vr[3] !== undefined ? vr[3] : '';
    console.log(`row${35+i} | B=${String(bv).padStart(5)} [${b.padEnd(28)}] | C=${c.padEnd(14)} | E=${String(ev).padStart(10)} [${e}]`);
  });

  // 수입 확인
  const incomeRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '월 예산!E4:K4',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const ir = (incomeRes.data.values || [[]])[0];
  console.log('\n수입: E4(지원)=' + ir[0] + ', K4(윤혜)=' + ir[6] + ', 합계=' + ((ir[0]||0)+(ir[6]||0)));
})().catch(e => console.error(e.message));
