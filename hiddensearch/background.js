const PATTERNS = [
    /AKIA[0-9A-Z]{16}/g,
    /AIza[0-9A-Za-z_\-]{35}/g       // Google API キー
];

let currentResults = [];

// 外部スクリプト取得＆スキャン
async function fetchAndScanScript(url) {
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
                currentResults.push({
                    text: text.trim().slice(0, 300) + '...',
                    match: match[0],
                    pattern: patternIndex,
                    context: `外部スクリプト: ${url}`,
                    type: 'external_script'
                });
            });
        });
    } catch (_) {
        return;
    }
}

// メッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEARCH_RESULTS') {
        currentResults.push(...message.results);
    
        let iconPath = currentResults.length > 0 ? {
            "16": "/images/icon16_alert.png",
            "48": "/images/icon48_alert.png",
            "128": "/images/icon128_alert.png"
        } : {
            "16": "/images/icon16.png",
            "48": "/images/icon48.png",
            "128": "/images/icon128.png"
        };
    
        if (sender?.tab?.id !== undefined) {
            chrome.action.setIcon({ tabId: sender.tab.id, path: iconPath });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const validTab = tabs.find(tab => tab.id && /^https?:/.test(tab.url));
                if (validTab) {
                    chrome.action.setIcon({ tabId: validTab.id, path: iconPath });
                }
            });
        }
    
        sendResponse({ success: true });
    }
    

    else if (message.type === 'FETCH_AND_SCAN_EXTERNAL_SCRIPTS') {
        const fetches = message.urls.map(url => fetchAndScanScript(url));
        Promise.all(fetches).then(() => {
            chrome.action.setIcon({
                path: currentResults.length > 0 ? {
                    "16": "/images/icon16_alert.png",
                    "48": "/images/icon48_alert.png",
                    "128": "/images/icon128_alert.png"
                } : {
                    "16": "/images/icon16.png",
                    "48": "/images/icon48.png",
                    "128": "/images/icon128.png"
                }
            });
        });
        sendResponse({ success: true });
        return true;
    }

    else if (message.type === 'GET_RESULTS') {
        sendResponse({ results: currentResults });
        return true;
    }
});

// タブ更新時に初期化
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        currentResults = [];
        chrome.action.setIcon({
            path: {
                "16": "/images/icon16.png",
                "48": "/images/icon48.png",
                "128": "/images/icon128.png"
            }
        });
    }
});
