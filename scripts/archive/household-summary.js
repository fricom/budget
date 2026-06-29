const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1Ls8Fsa4WYvF7rjPd-WihCOspg4i-WszRdu61giVQzfI';
const KEY_FILE = path.join(__dirname, '../neon-pad-149600-6c805dc139bc.json');
const SHEET_ID = 1559332089;

function parseAmount(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[₩,%\s]/g, ''), 10) || 0;
}

function pct(amount, total) {
  return Math.round(amount / total * 100);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '월 예산' });
  const rows = res.data.values || [];
  const e = (r, c) => parseAmount((rows[r] || [])[c]);

  const incomeJ = e(3, 4);   // 지원 수입
  const incomeY = e(3, 10);  // 윤혜 수입
  const totalIncome = incomeJ + incomeY;

  // 카테고리별 합산 (지원 + 윤혜)
  const categories = [
    {
      label: '주거',
      total: e(5,4) + e(6,4),  // 지원만
    },
    {
      label: '보험',
      total: (e(7,4) + e(8,4) + e(9,4) + e(10,4) + e(11,4))   // 지원
           + (e(5,10) + e(6,10) + e(7,10) + e(8,10) + e(9,10)), // 윤혜
    },
    {
      label: '고정지출',
      total: (e(12,4) + e(13,4) + e(14,4) + e(15,4) + e(16,4) + e(17,4))          // 지원
           + (e(10,10) + e(11,10) + e(12,10) + e(13,10) + e(14,10) + e(15,10) + e(16,10)), // 윤혜
    },
    {
      label: '생활비',
      total: e(18,4) + e(17,10),
    },
    {
      label: '저축',
      total: (e(19,4) + e(20,4) + e(21,4) + e(22,4))                              // 지원
           + (e(18,10) + e(19,10) + e(20,10) + e(21,10) + e(22,10) + e(23,10)),   // 윤혜
    },
    {
      label: '연금',
      total: (e(23,4) + e(24,4)) + (e(24,10) + e(25,10)),
    },
    {
      label: '비상금',
      total: e(25,4) + (e(26,10) + e(27,10) + e(28,10)),
    },
    {
      label: '용돈',
      total: e(28,4) + e(31,10),
    },
  ];

  const grandTotal = categories.reduce((s, c) => s + c.total, 0);
  categories.push({ label: '합계', total: grandTotal });

  console.log(`\n가구 합산 수입: ${totalIncome.toLocaleString()}원\n`);
  categories.forEach(c => {
    console.log(`  ${c.label.padEnd(6)} ${c.total.toLocaleString()}원 → ${pct(c.total, totalIncome)}%`);
  });

  // ── 요약 테이블 작성 (row 35부터, 0-indexed: 34) ──────────────
  // 열: B(1)=퍼센트, C(2)=카테고리, E(4)=금액
  const START_ROW = 34; // 0-indexed (sheet row 35)

  // 헤더
  const headerText = `가구 합산  (지원 ${incomeJ.toLocaleString()} + 윤혜 ${incomeY.toLocaleString()} = ${totalIncome.toLocaleString()}원)`;

  const valueData = [
    { range: `월 예산!C${START_ROW + 1}`, values: [[headerText]] },
    ...categories.map((c, i) => ({
      range: `월 예산!B${START_ROW + 2 + i}`,
      values: [[pct(c.total, totalIncome)]],
    })),
    ...categories.map((c, i) => ({
      range: `월 예산!C${START_ROW + 2 + i}`,
      values: [[c.label]],
    })),
    ...categories.map((c, i) => ({
      range: `월 예산!E${START_ROW + 2 + i}`,
      values: [[c.total]],
    })),
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: valueData },
  });

  const dataRowCount = categories.length;

  // ── 포맷 ─────────────────────────────────────────────────────
  const requests = [];

  // 헤더 행 스타일
  requests.push({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: START_ROW,
        endRowIndex: START_ROW + 1,
        startColumnIndex: 1,
        endColumnIndex: 5,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.953, green: 0.953, blue: 0.953 },
          textFormat: { bold: true },
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat.bold,verticalAlignment)',
    },
  });

  // 퍼센트 열 (B) 스타일
  requests.push({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: START_ROW + 1,
        endRowIndex: START_ROW + 1 + dataRowCount,
        startColumnIndex: 1,
        endColumnIndex: 2,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern: '0"%"' },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment,verticalAlignment,textFormat.bold)',
    },
  });

  // 금액 열 (E) 스타일
  requests.push({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: START_ROW + 1,
        endRowIndex: START_ROW + 1 + dataRowCount,
        startColumnIndex: 4,
        endColumnIndex: 5,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'CURRENCY', pattern: '₩#,##0' },
          horizontalAlignment: 'RIGHT',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // 카테고리 열 (C) 스타일
  requests.push({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: START_ROW + 1,
        endRowIndex: START_ROW + 1 + dataRowCount,
        startColumnIndex: 2,
        endColumnIndex: 3,
      },
      cell: {
        userEnteredFormat: {
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat.verticalAlignment',
    },
  });

  // 합계 행 (마지막) 배경 강조
  requests.push({
    repeatCell: {
      range: {
        sheetId: SHEET_ID,
        startRowIndex: START_ROW + dataRowCount,
        endRowIndex: START_ROW + dataRowCount + 1,
        startColumnIndex: 1,
        endColumnIndex: 5,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.953, green: 0.953, blue: 0.953 },
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat.bold)',
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log('\n완료! 가구 합산 요약 테이블 작성됨 (row 35~)');
}

main().catch(e => console.error(e.message));
