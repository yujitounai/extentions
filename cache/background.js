chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "listResources") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: listResources
            }, (results) => {
                if (results && results[0]) {
                    sendResponse({data: results[0].result});
                }
            });
        });
        return true;  // 非同期レスポンスのために必要
    } else if (request.action === "loadJsHeaders") {
        // JSヘッダーを読み込む処理
    }
    if (request.action === "updateBadge") {
        chrome.action.setBadgeText({ text: request.status });
    }
});

function listResources() {
    const resources = document.querySelectorAll('link[rel="stylesheet"], script, img');
    return Array.from(resources).map(res => res.href || res.src).join('\n');
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.active && tab.url && !tab.url.startsWith('chrome://')&& !tab.url.startsWith('chrome-extension://')) {
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            function: loadJavaScriptAndOtherHeaders
        });
    }
});


function loadJavaScriptHeaders() {
    const activeTabDomain = new URL(location.href).hostname;
    const scripts = Array.from(document.scripts).filter(script => script.src && new URL(script.src, location.href).hostname === activeTabDomain);

    if (scripts.length > 0) {
        const scriptUrl = scripts[0].src;
        fetch(scriptUrl, {
            method: 'GET',
            mode: 'no-cors'
        }).then(response => {
            //コンテンツスクリプトは拡張機能のバッジを直接操作することはできないのでメッセージでなんとか。
            //chrome.runtime.sendMessage({ action: "updateBadge", status: response.status.toString() });
            const headersString = Array.from(response.headers).map(header => header[0] + ': ' + header[1]).join('\n');
            console.log(`URL: ${scriptUrl}\nStatus: ${response.status}\n\nHeaders:\n${headersString}`);
        }).catch(error => {
            console.error('Error: ' + error.message);
            chrome.runtime.sendMessage({ action: "updateBadge", status: "err" });
        });
    } else {
        console.log('No JavaScript files from the same domain found.');
        chrome.runtime.sendMessage({ action: "updateBadge", status: "no" });
    }
}

function loadJavaScriptAndOtherHeaders() {
    const activeTabDomain = new URL(location.href).hostname;

    // 同じドメインのJavaScriptファイルを取得
    const scripts = Array.from(document.scripts).filter(script => 
        script.src && new URL(script.src, location.href).hostname === activeTabDomain
    );

    // 同じドメインのCSSファイルを取得
    const stylesheets = Array.from(document.styleSheets).filter(sheet => 
        sheet.href && new URL(sheet.href, location.href).hostname === activeTabDomain
    );

    // 同じドメインの画像ファイルを取得
    const images = Array.from(document.images).filter(img => 
        img.src && new URL(img.src, location.href).hostname === activeTabDomain
    );

    // 各タイプの最初のリソースのURLを取得
    const resourceUrls = [
        scripts.length > 0 ? scripts[0].src : null,
        stylesheets.length > 0 ? stylesheets[0].href : null,
        images.length > 0 ? images[0].src : null
    ].filter(url => url !== null); // nullを除外

    // リソースがなければ終了
    if (resourceUrls.length === 0) {
        console.log('No resources from the same domain found.');
        chrome.runtime.sendMessage({ action: "updateBadge", status: "no" });
        return;
    }

    // 各リソースに対してfetchを実行
    resourceUrls.forEach(url => {
        fetch(url, { method: 'GET', mode: 'no-cors' }).then(response => {
            const status = response.status.toString();
            //chrome.runtime.sendMessage({ action: "updateBadge", status: status });

            // レスポンスヘッダを取得
            const headers = Array.from(response.headers);

            // Cache-Controlヘッダを確認
            const cacheControlHeader = headers.find(header => header[0].toLowerCase() === 'cache-control');
            if (cacheControlHeader && cacheControlHeader[1].includes('max-age')) {
                chrome.runtime.sendMessage({ action: "updateBadge", status: "cache" });
            }

            // X-Cacheヘッダを確認
            const xCacheHeader = headers.find(header => header[0].toLowerCase() === 'x-cache');
            if (xCacheHeader) {
                chrome.runtime.sendMessage({ action: "updateBadge", status: "cache" });
            }

            // X-Cache-Hitsヘッダを確認
            const xCacheHitsHeader = headers.find(header => header[0].toLowerCase() === 'x-cache-hits');
            if (xCacheHitsHeader) {
                chrome.runtime.sendMessage({ action: "updateBadge", status: "cache" });
            }
            const headersString = headers.map(header => `${header[0]}: ${header[1]}`).join('\n');
            console.log(`URL: ${url}\nStatus: ${status}\n\nHeaders:\n${headersString}`);
        }).catch(error => {
            console.error('Error: ' + error.message);
            chrome.runtime.sendMessage({ action: "updateBadge", status: "err" });
        });
    });

}
