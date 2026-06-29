const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
function rgb(hex) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

const COLOR_MAP = {
  '#f4cccc': '#fce5cd', // 초과 지출
  '#cfe2f3': '#d9ead3', // 절약
};

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = 1862606876;

  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: ['년 단위 가계세팅!D6:O56'],
  });

  const rows = res.data.sheets[0].data[0].rowData || [];
  const requests = [];

  rows.forEach((row, ri) => {
    (row.values || []).forEach((cell, ci) => {
      const bg = cell.effectiveFormat && cell.effectiveFormat.backgroundColor;
      if (!bg) return;
      const hex = toHex(bg.red || 0, bg.green || 0, bg.blue || 0);
      const newHex = COLOR_MAP[hex];
      if (!newHex) return;

      const rowIndex = 5 + ri;  // D6 = row index 5
      const colIndex = 3 + ci;  // D = col index 3

      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          cell: { userEnteredFormat: { backgroundColor: rgb(newHex) } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
      console.log(`R${rowIndex + 1} col${colIndex + 1}: ${hex} → ${newHex}`);
    });
  });

  if (requests.length === 0) {
    console.log('변경할 셀 없음');
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  console.log(`총 ${requests.length}개 셀 색상 변경 완료`);
}

main().catch(err => console.error(err.message));
