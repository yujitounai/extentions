// popup.js

// アクティブタブの取得
function getActiveTabId(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      cb(tabs[0]?.id);
    });
  }
  
  // rawBody（ArrayBuffer[]）を UTF-8 文字列化して表示／コピー用にする関数
  function decodeRawBody(rawChunks) {
    try {
      const decoder = new TextDecoder("utf-8");
      // TextDecoder は元バイナリの CRLF を LF に変換してしまうことがあるため、
      // ここでは「表示とコピー用」にのみ使い、再送時には rawBody を優先します。
      return rawChunks.map(buf => decoder.decode(buf)).join("");
    } catch {
      return "[バイナリデータのため表示できません]";
    }
  }
  
  // multipart/form-data の formData オブジェクトと boundary から
  // マルチパート形式の文字列を再構築する関数
  // 値が空文字のフィールドは「ファイルパート」として扱い、
  // 必ず CRLF (\r\n) を使って改行します。
  function buildMultipartText(formDataObj, boundary) {
    const lines = [];
  
    for (const [field, values] of Object.entries(formDataObj)) {
      values.forEach(val => {
        lines.push(`--${boundary}`);
        if (val === "") {
          // 「空ファイルパート」として扱う場合のヘッダ
          lines.push(`Content-Disposition: form-data; name="${field}"; filename=""`);
          lines.push(`Content-Type: application/octet-stream`);
          // ヘッダ部と本文部を区切る空行
          lines.push("");
          // 本文は空なので、すぐ次の境界に進みます
        } else {
          // 通常のテキストパート
          lines.push(`Content-Disposition: form-data; name="${field}"`);
          // ヘッダ部と本文部を区切る空行
          lines.push("");
          lines.push(val);
        }
      });
    }
  
    // 閉じ境界
    lines.push(`--${boundary}--`);
    // 全部を CRLF で結合
    return lines.join("\r\n");
  }
  
  // すべてのリクエストを取得して画面に表示
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
          // entry.headers を { name: value } のオブジェクトに変換
          const headerObj = entry.headers
            ? entry.headers.reduce((o, { name, value }) => {
                o[name] = value;
                return o;
              }, {})
            : {};
  
          // Content-Type ヘッダーをチェックして multipart かどうか判定
          const ctHeader = (entry.headers || []).find(
            h => h.name.toLowerCase() === "content-type"
          );
          const isMultipart = ctHeader && ctHeader.value.startsWith("multipart/form-data");
          // boundary を抽出
          let boundary = null;
          if (isMultipart) {
            const m = ctHeader.value.match(/boundary=(?:\"?)([^\";]+)/i);
            boundary = m ? m[1] : null;
          }
  
          // Body 表示用テキストを決定
          let bodyForDisplay = "";
          if (isMultipart) {
            // ① rawBody があれば UTF-8 デコードして表示（改行は LF になることがありますが表示のみ）
            if (entry.rawBody) {
              bodyForDisplay = decodeRawBody(entry.rawBody);
            }
            // ② rawBody がなく、かつ formData があれば buildMultipartText で擬似的に再構築
            else if (entry.formData && boundary) {
              bodyForDisplay = buildMultipartText(entry.formData, boundary);
            }
            // ③ どちらもない場合はプレースホルダ
            else {
              bodyForDisplay = "[バイナリ (multipart) データがありません]";
            }
          } else {
            // multipart でなければ bodyText をそのまま表示（空でも OK）
            bodyForDisplay = entry.bodyText || "";
          }
  
          // HTML テンプレートを組み立て
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
            <textarea id="body-${entry.requestId}">${bodyForDisplay}</textarea>
            <div class="btns">
              <button class="resBtn" id="resend-${entry.requestId}">再送</button>
              <button class="copyBtn" id="copy-${entry.requestId}">コピー</button>
            </div>
            <div class="resp" id="resp-${entry.requestId}"></div>
          `;
          container.appendChild(div);
  
          // ── 再送ボタン処理 ──
          div
            .querySelector(`#resend-${entry.requestId}`)
            .addEventListener("click", () => {
              const respDiv = div.querySelector(`#resp-${entry.requestId}`);
              respDiv.textContent = "送信中…";
  
              // ユーザーが編集した URL/Method/Headers/Body を取得
              const editedUrl = div.querySelector(`#url-${entry.requestId}`).value;
              const editedMethod = div.querySelector(`#method-${entry.requestId}`).value;
              let editedHeaders;
              try {
                editedHeaders = JSON.parse(div.querySelector(`#headers-${entry.requestId}`).value);
              } catch (e) {
                respDiv.textContent = "Headers JSON のパースエラー: " + e;
                return;
              }
              let editedBody = div.querySelector(`#body-${entry.requestId}`).value;
  
              // ここで文字列の改行をすべて CRLF に変換
              editedBody = editedBody.replace(/\r?\n/g, "\r\n");
  
              // popup → background にメッセージを送り再送実行
              chrome.runtime.sendMessage(
                {
                  action: "resendEditedRequest",
                  requestId: entry.requestId,
                  url: editedUrl,
                  method: editedMethod,
                  headers: editedHeaders,
                  body: editedBody
                },
                resp => {
                  if (resp.error) {
                    respDiv.textContent = "Error: " + resp.error;
                  } else {
                    respDiv.textContent =
                      `Status: ${resp.status} ${resp.statusText}\n\n` + resp.response;
                  }
                }
              );
            });
  
          // ── コピーボタン処理 ──
          div
            .querySelector(`#copy-${entry.requestId}`)
            .addEventListener("click", async () => {
              // リクエスト行を構築 (entry.protocol を使用)
              const urlObj = new URL(entry.url);
              const requestLine = `${entry.method} ${urlObj.pathname}${urlObj.search} ${entry.protocol ||
                "HTTP/1.1"}`;
  
              // ヘッダーは JSON テキストエリアから取得
              let copyHeaders;
              try {
                copyHeaders = JSON.parse(div.querySelector(`#headers-${entry.requestId}`).value);
              } catch {
                alert("ヘッダーJSONの形式が不正です。");
                return;
              }
              const headerLines = Object.entries(copyHeaders)
                .map(([name, value]) => `${name}: ${value}`)
                .join("\r\n");
  
              // Body: multipart か否かで分岐
              let bodyToCopy = "";
              if (isMultipart) {
                // ① rawBody があればデコードしてコピー（改行は LF になるが表示用）
                if (entry.rawBody) {
                  bodyToCopy = decodeRawBody(entry.rawBody);
                }
                // ② rawBody がなく、かつ formData があれば buildMultipartText で再構築
                else if (entry.formData && boundary) {
                  bodyToCopy = buildMultipartText(entry.formData, boundary);
                }
                // ③ どちらもない場合は空文字
                else {
                  bodyToCopy = "";
                }
              } else {
                bodyToCopy = entry.bodyText || "";
              }
  
              // 「コピー用」にも CRLF を明示的に入れておく
              bodyToCopy = bodyToCopy.replace(/\r?\n/g, "\r\n");
  
              // 最終的な HTTP リクエスト文字列を組み立て
              const rawRequest = [requestLine, headerLines, "", bodyToCopy].join("\r\n");
  
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
  
  // DOM 準備ができたらロード
  document.addEventListener("DOMContentLoaded", loadRequests);
  