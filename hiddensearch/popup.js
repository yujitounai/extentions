document.addEventListener('DOMContentLoaded', () => {
    const resultsDiv = document.getElementById('results');
    let isExtensionValid = true;
    let isProcessing = false;

    // エラーメッセージ表示関数
    function showError(message, showReload = true) {
        resultsDiv.innerHTML = `
            <div class="error-message">
                ${message}
                ${showReload ? `
                    <button id="reload-button" class="reload-button">
                        拡張機能を再読み込み
                    </button>
                ` : ''}
            </div>
        `;

        document.getElementById('reload-button')?.addEventListener('click', () => {
            chrome.runtime.reload();
            window.close();
        });
    }

    // 重複排除と表示順安定化
    function processResults(results) {
        const seen = new Set();
        return results
            .filter(result => {
                const key = `${result.match}|${result.context?.substring(0, 50)}`;
                return !seen.has(key) && seen.add(key);
            })
            .sort((a, b) => b.type.localeCompare(a.type)); // 外部スクリプトを優先
    }

    // 安全にメッセージを送信
    async function sendMessageSafely(message) {
        if (!isExtensionValid) return null;
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            if (shouldSuppressError(error)) isExtensionValid = false;
            console.warn('通信エラー:', error);
            return null;
        }
    }

// popup.js のdisplayResults関数のみ更新

function displayResults(results) {
    resultsDiv.innerHTML = '';

    if (!results?.length) {
        resultsDiv.innerHTML = '<div class="no-results">検出結果はありません</div>';
        return;
    }

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        // ヘッダー
        item.innerHTML = `
            <div>
                <strong>${getPatternDescription(result.pattern)}</strong>
                <span>(${getLocationDescription(result.type)})</span>
            </div>
        `;

        // マッチ部分を確実に表示
        const textDiv = document.createElement('div');
        const matchPos = result.text.indexOf(result.match);
        if (matchPos >= 0) {
            const before = result.text.substring(0, matchPos);
            const after = result.text.substring(matchPos + result.match.length);
            textDiv.innerHTML = `
                <span class="context">${escapeHtml(before)}</span>
                <span class="highlight">${escapeHtml(result.match)}</span>
                <span class="context">${escapeHtml(after)}</span>
            `;
        } else {
            textDiv.textContent = result.text;
        }
        item.appendChild(textDiv);

        // コンテキスト
        if (result.context) {
            const ctx = document.createElement('div');
            ctx.className = 'context-info';
            ctx.textContent = result.context;
            item.appendChild(ctx);
        }

        resultsDiv.appendChild(item);
    });
}

    // HTMLエスケープ用
    function escapeHtml(str) {
        return str?.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        }[m])) || '';
    }

    // メイン処理
    async function main() {
        if (!chrome.runtime?.id) return showError('拡張機能が無効化されています');

        try {
            isProcessing = true;
            resultsDiv.innerHTML = '<div class="loading">検索中...</div>';

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return showError('タブが見つかりません', false);

            const response = await sendMessageSafely({ 
                type: 'GET_RESULTS', 
                tabId: tab.id 
            });
            displayResults(response?.results);

        } catch (error) {
            showError(shouldSuppressError(error) 
                ? '拡張機能を再読み込みしてください' 
                : `エラー: ${error.message}`
            );
        } finally {
            isProcessing = false;
        }
    }

    // 初期実行
    main();
});

/* ヘルパー関数（変更なし） */
function shouldSuppressError(error) {
    return error?.message?.includes('Extension context invalidated');
}
    // パターン種類の説明を返す
    function getPatternDescription(index) {
        const patterns = {
            0: 'AWS アクセスキー',
            1: 'Google API キー',
            // 追加パターンがあればここに記述
        };
        return patterns[index] || '不明なパターン';
    }

    // 検出場所の説明を返す
    function getLocationDescription(type) {
        const locations = {
            'text': 'ページ内テキスト',
            'inline_script': 'インラインスクリプト',
            'external_script': '外部スクリプト'
        };
        return locations[type] || '不明な場所';
    }
