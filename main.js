const FROM_UNIX_TIME_AGO = 20 * 60;

function checkAndSendAlerts() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfig(spreadsheet.getSheetByName('config'));
  const users = getUsersData(spreadsheet.getSheetByName('userdata'));

  users.forEach((user, index) => {
    const fromUnixtime = Math.floor((new Date().getTime() / 1000) - FROM_UNIX_TIME_AGO);
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/from/${fromUnixtime}`;

    // URLからデータを取得
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    let userData = undefined;
    for (let i = 0; i < data.length; i++) {
      if (data[i].user_id !== user.username) {
        continue;
      }

      console.log(data[i]);

      if (data[i]["result"] == "WJ") {
        continue;
      }

      if (CompareDate(user.lastSubmit, unixTimeToFormattedDate(data[i]["epoch_second"])) === 1) {
        userData = data[i];
        break;
      } 
    }

    const alertDate = new Date(user.alertString);
    let nextAlert = shouldAlert(new Date(), user.lastAC, alertDate);

    if (userData) {
      console.log(userData);

      let formattedDate = unixTimeToFormattedDate(userData["epoch_second"]);

      if (CompareDate(user.lastSubmit, formattedDate) == 0) {
        console.log("[checkAndSendAlerts] return;");
        return;
      }

      let message = ""
      message += `${userData["user_id"]}が${userData["result"]}しました！\n`;
      message += `\n`
      message += `提出時刻: ${formattedDate}\n`
      message += `解いた問題: ${userData["problem_id"]}\n`
      message += `言語: ${userData["language"]}\n`
      message += `提出URL: https://atcoder.jp/contests/${userData["contest_id"]}/submissions/${userData["id"]}`
      
      sendNotification(config, message);

      if (userData["result"] == "AC") {
        // 次のアラートの時刻を、翌日の8:00に設定
        nextAlert = new Date();
        nextAlert.setDate(nextAlert.getDate() + 1);
        nextAlert.setHours(8, 0, 0, 0); 

        // Update spreadsheets
        updateSpreadsheet(spreadsheet.getSheetByName('userdata'), index + 2, formattedDate, formattedDate, nextAlert);
      } else {
        // AC以外
        updateSpreadsheet(spreadsheet.getSheetByName('userdata'), index + 2, formattedDate, user.lastAC, nextAlert);
      }
    } else {
      // アラート処理
      if (nextAlert !== false) {
        // 通知
        sendNotification(config, `${user.username}はまだACしていません！！！`);

        // Update spreadsheets
        updateSpreadsheet(spreadsheet.getSheetByName('userdata'), index + 2, user.lastSubmit, user.lastAC, nextAlert);
      }
    }
  });
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
    .map(([username, lastSubmit, lastAC, alertString]) => ({username, lastSubmit, lastAC: new Date(lastAC), alertString}));
}

function unixTimeToFormattedDate(unixtime){
  let date = new Date(unixtime * 1000);
  let timeZone = "Asia/Tokyo";
  let format = "yyyy/MM/dd HH:mm:ss";
  
  return Utilities.formatDate(date, timeZone, format);
}

function updateSpreadsheet(sheet, rowIndex, lastSubmit, lastAC, alertDate = null) {
  sheet.getRange(rowIndex, 2).setValue(lastSubmit);
  sheet.getRange(rowIndex, 3).setValue(lastAC);
  
  // アラート日時が指定されている場合、Update
  if (alertDate) {
    const formattedDate = Utilities.formatDate(alertDate, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
    sheet.getRange(rowIndex, 4).setValue(formattedDate);
  }
}

function sendNotification(config, message) {
  const payload = JSON.stringify({
    username: config.username,
    avatar_url: config.avatar_url,
    content: message,
  });
  UrlFetchApp.fetch(config.webhook, {method: "post", contentType: "application/json", payload});
}

function shouldAlert(now, lastAC, alertDate) {
  // アラートの条件を満たすか判定
  if (now < alertDate){
    return false;
  }
  
  if (isSameDay(now, lastAC)) {
    return false;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  if (lastAC < yesterday) {
    return false;
  }

  // 現在がアラート時間であれば、次のアラート時間を返す
  return getNextAlertTime(new Date(now));
}

function CompareDate(date1, date2) {
  t1 = new Date(date1).getTime();
  t2 = new Date(date2).getTime();

  if (t1 == t2){
    return 0;
  }

  if (t1 > t2){
    return -1;
  } else {
    return 1;
  }
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

