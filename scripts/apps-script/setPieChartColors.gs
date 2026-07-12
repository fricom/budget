/**
 * [차트 색상 적용] 분석.그래프 탭의 파이 차트 색상 설정
 *
 * 대상: '분석.그래프' 탭에서 제목이 '카테고리별 지출 비율'인 파이 차트
 * 동작: 차트의 각 항목 색상을 아래 지정된 순서대로 덮어씀
 * 실행: 자동 트리거 없음 — Script Editor에서 myFunction 선택 후 ▶ 수동 실행
 *
 * 색상 순서 (카테고리 순서와 일치해야 함):
 *   1. #ABDDC5 — 연초록
 *   2. #FFEBA0 — 연노랑
 *   3. #FFCC99 — 연주황
 *   4. #A1D2FA — 연파랑
 *   5. #DDB4E4 — 연보라
 *   6. #A6E8F0 — 연하늘
 *   7. #FFA6C7 — 연분홍
 */
function myFunction() {
  function setPieChartColors() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('분석.그래프');
    var charts = sheet.getCharts();

    var colors = [
      '#ABDDC5',
      '#FFEBA0',
      '#FFCC99',
      '#A1D2FA',
      '#DDB4E4',
      '#A6E8F0',
      '#FFA6C7',
    ];

    for (var i = 0; i < charts.length; i++) {
      var chart = charts[i];
      if (chart.getOptions().get('title') === '카테고리별 지출 비율') {
        var builder = chart.modify();
        builder.setColors(colors);
        sheet.updateChart(builder.build());
        Logger.log('완료');
        return;
      }
    }
    Logger.log('파이 차트를 찾지 못했습니다.');
  }
}
