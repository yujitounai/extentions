document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const activeTab = tabs[0];
        const activeTabDomain = new URL(activeTab.url).hostname;

        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: listResources,
            args: [activeTabDomain]
        }, (results) => {
            if (results && results[0]) {
                document.getElementById('resourceList').value = formatResourceList(results[0].result);
                const staticscanElement = document.getElementById('staticscan');
                const urlList = formatResourceList(results[0].result);
                //S3バケットを探す
                const awsUrls = urlList[1].filter(url => {
                    try {
                        const hostname = new URL(url).hostname;
                        return hostname.endsWith('amazonaws.com') || hostname.includes('.s3.amazonaws.com');
                    } catch (error) {
                        return false;
                    }
                });

                staticscanElement.innerHTML = awsUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');

                const jsscanElement = document.getElementById('jsscan');
                const allurlList = Array.from(new Set(urlList[0].concat(urlList[1])));
                // .cssファイルを除外するフィルタリング
                const jsUrlList = allurlList.filter(url => !url.endsWith('.css'));

                const vulnerablePaths = [
                    '/purl.js',
                    '/jquery.query.js',
                    '/jquery.query-object.js',
                    '/pdf.js',
                    '/lodash.js',
                    'lodash.min.js',
                    'jquery-1.7.2.'
                ];

                const isVulnerable = (url) => {
                    return vulnerablePaths.some(path => url.includes(path));
                };

                const vulnjsUrls = allurlList.filter(url => {
                    try {
                        return isVulnerable(url);
                    } catch (error) {
                        return false;
                    }
                });
                jsscanElement.innerHTML = vulnjsUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');

                const regexScanElement = document.getElementById('regexscan');
                const suspiciousElement = document.getElementById('suspicious');
                const excludeDomains = [
                    'www.gstatic.com',
                    'pagead2.googlesyndication.com',
                    'platform.twitter.com'
                ];
                const regexUrls = allurlList.filter(url => {
                    try {
                        const hostname = new URL(url).hostname;
                        return url.endsWith('.js') && !excludeDomains.some(domain => hostname.endsWith(domain));
                    } catch (error) {
                        return false;
                    }
                });
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    function: checkForRegex,
                    args: [regexUrls]
                }, (regexResults) => {
                    if (regexResults && regexResults[0] && regexResults[0].result) {
                        const regexUrls = regexResults[0].result.regexUrls || [];
                        const suspiciousUrls = regexResults[0].result.suspiciousUrls || [];
                        regexScanElement.innerHTML = regexUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');
                        suspiciousElement.innerHTML = suspiciousUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');
                    } else {
                        regexScanElement.innerHTML = '';
                        suspiciousElement.innerHTML = '';
                    }
                });

                // キーワード検索
                const keywords = ['URLSearchParams', 'decodeURI', 'location', 'Ziggy', 'jsRoutes', 'Object.prototype', 'eval(', 'innerHTML','.html(']; // Replace with your list of keywords

                // 検索対象のURLリストを準備
                const keywordUrls = allurlList.filter(url => {
                    try {
                        const hostname = new URL(url).hostname;
                        return url.endsWith('.js') && !excludeDomains.some(domain => hostname.endsWith(domain));
                    } catch (error) {
                        return false;
                    }
                });

                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    function: searchForKeywords,
                    args: [keywordUrls, keywords]
                }, (results) => {
                    if (results && results[0] && results[0].result) {
                        const keywordResults = results[0].result;
                        const keywordResultsElement = document.getElementById('keywordResults');
                        if (keywordResults.length > 0) {
                            keywordResultsElement.innerHTML = keywordResults.map(item => `<a href="${item.url}" target="_blank">${item.url}</a>: ${item.foundKeywords.join(', ')}`).join('<br>');
                        } else {
                            keywordResultsElement.innerHTML = 'No keywords found.';
                        }
                    }
                });

            }
        });
    });

    const loadJsButton = document.getElementById('loadJs');
    if (loadJsButton) {
        loadJsButton.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const activeTab = tabs[0];
                const activeTabDomain = new URL(activeTab.url).hostname;

                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    function: loadJavaScriptAndCssAndImageHeaders,
                    args: [activeTabDomain]
                }, (results) => {
                    if (results && results[0]) {
                        const jsHeaders = results[0].result;
                        document.getElementById('jsHeaders').value = jsHeaders;

                        // X-Forwarded-Host Found in Body を含む行を検索
                        const lines = jsHeaders.split('\n');
                        const xForwardedHostFoundLine = lines.find(line => line.includes('X-Forwarded-Host Found in Body:'));
                        const xForwardedForFoundLine = lines.find(line => line.includes('X-Forwarded-For Found in Body:'));
                        const xOthersFoundLine = lines.find(line => line.includes('X-Others Found in Body:'));
                        const DoSLine = lines.find(line => line.includes('Status: 404 Not Found'));

                        if (xForwardedHostFoundLine) {
                            // X-Forwarded-Host Found in Body を含む行が見つかった場合、表示する
                            const urlTextElement = document.getElementById('xForwardedHostFoundLine');
                            urlTextElement.innerHTML = xForwardedHostFoundLine;
                        }
                        if (xForwardedForFoundLine) {
                            // X-Forwarded-For Found in Body を含む行が見つかった場合、表示する
                            const urlTextElement = document.getElementById('xForwardedForFoundLine');
                            urlTextElement.innerHTML = xForwardedForFoundLine;
                        }
                        if (xOthersFoundLine) {
                            // X-Others Found in Body を含む行が見つかった場合、表示する
                            const urlTextElement = document.getElementById('xOthersFoundLine');
                            urlTextElement.innerHTML = xOthersFoundLine;
                        }
                        if (DoSLine) {
                            // 404 を含む行が見つかった場合、表示する
                            const urlTextElement = document.getElementById('xOthersFoundLine');
                            urlTextElement.innerHTML = DoSLine;
                        }
                    }
                });
            });
        });
    }
    const jQuery171Button = document.getElementById('jQuery171');
    if (jQuery171Button) {
        jQuery171Button.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const activeTab = tabs[0];
                const url = activeTab.url;
                window.open(url + '#(%20%20%20%20%20%20%20%20xxx())', '_blank');
            });
        });
    }

    const jQuery183Button = document.getElementById('jQuery183');
    if (jQuery183Button) {
        jQuery183Button.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const activeTab = tabs[0];
                const url = activeTab.url;
                window.open(url + '#A' + '*'.repeat(50000) + 'A', '_blank');
            });
        });
    }
    const XSLeakButton = document.getElementById('XSLeak');
    if (XSLeakButton) {
        XSLeakButton.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const activeTab = tabs[0];
                const url = activeTab.url;
                window.open(url + '#x,*:has(*:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):contains(\'t\')', '_blank');
            });
        });
    }
    const ppButton = document.getElementById('pp');
    if (ppButton) {
        ppButton.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const activeTab = tabs[0];
                const url = activeTab.url;
                window.open(url + '#__proto__[foo]=bar&constructor[prototype][foo]=bar&__proto__.foo=bar&constructor.prototype.test=test', '_blank');
            });
        });
    }
});
function loadJavaScriptAndCssAndImageHeaders(activeTabDomain) {
    // fetchResource関数を内部に定義
    function fetchResource(url) {
        // ランダムな12桁数値を生成
        const randomValue1 = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        const randomValue2 = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        const randomValue3 = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        const randomValue4 = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        // 既存のクエリストリングがあるか確認
        const hasQuery = url.includes('?');

        // リクエストヘッダを設定
        const headers = new Headers();
        headers.append('X-Forwarded-Host', randomValue2);
        headers.append('X-Forwarded-For', randomValue3);
        headers.append('Base-Url', randomValue4);
        headers.append('Client-IP', randomValue4);
        headers.append('Http-Url', randomValue4);
        headers.append('Proxy-Host', randomValue4);
        headers.append('Proxy-Url', randomValue4);
        headers.append('Real-Ip', randomValue4);
        headers.append('Redirect', randomValue4);
        headers.append('Referer', randomValue4);
        headers.append('Referrer', randomValue4);
        headers.append('Refferer', randomValue4);
        headers.append('Request-Uri', randomValue4);
        headers.append('Uri', randomValue4);
        headers.append('Url', randomValue4);
        headers.append('X-Client-IP', randomValue4);
        headers.append('X-Custom-IP-Authorization', randomValue4);
        headers.append('X-Forward-For', randomValue4);
        headers.append('X-Forwarded-By', randomValue4);
        headers.append('X-Forwarded-For-Original', randomValue4);
        headers.append('X-Forwarded-Port', randomValue4);
        headers.append('X-Forwarded-Scheme', randomValue4);
        headers.append('X-Forwarded-Server', randomValue4);
        headers.append('X-Forwarded', randomValue4);
        headers.append('X-Forwarder-For', randomValue4);
        headers.append('X-Host', randomValue4);
        headers.append('X-Http-Destinationurl', randomValue4);
        headers.append('X-Http-Host-Override', randomValue4);
        headers.append('X-Original-Remote-Addr', randomValue4);
        headers.append('X-Original-Url', randomValue4);
        headers.append('X-Originating-IP', randomValue4);
        headers.append('X-Proxy-Url', randomValue4);
        headers.append('X-Real-Ip', randomValue4);
        headers.append('X-Remote-Addr', randomValue4);
        headers.append('X-Remote-IP', randomValue4);
        headers.append('X-Rewrite-Url', randomValue4);
        headers.append('X-True-IP', randomValue4);
        headers.append('X-Timer', randomValue4);
        headers.append('X-Http-Method-Override', randomValue4);
        headers.append('Max-Forwards', randomValue4);
        //        headers.append('Accept-Encoding', randomValue4);

        // URLにクエリストリングを追加してfetchを実行
        const fetchUrl = `${url}${hasQuery ? '&' : '?'}cb=${randomValue1}`;

        return fetch(fetchUrl, {
            method: 'GET',
            headers: headers
        }).then(async response => {
            const headersString = Array.from(response.headers).map(header => `${header[0]}: ${header[1]}`).join('\n');

            // 404エラーの処理
            if (response.status === 404) {
                console.log('404');
                result = `Status: 404 Not Found: <a href="${fetchUrl}" target="_blank">${fetchUrl}</a>`;
                return `${result}`;
            }

            // レスポンスのbodyを取得
            const body = await response.text();

            // bodyにX-Forwarded-Hostの値が含まれているか検索
            const containsXForwardedHost = body.includes(`${randomValue2}`);
            // bodyにX-Forwarded-Forの値が含まれているか検索
            const containsXForwardedFor = body.includes(`${randomValue3}`);
            // bodyにX-その他の値が含まれているか検索
            const containsXother = body.includes(`${randomValue4}`);
            // リクエストヘッダ、URL、レスポンス、含まれているかの情報を結合して返す
            result = `Request Header:\nX-Forwarded-Host: ${randomValue2}\n\nX-Forwarded-For: ${randomValue3}\n\nX-Others: ${randomValue4}\n\nURL: ${fetchUrl}\nStatus: ${response.status}\n\nHeaders:\n${headersString}\n\nBody:\n${body}`;

            if (containsXForwardedHost) {
                result = `${result}\n\nX-Forwarded-Host Found in Body: <a href="${fetchUrl}" target="_blank">${fetchUrl}</a>`;
            } else if (containsXForwardedFor) {
                result = `${result}\n\nX-Forwarded-For Found in Body: <a href="${fetchUrl}" target="_blank">${fetchUrl}</a>`;
            } else if (containsXother) {
                result = `${result}\n\nX-Others Found in Body: <a href="${fetchUrl}" target="_blank">${fetchUrl}</a>`;
            }
            return `${result}`;

        }).catch(error => {
            return 'Error: ' + error.message;
        });
    }


    // 同じドメインのJavaScriptファイルを取得
    const scripts = Array.from(document.scripts).filter(script => script.src && new URL(script.src, location.href).hostname === activeTabDomain);

    // 同じドメインのCSSファイルを取得
    const stylesheets = Array.from(document.styleSheets).filter(sheet => {
        try {
            return sheet.href && new URL(sheet.href, location.href).hostname === activeTabDomain;
        } catch (e) {
            return false;
        }
    });

    // 同じドメインの画像ファイルを取得
    const images = Array.from(document.images).filter(img => img.src && new URL(img.src, location.href).hostname === activeTabDomain);

    // amazonaws.comのドメインを持つ画像のURLを抽出
    //const awsimages = Array.from(document.images).filter(img => 
    //    img.src && new URL(img.src, location.href).hostname.endsWith('amazonaws.com')
    //);

    // 結果のPromiseを生成
    const promises = [];
    promises.push(fetchResource(location.href));
    if (scripts.length > 0) {
        promises.push(fetchResource(scripts[0].src));
    }
    if (stylesheets.length > 0) {
        promises.push(fetchResource(stylesheets[0].href));
    }
    if (images.length > 0) {
        promises.push(fetchResource(images[0].src));
    }

    // Promise.allを使用して、すべての結果を待つ
    return Promise.all(promises).then(results => {
        return results.join('\n\n');
    }).catch(error => {
        return 'Error: ' + error.message;
    });
}

