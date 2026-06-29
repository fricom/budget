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

  // 1. Get sheet metadata to find sheetId and cell colors
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: ['년 단위 가계세팅!B9:Q11'], // 관리비, 전기, 수도 rows
  });

  const sheetId = meta.data.sheets.find(s => s.properties.title === '년 단위 가계세팅').properties.sheetId;
  console.log('sheetId:', sheetId);

  // Check color of 전기 row (R10 = index 9, but in range B9:Q11 it's the 2nd row)
  const gridData = meta.data.sheets[0].data[0];
  if (gridData && gridData.rowData) {
    gridData.rowData.forEach((row, ri) => {
      if (row.values) {
        row.values.forEach((cell, ci) => {
          const bg = cell.effectiveFormat && cell.effectiveFormat.backgroundColor;
          if (bg) {
            console.log(`Row${ri} Col${ci}: rgb(${JSON.stringify(bg)})`);
          }
        });
      }
    });
  }

  // 2. Insert 2 rows after row 52 (0-based: after index 51, i.e., insertDimension at index 52)
  // This pushes 합계(R53) to R55
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: 52, // after row 52 (1-based), insert at 0-based index 52
              endIndex: 54,   // insert 2 rows
            },
            inheritFromBefore: true,
          },
        },
      ],
    },
  });
  console.log('Rows inserted');

  // 3. Write content to new rows (now R53 and R54 in 1-based)
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '년 단위 가계세팅!D53', values: [['유입금']] },
        { range: '년 단위 가계세팅!D54', values: [['임시지출']] },
      ],
    },
  });
  console.log('Values written');

  // 4. Apply light gray background to B53:Q54 (the 2 new rows)
  // Using same gray as structural sub-items: #f3f3f3
  function rgb(hex) {
    return {
      red: parseInt(hex.slice(1, 3), 16) / 255,
      green: parseInt(hex.slice(3, 5), 16) / 255,
      blue: parseInt(hex.slice(5, 7), 16) / 255,
    };
  }

  const LIGHT_GRAY = rgb('#f3f3f3');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 52, // 0-based row 53
              endRowIndex: 54,   // 0-based row 54 (exclusive = covers rows 53-54)
              startColumnIndex: 1, // col B
              endColumnIndex: 17,  // col Q
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: LIGHT_GRAY,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });
  console.log('Color applied');
}

main().catch(err => console.error(err.message));
