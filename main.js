function main(e) {
  // sheets
  let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let userdata_sheet = spreadsheet.getSheetByName('userdata');
  let config_sheet = spreadsheet.getSheetByName('config');

  for (let i=2; i <= userdata_sheet.getLastRow(); i++){
    let username = userdata_sheet.getRange(i, 1).getValue();
    let count = userdata_sheet.getRange(i, 2).getValue();

    let url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${username}`
    let response = UrlFetchApp.fetch(url).getContentText();
    let json = JSON.parse(response);

    if (json.count != count){
      // Post data
      const payload = {
        username: config_sheet.getRange(2, 1).getValue(),
        avatar_url: config_sheet.getRange(2, 2).getValue(),
        content: `${username}がACしました! (count: ${json.count})`,
      };

      // Post via webhook
      let webhook = config_sheet.getRange(2, 3).getValue()
      UrlFetchApp.fetch(webhook, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
      });

      // Update count
      userdata_sheet.getRange(i, 2).setValue(json.count);
    }
  }
}
