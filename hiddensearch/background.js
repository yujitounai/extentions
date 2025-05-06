// background.js の先頭に追加
let isExtensionValid = true;

chrome.runtime.onSuspend.addListener(() => {
    isExtensionValid = false;
});

chrome.runtime.onSuspendCanceled.addListener(() => {
    isExtensionValid = true;
});

const PATTERNS = [
    /AKIA[0-9A-Z]{16}/g,
    /AIza[0-9A-Za-z_\-]{35}/g       // Google API キー
];

const tabResults = {};

function getResults(tabId) {
  return tabResults[tabId] ?? [];
}

// 検出箇所周辺テキストを抽出する関数
function extractContext(text, match, radius = 30) {
    const index = text.indexOf(match);
    if (index === -1) return text.slice(0, 100) + '...';
    
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + match.length + radius);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    
    return prefix + text.slice(start, end) + suffix;
}

async function fetchAndScanScript(url, tabId) {
    try {
        const pageIsHttps = true;
        const scriptIsHttp = new URL(url).protocol === 'http:';
        if (pageIsHttps && scriptIsHttp) return;

        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return;

        const text = await res.text();

        PATTERNS.forEach((pattern, patternIndex) => {
            const matches = [...text.matchAll(pattern)];
            matches.forEach(match => {
                const matchedText = match[0];
                tabResults[tabId] = (tabResults[tabId] ?? []).concat({
                    text: extractContext(text, matchedText),
                    match: matchedText,
                    pattern: patternIndex,
                    context: `外部スクリプト: ${url}`,
                    type: 'external_script'
                });
            });
        });
    } catch (_) {}
}


function setIcon(tabId) {
  const hasHits = getResults(tabId).length > 0;
  const path = hasHits
    ? { "16": "/images/icon16_alert.png", "48": "/images/icon48_alert.png", "128": "/images/icon128_alert.png" }
    : { "16": "/images/icon16.png",       "48": "/images/icon48.png",       "128": "/images/icon128.png" };
  chrome.action.setIcon({ tabId, path });
}

// 外部スクリプト取得＆スキャン
async function fetchAndScanScript(url, tabId) {
    try {
        const pageIsHttps = true;
        const scriptIsHttp = new URL(url).protocol === 'http:';
        if (pageIsHttps && scriptIsHttp) return;

        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return;

        const text = await res.text();

        PATTERNS.forEach((pattern, patternIndex) => {
            const matches = [...text.matchAll(pattern)];
            matches.forEach(match => {
                tabResults[tabId] = (tabResults[tabId] ?? []).concat({
                    text: text.trim().slice(0, 300) + '...',
                    match: match[0],
                    pattern: patternIndex,
                    context: `外部スクリプト: ${url}`,
                    type: 'external_script'
                });
            });
        });
    } catch (_) {
        // エラー抑制
        return;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    if (message.type === 'SEARCH_RESULTS' && tabId !== undefined) {
        // インライン検索結果
        tabResults[tabId] = (tabResults[tabId] ?? []).concat(message.results);
        setIcon(tabId);

        // ポップアップとアクティブタブ両方更新
        const results = getResults(tabId);
        const iconPath = results.length > 0
            ? { "16": "/images/icon16_alert.png", "48": "/images/icon48_alert.png", "128": "/images/icon128_alert.png" }
            : { "16": "/images/icon16.png",       "48": "/images/icon48.png",       "128": "/images/icon128.png" };

        chrome.action.setIcon({ tabId, path: iconPath });
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'FETCH_AND_SCAN_EXTERNAL_SCRIPTS' && tabId !== undefined) {
        // 外部スクリプトスキャン
        const fetches = message.urls.map(url => fetchAndScanScript(url, tabId));
        Promise.all(fetches).then(() => {
            setIcon(tabId);
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'GET_RESULTS') {
        // ポップアップからの結果取得
        sendResponse({ results: getResults(message.tabId) });
        return true;
    }
});

// タブ更新時に結果とアイコンをリセット
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        delete tabResults[tabId];
        setIcon(tabId);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        // 拡張機能が無効化されている場合のチェック
        if (!chrome.runtime?.id) {
            throw new Error('Extension context invalidated');
        }

        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ success: false, error: 'Invalid tab ID' });
            return true;
        }

        // 既存のメッセージ処理...
        
    } catch (error) {
        console.error('Background message handler error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
        return true;
    }
});