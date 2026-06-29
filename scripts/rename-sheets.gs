function renameSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var renames = {
    '2026': 'financial-plan',
    '2026 생활비': 'expense-log'
  };

  Object.keys(renames).forEach(function(oldName) {
    var sheet = ss.getSheetByName(oldName);
    if (sheet) {
      sheet.setName(renames[oldName]);
      Logger.log('Renamed: ' + oldName + ' → ' + renames[oldName]);
    } else {
      Logger.log('Sheet not found: ' + oldName);
    }
  });
}
