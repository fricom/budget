/**
 * 설정 탭의 가구원 수(C4) 변경 시
 * 월 예산 탭의 수입 행(R6~R10)을 자동 숨김/표시
 *
 * 설치 방법:
 * Google Sheets → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 저장(Ctrl+S)
 * 이후 설정 탭에서 C4 값 변경 시 자동 실행됨 (별도 실행 불필요)
 */

function onEdit(e) {
  const sheet = e.source.getActiveSheet();

  // 설정 탭 C4 변경 시에만 동작
  if (sheet.getName() !== '설정' || e.range.getA1Notation() !== 'C4') return;

  const count = parseInt(e.value);
  if (isNaN(count) || count < 1 || count > 5) return;

  const budgetSheet = e.source.getSheetByName('월 예산');
  if (!budgetSheet) return;

  // 수입 행: R6(가구원1) ~ R10(가구원5)
  const INCOME_START_ROW = 6;
  const MAX_MEMBERS = 5;

  for (let i = 0; i < MAX_MEMBERS; i++) {
    const row = INCOME_START_ROW + i;
    if (i < count) {
      budgetSheet.showRows(row);
    } else {
      budgetSheet.hideRows(row);
    }
  }
}

/**
 * 수동 실행용 — 설정 탭 C4 현재 값 기준으로 즉시 적용
 * Script Editor에서 이 함수 선택 후 ▶ 실행
 */
function applyHouseholdRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingSheet = ss.getSheetByName('설정');
  const budgetSheet = ss.getSheetByName('월 예산');
  if (!settingSheet || !budgetSheet) return;

  const count = parseInt(settingSheet.getRange('C4').getValue());
  if (isNaN(count) || count < 1 || count > 5) return;

  const INCOME_START_ROW = 6;
  const MAX_MEMBERS = 5;

  for (let i = 0; i < MAX_MEMBERS; i++) {
    const row = INCOME_START_ROW + i;
    if (i < count) {
      budgetSheet.showRows(row);
    } else {
      budgetSheet.hideRows(row);
    }
  }

  SpreadsheetApp.getUi().alert(`가구원 ${count}명 기준으로 수입 행 적용 완료`);
}
