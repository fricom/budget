const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // Read current R15:R28 data
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID, includeGridData: true,
    ranges: ['년 단위 가계세팅!C15:R28'],
  });
  const rows = res.data.sheets[0].data[0].rowData || [];

  function getVal(cell) {
    if (!cell || !cell.userEnteredValue) return '';
    const v = cell.userEnteredValue;
    if (v.numberValue !== undefined) return v.numberValue;
    return v.stringValue || v.formulaValue || '';
  }
  function extract(row) {
    const vals = row.values || [];
    return {
      sub: getVal(vals[0]),
      months: Array.from({ length: 12 }, (_, i) => getVal(vals[1 + i])),
      memo: getVal(vals[15]),
    };
  }
  function cleanMemo(memo) {
    return memo
      .replace(/^지원 \/ /, '')
      .replace(/^윤혜 \/ /, '')
      .replace(/^아이 \/ /, '')
      .replace(/^지원$/, '')
      .replace(/^윤혜$/, '')
      .replace(/^아이$/, '');
  }

  const d = rows.map(extract);
  // Current: 0=생명보험지원, 1=운전자보험지원, 2=실비보험지원, 3=실비보험진단지원,
  //          4=생활보험화재지원, 5=암보험지원, 6=실손보험윤혜, 7=손해보험한화윤혜,
  //          8=손해보험KB윤혜, 9=운전자보험윤혜, 10=실비보험윤혜, 11=실비보험진단윤혜,
  //          12=암보험윤혜, 13=어린이보험아이

  // New order: 공통항목 먼저 (운전자→실비→실비진단→암보험), 고유항목 뒤
  // 지원: 운전자(1), 실비(2), 실비진단(3), 암보험(5), 생명(0), 생활화재(4)
  // 윤혜: 운전자(9), 실비(10), 실비진단(11), 암보험(12), 실손(6), 손해한화(7), 손해KB(8)
  // 아이: 어린이(13)
  const order = [1, 2, 3, 5, 0, 4, 9, 10, 11, 12, 6, 7, 8, 13];
  const newOrder = order.map(i => ({ ...d[i], memo: cleanMemo(d[i].memo) }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '년 단위 가계세팅!C15', values: newOrder.map(r => [r.sub]) },
        { range: '년 단위 가계세팅!D15', values: newOrder.map(r => r.months) },
        { range: '년 단위 가계세팅!R15', values: newOrder.map(r => [r.memo]) },
      ],
    },
  });

  console.log('완료');
  newOrder.forEach((r, i) => console.log(`R${i+15}: ${r.sub}${r.memo ? ' | '+r.memo : ''}`));
}

main().catch(err => console.error(err.message));