function checkForRegex(urls) {
    return Promise.all(urls.map(url => {
        return fetch(url).then(response => response.text()).then(scriptContent => {
            // Remove comments
            const scriptWithoutComments = scriptContent.replace(/\/\/.*|\/\*[^]*?\*\//g, '');
            const regexPattern = /(?<!\/\/)\/(?!\/)((?:\\\/|[^\/])+)\/[gimuy]*/g;
            //const suspiciousPattern = /\/(?=[^\/]*(?:\+\+|\*\*|[\+\*][\+\*]|[\+\*]\||\|\+|\|\*|[|][\+\*]))[^\/]*\/[gimuy]*/g;
            const suspiciousPattern = /\+\)\+|\+\)\*/g;
            //const suspiciousPattern2 = /\(.+\|.+\)[+*]/g;
            let regexUrls = [];
            let suspiciousUrls = [];

            const regexMatches = scriptWithoutComments.match(regexPattern);
            if (regexMatches) {
                if (regexMatches.some(match => suspiciousPattern.test(match))) {
                    suspiciousUrls.push(url);
                    //            } else if (regexMatches.some(match => suspiciousPattern2.test(match))) {
                    //                suspiciousUrls.push(url);
                } else {
                    regexUrls.push(url);
                }
            }

            return { regexUrls, suspiciousUrls };
        }).catch(() => null);
    })).then(results => {
        const regexUrls = results.flatMap(result => result ? result.regexUrls : []);
        const suspiciousUrls = results.flatMap(result => result ? result.suspiciousUrls : []);
        return { regexUrls, suspiciousUrls };
    });
}

