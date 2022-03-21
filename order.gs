const LINE_MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast";

/**
 * フォームにてオーダーを受けたら呼び出される
 */
function receivedOrder(event) {
  // フォームで追加された行番号をオーダーIDとする
  const orderId = event.range.getRow();
  setOrderId(orderId);

  const order = getOrder(orderId);

  // オーダー受付時
  let message = `以下のオーダーが届きました。`;
  message += createOrderMessage(order);
  pushMessageToOwner(message, orderId);
}

/**
 * オーダーIDをセルに反映
 * @param orderId
 */
function setOrderId(orderId) {
  Sheet.Order.getRange(orderId, OrderSheetHeaders.OrderId).setValue(orderId);
}

/**
 * オーナーにLINE通知
 * @param message
 * @param orderId
 * @returns
 */
function pushMessageToOwner(message, orderId) {
  const postData = {
    to: [Config.YourUserId],
    messages: [
      {
        type: "text",
        text: message,
      },
      createOperationButtons(orderId),
    ],
  };

  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    Authorization: `Bearer ${Config.LineChanleAccessToken}`,
  };

  const options = {
    method: "POST",
    headers: headers,
    payload: JSON.stringify(postData),
  };
  return UrlFetchApp.fetch(LINE_MULTICAST_URL, options);
}

/**
 * オーダー操作用のボタンを作成
 * @param orderId
 * @returns
 */
function createOperationButtons(orderId) {
  return {
    type: "template",
    altText: "オーダー操作",
    template: {
      type: "buttons",
      title: `注文番号`,
      text: `${orderId}`,
      actions: [
        {
          type: "postback",
          label: Operation.OrderAccept,
          data: `${Operation.OrderAccept},${orderId}`,
        },
        {
          type: "postback",
          label: Operation.Delivering,
          data: `${Operation.Delivering},${orderId}`,
        },
        {
          type: "postback",
          label: Operation.Delivered,
          data: `${Operation.Delivered},${orderId}`,
        },
      ],
    },
  };
}
