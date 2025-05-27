// background.js

// タブごとのリクエストリストを保持
const tabRequests = {};
const MAX_ENTRIES = 100;

// onBeforeRequest: URL／メソッド／ボディをキャプチャ
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    const { tabId, requestId, url, method, requestBody, type } = details;
    if (tabId < 0) return;

    if (!tabRequests[tabId]) tabRequests[tabId] = [];

    // ボディをテキスト化
    let body = "";
    if (requestBody) {
      if (requestBody.raw) {
        const decoder = new TextDecoder("utf-8");
        body = requestBody.raw.map(chunk => decoder.decode(chunk.bytes)).join("");
      } else if (requestBody.formData) {
        body = new URLSearchParams(requestBody.formData).toString();
      }
    }

    // 新規エントリを作成
    const entry = {
      requestId,
      url,
      method,
      body,
      time: new Date().toLocaleTimeString(),
      headers: null,
      protocol: null
    };

    // main_frame（ページロード）は先頭に、それ以外は末尾に
    if (type === "main_frame") {
      tabRequests[tabId].unshift(entry);
    } else {
      tabRequests[tabId].push(entry);
    }

    // 上限を超えたら末尾を削除
    if (tabRequests[tabId].length > MAX_ENTRIES) {
      tabRequests[tabId].pop();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// onBeforeSendHeaders: ヘッダをキャプチャ（Host が無ければ挿入）
chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    const { tabId, requestId, requestHeaders, url } = details;
    if (tabId < 0 || !tabRequests[tabId]) return;

    const entry = tabRequests[tabId].find(e => e.requestId === requestId);
    if (!entry) return;

    // リクエストヘッダをコピー
    let headers = requestHeaders.slice();

    // Host ヘッダがなければ URL から生成して先頭に追加
    if (!headers.some(h => h.name.toLowerCase() === "host")) {
      const host = new URL(url).host;
      headers.unshift({ name: "Host", value: host });
    }

    entry.headers = headers;
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// onCompleted: プロトコルをキャプチャ（HTTP/1.1 or HTTP/2）
chrome.webRequest.onCompleted.addListener(
  details => {
    const { tabId, requestId, statusLine } = details;
    if (tabId < 0 || !tabRequests[tabId]) return;

    const entry = tabRequests[tabId].find(e => e.requestId === requestId);
    if (!entry) return;

    entry.protocol = statusLine.split(" ")[0];
  },
  { urls: ["<all_urls>"] }
);

// ポップアップからのメッセージを処理
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const { action, tabId, requestId, url, method, headers, body } = msg;

  // 全リクエスト取得
  if (action === "getAllRequests") {
    sendResponse(tabRequests[tabId] || []);
    return;
  }

  // 元のキャプチャを再送
  if (action === "resendRequest") {
    const list = tabRequests[tabId] || [];
    const req = list.find(e => e.requestId === requestId);
    if (!req) {
      sendResponse({ error: "該当リクエストが見つかりません。" });
      return;
    }

    const init = {
      method: req.method,
      headers: req.headers.reduce((h, { name, value }) => {
        h[name] = value;
        return h;
      }, {})
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      init.body = req.body;
    }

    fetch(req.url, init)
      .then(async res => {
        const text = await res.text();
        sendResponse({
          requestId,
          status: res.status,
          statusText: res.statusText,
          response: text
        });
      })
      .catch(err => {
        sendResponse({ requestId, error: err.toString() });
      });

    return true;
  }

  // 編集済リクエストを再送
  if (action === "resendEditedRequest") {
    const init = {
      method,
      headers: headers || {}
    };
    if (method !== "GET" && method !== "HEAD" && body) {
      init.body = body;
    }

    fetch(url, init)
      .then(async res => {
        const text = await res.text();
        sendResponse({
          requestId,
          status: res.status,
          statusText: res.statusText,
          response: text
        });
      })
      .catch(err => {
        sendResponse({ requestId, error: err.toString() });
      });

    return true;
  }
});
