function checkAndSendAlerts() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfig(spreadsheet.getSheetByName('config'));
  const users = getUsersData(spreadsheet.getSheetByName('userdata'));

  users.forEach((user, index) => {
    const now = new Date();
    const lastAC = user.lastAC;
    const alertDate = new Date(user.alertString);
    const currentACCount = getCurrentACCount(user.username);

    if (currentACCount === null) {
      // AC数の取得に失敗した場合は処理をスキップ
      return;
    }

    let nextAlert = shouldAlert(now, lastAC, alertDate);
    console.log(nextAlert);

    if (currentACCount > user.count) { // ACした場合
      // 通知
      sendNotification(config, `${user.username}がACしました! (count: ${currentACCount})`);

      // 次のアラートの時刻を、翌日の8:00に設定
      nextAlert = now;
      nextAlert.setDate(nextAlert.getDate() + 1);
      nextAlert.setHours(8, 0, 0, 0); 

      // Update spreadsheets
      updateSpreadsheet(spreadsheet.getSheetByName('userdata'), index + 2, currentACCount, nextAlert);
    } else if (nextAlert !== false) { // ACしてなくて、アラートを出す場合
      // 通知
      sendNotification(config, `${user.username}はまだACしていません！！！`);

      // Update spreadsheets
      updateSpreadsheet(spreadsheet.getSheetByName('userdata'), index + 2, user.count, nextAlert);
    }
  });
}

function updateSpreadsheet(sheet, rowIndex, acCount, alertDate = null) {
  // AC数
  sheet.getRange(rowIndex, 2).setValue(acCount);
  
  // アラート日時が指定されている場合、Update
  if (alertDate) {
    const formattedDate = Utilities.formatDate(alertDate, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
    sheet.getRange(rowIndex, 4).setValue(formattedDate);
  }
}

function getConfig(configSheet) {
  return {
    username: configSheet.getRange(2, 1).getValue(),
    avatar_url: configSheet.getRange(2, 2).getValue(),
    webhook: configSheet.getRange(2, 3).getValue()
  };
}

function getUsersData(userdataSheet) {
  return userdataSheet.getRange(2, 1, userdataSheet.getLastRow() - 1, 4).getValues()
    .map(([username, count, lastAC, alertString]) => ({username, count, lastAC: new Date(lastAC), alertString}));
}

function sendNotification(config, message) {
  const payload = JSON.stringify({
    username: config.username,
    avatar_url: config.avatar_url,
    content: message,
  });
  UrlFetchApp.fetch(config.webhook, {method: "post", contentType: "application/json", payload});
}

function getCurrentACCount(username) {
  const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${username}`;
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    if (json && 'count' in json) {
      return json.count; // AC 数を返す
    } else {
      console.log('AC 数が取得できませんでした。');
      return null; // AC 数の取得に失敗した場合は null を返す
    }
  } catch (error) {
    console.log(`エラー: ${error.message}`);
    return null;
  }
}

function shouldAlert(now, lastAC, alertDate) {
  // アラートの条件を満たすか判定
  if (now < alertDate){
    return false;
  }
  
  if (isSameDay(now, lastAC)) {
    return false;
  }
  
  if (lastAC < new Date(now).setDate(now.getDate() - 2)) {
    return false;
  }

  // 現在がアラート時間であれば、次のアラート時間を返す
  return getNextAlertTime(new Date(now));
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function getNextAlertTime(now) {
  const alertTimes = ["08:00", "13:00", "18:00", "20:00", "21:00", "22:00", "22:30", "23:00", "23:30"];
  const format = 'HH:mm';
  let nextAlertTime = null;

  // 現在の時間を 'HH:mm' 形式で取得
  const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), format);

  // 次のアラート時間を見つける
  for (let alertTime of alertTimes) {
    if (nowStr < alertTime) {
      nextAlertTime = alertTime;
      break;
    }
  }

  // 次のアラート時間が見つからない場合は、翌日の最初のアラート時間を設定
  if (!nextAlertTime) {
    nextAlertTime = alertTimes[0];
    now.setDate(now.getDate() + 1); // 日付を翌日に変更
  }

  // 次のアラート日時を計算
  const [hours, minutes] = nextAlertTime.split(':').map(num => parseInt(num, 10));
  now.setHours(hours, minutes, 0, 0);

  return now;
}

