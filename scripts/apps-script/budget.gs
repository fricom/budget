/**
 * 가계부 스프레드시트 통합 스크립트
 * Script Editor에 이 파일 전체를 붙여넣고 저장(Ctrl+S)
 */

// ─────────────────────────────────────────
// 1. 가구원 수 기반 수입 행(4·5번째) 자동 채움/클리어
//    설정 탭 C4(가구원 수) 변경 시 자동 실행
//    R6~R8(가구원1~3)은 고정, R11(가구원4)·R12(가구원5)만 동적
// ─────────────────────────────────────────

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== '설정') return;

  var cell = e.range.getA1Notation();

  // 가구원 수 변경 → 가구원4·5 행 채움/클리어
  if (cell === 'C4') {
    var count = parseInt(e.value);
    if (isNaN(count) || count < 1 || count > 5) return;
    applyHouseholdRows_(e.source, count);
  }

  // 가구원 이름 변경 → 색상 동기화
  if (['F4','F5','F6','F7','F8'].indexOf(cell) !== -1) {
    syncMemberColors_(e.source);
  }

  // 가구원4·5 이름 변경 → C11/C12 이름 텍스트도 갱신
  if (cell === 'F7' || cell === 'F8') {
    var currentCount = parseInt(sheet.getRange('C4').getValue());
    if (!isNaN(currentCount) && currentCount >= 1 && currentCount <= 5) {
      applyHouseholdRows_(e.source, currentCount);
    }
  }
}

/**
 * 수동 실행용 — 설정 탭 C4 현재 값 기준으로 즉시 적용
 * Script Editor에서 이 함수 선택 후 ▶ 실행
 */
function applyHouseholdRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var count = parseInt(ss.getSheetByName('설정').getRange('C4').getValue());
  if (isNaN(count) || count < 1 || count > 5) return;

  applyHouseholdRows_(ss, count);
  SpreadsheetApp.getUi().alert('가구원 ' + count + '명 기준으로 수입 행 적용 완료');
}

function applyHouseholdRows_(ss, count) {
  var settingSheet = ss.getSheetByName('설정');
  var budgetSheet = ss.getSheetByName('월 예산');
  if (!settingSheet || !budgetSheet) return;

  // 가구원4: F7 → R11, 가구원5: F8 → R12
  applyMemberSlot_(settingSheet, budgetSheet, 'F7', 11, 4, count);
  applyMemberSlot_(settingSheet, budgetSheet, 'F8', 12, 5, count);
}

function applyMemberSlot_(settingSheet, budgetSheet, nameCell, row, memberIndex, count) {
  if (count >= memberIndex) {
    var name = settingSheet.getRange(nameCell).getValue();
    budgetSheet.getRange('C' + row).setValue(name);
  } else {
    budgetSheet.getRange('C' + row + ':E' + row).clearContent();
  }
}

// ─────────────────────────────────────────
// 2. 가구원 색상 동기화
//    설정!F4:F8 배경색 → 월 예산 헤더/수입행 자동 적용
// ─────────────────────────────────────────

/**
 * 수동 실행용 — 설정 탭 색상 변경 후 직접 실행
 * 이름 변경 시에는 onEdit이 자동 호출
 */
function syncMemberColors() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  syncMemberColors_(ss);
  SpreadsheetApp.getUi().alert('가구원 색상 동기화 완료');
}

function syncMemberColors_(ss) {
  var settingSheet = ss.getSheetByName('설정');
  var budgetSheet = ss.getSheetByName('월 예산');
  if (!settingSheet || !budgetSheet) return;

  // 설정!F4:F8 — 가구원1~5 이름 셀 배경색
  var colors = settingSheet.getRange('F4:F8').getBackgrounds();

  // 가구원별 적용 대상 (월 예산)
  // 가구원1: J4(헤더), R6(수입행 C:E)
  // 가구원2: L4(헤더), R7(수입행 C:E)
  // 가구원3: R8(수입행 C:E)
  // 가구원4: R11(수입행 C:E) / 가구원5: R12(수입행 C:E)
  var targets = [
    { header: 'J4', row: 6 },
    { header: 'L4', row: 7 },
    { header: null, row: 8 },
    { header: null, row: 11 },
    { header: null, row: 12 },
  ];

  for (var i = 0; i < 5; i++) {
    var color = colors[i][0];
    if (targets[i].header) {
      budgetSheet.getRange(targets[i].header).setBackground(color);
    }
    budgetSheet.getRange('C' + targets[i].row + ':E' + targets[i].row).setBackground(color);
  }
}

// ─────────────────────────────────────────
// 3. 분석.그래프 탭 파이 차트 색상 설정
//    Script Editor에서 수동 실행
// ─────────────────────────────────────────

/**
 * '카테고리별 지출 비율' 파이 차트의 항목 색상을 지정값으로 덮어씀
 * 색상 순서는 차트의 카테고리 순서와 일치해야 함
 */
function setPieChartColors() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('분석.그래프');
  var charts = sheet.getCharts();

  var colors = [
    '#ABDDC5', // 연초록
    '#FFEBA0', // 연노랑
    '#FFCC99', // 연주황
    '#A1D2FA', // 연파랑
    '#DDB4E4', // 연보라
    '#A6E8F0', // 연하늘
    '#FFA6C7', // 연분홍
  ];

  for (var i = 0; i < charts.length; i++) {
    var chart = charts[i];
    if (chart.getOptions().get('title') === '카테고리별 지출 비율') {
      sheet.updateChart(chart.modify().setOption('colors', colors).build());
      Logger.log('파이 차트 색상 적용 완료');
      return;
    }
  }
  Logger.log('파이 차트를 찾지 못했습니다.');
}
