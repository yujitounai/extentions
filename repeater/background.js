// background.js

// タブごとのリクエストリストを保持
const tabRequests = {};
const MAX_ENTRIES = 100;

// 1. onBeforeRequest: URL／メソッド／ボディをキャプチャ
chrome.webRequest.onBeforeRequest.addListener(
  details => {
    const { tabId, requestId, url, method, requestBody, type } = details;
    if (tabId < 0) return;

    // タブごとの配列を初期化
    if (!tabRequests[tabId]) tabRequests[tabId] = [];

    // 新規エントリを生成
    const entry = {
      requestId,
      url,
      method,
      time: new Date().toLocaleTimeString(),
      headers: null,
      protocol: null,

      // rawBody: multipart/form-data 等で送られた生バイナリを保持
      rawBody: null,    
      // formData: フォームフィールド（テキスト・ファイルなど）の情報を保持
      formData: null,   
      // bodyText: application/x-www-form-urlencoded 等を文字列化して保持（念のため）
      bodyText: null    
    };

    if (requestBody) {
      // ① 生バイナリチャンクがあれば rawBody に保存
      if (requestBody.raw && requestBody.raw.length > 0) {
        entry.rawBody = requestBody.raw.map(chunk => chunk.bytes);
      }
      // ② formData があればそのまま保持し、bodyText には URL エンコード文字列を保存
      if (requestBody.formData) {
        entry.formData = requestBody.formData;
        entry.bodyText = new URLSearchParams(requestBody.formData).toString();
      }
    }

    // main_frame（タブロード）のリクエストは先頭に、それ以外は末尾に
    if (type === "main_frame") {
      tabRequests[tabId].unshift(entry);
    } else {
      tabRequests[tabId].push(entry);
    }

    // メモリ保護: 最大件数を超えたら末尾を削除
    if (tabRequests[tabId].length > MAX_ENTRIES) {
      tabRequests[tabId].pop();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// 2. onBeforeSendHeaders: ヘッダをキャプチャ（extraHeaders を付与して Host も取得）
chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    const { tabId, requestId, requestHeaders, url } = details;
    if (tabId < 0 || !tabRequests[tabId]) return;

    const entry = tabRequests[tabId].find(e => e.requestId === requestId);
    if (!entry) return;

    // もとのヘッダ配列をコピー
    let headers = requestHeaders.slice();

    // Host 欄がなければ URL から生成して先頭に追加
    if (!headers.some(h => h.name.toLowerCase() === "host")) {
      const host = new URL(url).host;
      headers.unshift({ name: "Host", value: host });
    }

    entry.headers = headers;
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// 3. onCompleted: ステータスラインからプロトコル（HTTP/1.1 or HTTP/2）を取得
chrome.webRequest.onCompleted.addListener(
  details => {
    const { tabId, requestId, statusLine } = details;
    if (tabId < 0 || !tabRequests[tabId]) return;

    const entry = tabRequests[tabId].find(e => e.requestId === requestId);
    if (!entry) return;

    // 例: statusLine === "HTTP/1.1 200 OK" なら entry.protocol = "HTTP/1.1"
    entry.protocol = statusLine.split(" ")[0];
  },
  { urls: ["<all_urls>"] }
);

// 4. ポップアップからのメッセージを処理
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const { action, tabId, requestId, url, method, headers, body } = msg;

  // (A) 全リクエスト取得
  if (action === "getAllRequests") {
    sendResponse(tabRequests[tabId] || []);
    return;
  }

  // (B) キャプチャしたオリジナルリクエストを再送
  if (action === "resendRequest") {
    const list = tabRequests[tabId] || [];
    const req = list.find(e => e.requestId === requestId);
    if (!req) {
      sendResponse({ error: "該当リクエストが見つかりません。" });
      return;
    }

    // fetch 用 init オブジェクトを作成
    const init = {
      method: req.method,
      // ヘッダーは { name: value } のオブジェクト形式に変換
      headers: req.headers.reduce((h, { name, value }) => {
        h[name] = value;
        return h;
      }, {})
    };

    // ① rawBody が存在すればそれをそのまま結合して再送
    if (req.rawBody) {
      let totalLength = req.rawBody.reduce((sum, buf) => sum + buf.byteLength, 0);
      let combined = new Uint8Array(totalLength);
      let offset = 0;
      req.rawBody.forEach(buf => {
        let chunk = new Uint8Array(buf);
        combined.set(chunk, offset);
        offset += buf.byteLength;
      });
      init.body = combined.buffer;

      // ※fetch() は ArrayBuffer を渡すと自動で Content-Length を設定します
    }
    // ② rawBody がないが formData があれば FormData を再構築して再送
    else if (req.formData) {
      const fd = new FormData();
      for (const [key, values] of Object.entries(req.formData)) {
        // ファイルアップロード欄の場合、空文字列 ("") しか入っていないので
        // そのまま append(key, "") しておくと空のテキストパートになります
        values.forEach(val => fd.append(key, val));
      }
      init.body = fd;
      // fetch() に FormData を渡すと、自動的に multipart/form-data; boundary=... を付与します
      // → したがって、このときは手動で Content-Type ヘッダーを削除する
      delete init.headers["Content-Type"];
    }
    // ③ 上記どちらもないが bodyText があればテキストとして再送
    else if (req.bodyText && req.method !== "GET" && req.method !== "HEAD") {
      init.body = req.bodyText;
      // fetch() は文字列を渡すと Text 送出になるので、自動で Content-Type: text/plain;charset=UTF-8 になります
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

    // 非同期応答のため true を返す
    return true;
  }

  // (C) 編集済リクエストを再送
  if (action === "resendEditedRequest") {
    // popup.js でユーザーが編集した URL/Method/Headers/Body を受け取り
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
