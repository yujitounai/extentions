// popup.js

// アクティブタブの取得
function getActiveTabId(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        cb(tabs[0]?.id);
    });
}

// すべてのリクエストを読み込んで表示
function loadRequests() {
    getActiveTabId(tabId => {
        chrome.runtime.sendMessage({ action: "getAllRequests", tabId }, list => {
            const container = document.getElementById("requests");
            if (!list || list.length === 0) {
                container.textContent = "リクエストがありません。";
                return;
            }
            container.innerHTML = "";

            list.forEach(entry => {
                // ヘッダー配列 → オブジェクトに変換
                const headerObj = entry.headers
                    ? entry.headers.reduce((o, { name, value }) => { o[name] = value; return o; }, {})
                    : {};

                const div = document.createElement("div");
                div.className = "entry";
                div.innerHTML = `
            <div>[${entry.time}]</div>
            <label>URL:</label>
            <input type="text" id="url-${entry.requestId}" value="${entry.url}">
            <label>Method:</label>
            <select id="method-${entry.requestId}">
              <option ${entry.method === "GET" ? "selected" : ""}>GET</option>
              <option ${entry.method === "POST" ? "selected" : ""}>POST</option>
              <option ${entry.method === "PUT" ? "selected" : ""}>PUT</option>
              <option ${entry.method === "DELETE" ? "selected" : ""}>DELETE</option>
              <option ${entry.method === "PATCH" ? "selected" : ""}>PATCH</option>
              <option ${entry.method === "HEAD" ? "selected" : ""}>HEAD</option>
            </select>
            <label>Headers (JSON):</label>
            <textarea id="headers-${entry.requestId}">${JSON.stringify(headerObj, null, 2)}</textarea>
            <label>Body:</label>
            <textarea id="body-${entry.requestId}">${entry.body || ""}</textarea>
            <div class="btns">
              <button class="resBtn" id="resend-${entry.requestId}">再送</button>
              <button class="copyBtn" id="copy-${entry.requestId}">コピー</button>
            </div>
            <div class="resp" id="resp-${entry.requestId}"></div>
          `;
                container.appendChild(div);

                // ―― 再送ボタン処理
                div.querySelector(`#resend-${entry.requestId}`).addEventListener("click", () => {
                    const respDiv = div.querySelector(`#resp-${entry.requestId}`);
                    respDiv.textContent = "送信中…";

                    // フォームから値を取得
                    const editedUrl = div.querySelector(`#url-${entry.requestId}`).value;
                    const editedMethod = div.querySelector(`#method-${entry.requestId}`).value;
                    let editedHeaders;
                    try {
                        editedHeaders = JSON.parse(div.querySelector(`#headers-${entry.requestId}`).value);
                    } catch (e) {
                        respDiv.textContent = "Headers JSON のパースエラー: " + e;
                        return;
                    }
                    const editedBody = div.querySelector(`#body-${entry.requestId}`).value;

                    chrome.runtime.sendMessage({
                        action: "resendEditedRequest",
                        requestId: entry.requestId,
                        url: editedUrl,
                        method: editedMethod,
                        headers: editedHeaders,
                        body: editedBody
                    }, resp => {
                        if (resp.error) {
                            respDiv.textContent = "Error: " + resp.error;
                        } else {
                            respDiv.textContent =
                                `Status: ${resp.status} ${resp.statusText}\n\n` +
                                resp.response;
                        }
                    });
                });

                // popup.js の該当部分だけ抜粋

                // …（list.forEach の中）
                div.querySelector(`#copy-${entry.requestId}`).addEventListener("click", async () => {
                    // URL からパス+クエリを生成
                    const urlObj = new URL(entry.url);
                    const requestLine = `${entry.method} ${urlObj.pathname}${urlObj.search} ${entry.protocol || "HTTP/1.1"}`;

                    // キャプチャしたヘッダーをそのまま１行ずつ
                    const headerLines = entry.headers
                        .map(h => `${h.name}: ${h.value}`)
                        .join("\r\n");

                    // ボディが空なら空行のみ
                    const rawRequest = [
                        requestLine,
                        headerLines,
                        "",               // ヘッダーとボディの間の空行
                        entry.body || ""  // ボディ（ある場合のみ）
                    ].join("\r\n");

                    try {
                        await navigator.clipboard.writeText(rawRequest);
                        alert("リクエストを HTTP 形式でコピーしました！");
                    } catch (err) {
                        alert("コピーに失敗しました: " + err);
                    }
                });


            });
        });
    });
}

document.addEventListener("DOMContentLoaded", loadRequests);
