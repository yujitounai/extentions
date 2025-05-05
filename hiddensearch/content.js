// 検索対象の正規表現パターン
const PATTERNS = [
    /AKIA[0-9A-Z]{16}/g,       // AWS アクセスキー
    /AIza[0-9A-Za-z_\-]{35}/g       // Google API キー
];

// 検索結果を格納
let searchResults = [];
let isExtensionValid = true;

// メッセージ送信のヘルパー関数
function sendMessageSafely(message) {
    if (!isExtensionValid) return;
    
    try {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                console.warn('メッセージ送信エラー:', chrome.runtime.lastError);
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    isExtensionValid = false;
                    observer.disconnect();
                }
            }
        });
    } catch (error) {
        console.warn('メッセージ送信エラー:', error);
        if (error.message.includes('Extension context invalidated')) {
            isExtensionValid = false;
            observer.disconnect();
        }
    }
}

// 🔽 インラインスクリプトを検索
function searchScriptContent(scriptElement) {
    if (!isExtensionValid) return;
    
    const scriptContent = scriptElement.textContent;
    if (!scriptContent) return;

    PATTERNS.forEach((pattern, patternIndex) => {
        const matches = [...scriptContent.matchAll(pattern)];
        matches.forEach(match => {
            searchResults.push({
                text: scriptContent.trim().slice(0, 300) + '...',
                match: match[0],
                pattern: patternIndex,
                context: 'インラインスクリプト',
                type: 'inline_script'
            });
        });
    });
}

// 🔽 ページ内テキストとインラインスクリプトをスキャン
function searchTextAndInlineScripts() {
    if (!isExtensionValid) return;
    
    const textNodes = document.evaluate('//text()', document.body, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < textNodes.snapshotLength; i++) {
        const node = textNodes.snapshotItem(i);
        const text = node.textContent;

        PATTERNS.forEach((pattern, patternIndex) => {
            const matches = [...text.matchAll(pattern)];
            matches.forEach(match => {
                searchResults.push({
                    text: text.trim().slice(0, 300) + '...',
                    match: match[0],
                    pattern: patternIndex,
                    context: node.parentElement.outerHTML.slice(0, 300) + '...',
                    type: 'text'
                });
            });
        });
    }

    const scripts = document.querySelectorAll('script');
    const externalScriptURLs = [];

    scripts.forEach(script => {
        if (script.src) {
            externalScriptURLs.push(script.src);  // 外部は background.js に任せる
        } else {
            searchScriptContent(script);  // インラインは自分で処理
        }
    });

    // インライン等の結果を送信
    sendMessageSafely({
        type: 'SEARCH_RESULTS',
        results: searchResults
    });

    // 外部スクリプトはバックグラウンドに送る
    if (externalScriptURLs.length > 0) {
        sendMessageSafely({
            type: 'FETCH_AND_SCAN_EXTERNAL_SCRIPTS',
            urls: externalScriptURLs
        });
    }
}

// ページ読み込み時に検索開始
document.addEventListener('DOMContentLoaded', searchTextAndInlineScripts);

// 動的変更にも対応
const observer = new MutationObserver(() => {
    searchTextAndInlineScripts();
});

observer.observe(document.body, { childList: true, subtree: true });