function listResources(activeTabDomain) {
    const resources = document.querySelectorAll('link[rel="stylesheet"], script, img');
    const resourceUrls = Array.from(resources).map(res => res.href || res.src);

    return resourceUrls.reduce((acc, url) => {
        const domain = new URL(url, location.href).hostname;
        if (domain === activeTabDomain) {
            acc.sameDomain.push(url);
        } else {
            acc.differentDomain.push(url);
        }
        return acc;
    }, { sameDomain: [], differentDomain: [] });
}
/*
function formatResourceList(resourceData) {
    let formattedList = 'Same Domain URLs:\n';
    formattedList += resourceData.sameDomain.join('\n') + '\n\n';
    formattedList += 'Different Domain URLs:\n';
    formattedList += resourceData.differentDomain.join('\n');
    return formattedList;
}*/

function formatResourceList(resourceData) {
    // 同一ドメインのURLセクションを作成
    const sameDomainSection = ['Same Domain URLs:'].concat(resourceData.sameDomain);

    // 異なるドメインのURLセクションを作成
    const differentDomainSection = ['Different Domain URLs:'].concat(resourceData.differentDomain);

    // 両方のセクションを一つのリストに統合
    const formattedList = [sameDomainSection, '', differentDomainSection];
    // 空の要素を除外して新しいリストを作成
    const filteredList = formattedList.filter(item => item);
    return filteredList;
}

// 複数のURLに対してキーワード検索を行う関数
function searchForKeywords(urls, keywords) {
    return Promise.all(urls.map(url => {
        return fetch(url).then(response => response.text()).then(content => {
            const foundKeywords = [];
            // キーワードを検索
            keywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    foundKeywords.push(keyword);
                }
            });
            if (foundKeywords.length > 0) {
                return { url, foundKeywords };
            } else {
                return null;
            }
        }).catch(() => null);
    })).then(results => {
        // 結果からnullを除外
        return results.filter(result => result !== null);
    });
}