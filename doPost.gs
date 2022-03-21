const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

/**
 * LINEからのリクエストを処理（WebHookの入り口）
 */
function doPost(request) {
  const receiveJSON = JSON.parse(request.postData.contents);

  // 詳細なデータ構造は以下を参照
  // https://developers.line.biz/ja/reference/messaging-api/#webhook-event-objects
  const event = receiveJSON.events[0];

  if (event.type == "postback") {
    const postBackData = getPostBackData(event.postback.data);
    if (
      postBackData.operation == Operation.OrderAccept ||
      postBackData.operation == Operation.Delivering ||
      postBackData.operation == Operation.Delivered
    ) {
      doOperation(event.replyToken, postBackData);
      return;
    }
  }

  // テキスト以外が送られてきたときは何もしない。
  if (event.message.type != "text") {
    return;
  }

  // 操作が指定された場合の応答を返す
  if (
    event.message.text == Operation.OrderAccept ||
    event.message.text == Operation.Delivering ||
    event.message.text == Operation.Delivered
  ) {
    doOperation(event);
    return;
  }

  return replyToUser(
    event.replyToken,
    "正常に処理できませんでした。スプレッドシートを確認してください。"
  );
}

/**
 * 操作ごとの処理
 * @param replyToken
 * @param postBackData
 */
function doOperation(replyToken, postBackData) {
  const order = getOrder(postBackData.orderId);

  if (postBackData.operation == Operation.OrderAccept) {
    let message = Shop.OrderReceivedMailBody;
    message += createOrderMessage(order);

    sendMail(Shop.OrderReceivedMailTitle, order.email, message);
    updateStatus(postBackData.orderId, Operation.OrderAccept);

    const operationButtons = createOperationButtons(postBackData.orderId);
    replyToUser(
      replyToken,
      `${order.email}に、オーダー完了メールを送信しました。`,
      operationButtons
    );
  } else if (postBackData.operation == Operation.Delivering) {
    let message = Shop.DeriverlingdMailBody;
    message += createOrderMessage(order);

    sendMail(Shop.DeriverlingMailTitle, order.email, message);
    updateStatus(postBackData.orderId, Operation.Delivering);

    const operationButtons = createOperationButtons(postBackData.orderId);
    replyToUser(
      replyToken,
      `${order.email}に、出発メールを送信しました。`,
      operationButtons
    );
  } else if (postBackData.operation == Operation.Delivered) {
    // 配達完了時はメール送信はしない
    updateStatus(postBackData.orderId, Operation.Delivered);
    replyToUser(
      replyToken,
      `注文番号[${postBackData.orderId}]の配達が完了しました。`
    );
  }
}

/**
 * orderシートの「処理」ステータスを更新
 * @param orderId
 * @param operation
 */
function updateStatus(orderId, operation) {
  if (operation == Operation.OrderAccept) {
    Sheet.Order.getRange(orderId, OrderSheetHeaders.Ordered).setValue(1);
  } else if (operation == Operation.Delivering) {
    Sheet.Order.getRange(orderId, OrderSheetHeaders.Delivering).setValue(1);
  } else if (operation == Operation.Delivered) {
    Sheet.Order.getRange(orderId, OrderSheetHeaders.Delivered).setValue(1);
  }
}

/**
 * postbackデータを分割して処理とオーダーIDを取得
 * @param data postbackデータ
 * @returns
 */
function getPostBackData(data) {
  const list = data.split(",");
  return {
    operation: list[0],
    orderId: list[1],
  };
}

/**
 * メール送信処理
 * 操作しているGoogleアカウントのメールから送信される
 */
function sendMail(subject, to, body) {
  const options = { name: Shop.ShopName };
  GmailApp.sendEmail(to, subject, body, options);
}

/**
 * bot送信ユーザーへ応答を返す
 * （この場合は店主）
 */
function replyToUser(replyToken, text, operationButtons) {
  const replyText = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: text,
      },
    ],
  };

  if (operationButtons != undefined) {
    // オーダー処理用のボタンを追加
    replyText.messages.push(operationButtons);
  }

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Config.LineChanleAccessToken}`,
    },
    payload: JSON.stringify(replyText),
  };

  // 応答を送信
  UrlFetchApp.fetch(LINE_REPLY_URL, options);
}
