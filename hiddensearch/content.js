// content.js の先頭付近に追加
function shouldSuppressError(error) {
    return error && error.message && (
      error.message.includes('Extension context invalidated') ||
      error.message.includes('Extension has been shutdown')
    );
}

// 検索対象の正規表現パターン
const PATTERNS = [
    /AKIA[0-9A-Z]{16}/g,       // AWS アクセスキー
    /AIza[0-9A-Za-z_\-]{35}/g       // Google API キー
];

// 検索結果を格納
let searchResults = [];
let isExtensionValid = true;


function extractContext(text, match, radius = 30) {
    const index = text.indexOf(match);
    if (index === -1) return text.slice(0, 100) + '...';
    
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + match.length + radius);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    
    return prefix + text.slice(start, end) + suffix;
}

function searchScriptContent(scriptElement) {
    const scriptContent = scriptElement.textContent;
    if (!scriptContent) return [];

    const results = [];
    PATTERNS.forEach((pattern, patternIndex) => {
        const matches = [...scriptContent.matchAll(pattern)];
        matches.forEach(match => {
            results.push({
                text: extractContext(scriptContent, match[0]),
                match: match[0],
                pattern: patternIndex,
                context: 'インラインスクリプト',
                type: 'inline_script'
            });
        });
    });
    return results;
}

// メッセージ送信のヘルパー関数
function sendMessageSafely(message) {
    if (!isExtensionValid) return;

    try {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError;
                if (!shouldSuppressError(err)) {
                    console.warn('メッセージ送信エラー:', err);
                }
                // エラーが Extension context invalidated の場合のみ停止フラグ設定
                if (shouldSuppressError(err)) {
                    isExtensionValid = false;
                    observer.disconnect();
                }
            }
        });
    } catch (error) {
        if (!shouldSuppressError(error)) {
            console.warn('メッセージ送信エラー:', error);
        }
        if (shouldSuppressError(error)) {
            isExtensionValid = false;
            observer.disconnect();
        }
    }
}

function searchTextNodes() {
    const results = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while ((node = walker.nextNode())) {
        const text = node.nodeValue;
        if (!text) continue;

        PATTERNS.forEach((pattern, patternIndex) => {
            const matches = [...text.matchAll(pattern)];
            matches.forEach(match => {
                results.push({
                    text: extractContext(text, match[0]),
                    match: match[0],
                    pattern: patternIndex,
                    context: node.parentElement?.tagName || 'テキストノード',
                    type: 'text'
                });
            });
        });
    }
    return results;
}

function searchTextAndInlineScripts() {
    const results = [
        ...searchTextNodes(),
        ...Array.from(document.querySelectorAll('script:not([src])'))
              .flatMap(script => searchScriptContent(script))
    ];

    const externalScriptURLs = Array.from(document.querySelectorAll('script[src]'))
                                 .map(script => script.src);

    chrome.runtime.sendMessage({
        type: 'SEARCH_RESULTS',
        results: results
    });

    if (externalScriptURLs.length > 0) {
        chrome.runtime.sendMessage({
            type: 'FETCH_AND_SCAN_EXTERNAL_SCRIPTS',
            urls: externalScriptURLs
        });
    }
}

// ページ読み込み時に検索開始
document.addEventListener('DOMContentLoaded', searchTextAndInlineScripts);

// 動的変更にも対応
// content.js の observer 部分を変更
try {
    const observer = new MutationObserver(() => {
        if (!isExtensionValid) {
            observer.disconnect();
            return;
        }
        searchTextAndInlineScripts();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
} catch (error) {
    if (shouldSuppressError(error)) {
        isExtensionValid = false;
    } else {
        console.warn('MutationObserver setup error:', error);
    }
}
