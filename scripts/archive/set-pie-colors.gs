function setPieChartColors() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('분석.그래프');
  var charts = sheet.getCharts();

  // 카테고리 순서: 생활, 자녀, 외식, 교통, 여가, 쇼핑, 의료
  var colors = [
    '#ABDDC5', // 생활 - 그린
    '#FFEBA0', // 자녀 - 노랑
    '#FFCC99', // 외식 - 오렌지
    '#A1D2FA', // 교통 - 파랑
    '#DDB4E4', // 여가 - 보라
    '#A6E8F0', // 쇼핑 - 시안
    '#FFA6C7', // 의료 - 핑크
  ];

  for (var i = 0; i < charts.length; i++) {
    var chart = charts[i];
    if (chart.getOptions().get('title') === '카테고리별 지출 비율') {
      var builder = chart.modify();
      builder.setColors(colors);
      sheet.updateChart(builder.build());
      Logger.log('✅ 파이 차트 색상 적용 완료');
      return;
    }
  }
  Logger.log('❌ 파이 차트를 찾지 못했습니다.');
}
