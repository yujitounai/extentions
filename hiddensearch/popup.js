document.addEventListener('DOMContentLoaded', () => {
    const resultsDiv = document.getElementById('results');

    // バックグラウンドスクリプトから検索結果を取得
    chrome.runtime.sendMessage({ type: 'GET_RESULTS' }, (response) => {
        if (response && response.results && response.results.length > 0) {
            response.results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                // マッチした部分をハイライト
                let highlightedText = result.text;
                highlightedText = highlightedText.replace(
                    new RegExp(result.match, 'g'),
                    match => `<span class="highlight">${match}</span>`
                );

                // パターンの種類に応じた説明を追加
                let patternDescription = '';
                switch(result.pattern) {
                    case 0:
                        patternDescription = 'AWS アクセスキー';
                        break;
                    case 1:
                        patternDescription = 'alert検出';
                        break;
                }

                // 検出場所の説明を追加
                let locationDescription = '';
                switch(result.type) {
                    case 'text':
                        locationDescription = 'ページ内テキスト';
                        break;
                    case 'inline_script':
                        locationDescription = 'インラインスクリプト';
                        break;
                    case 'external_script':
                        locationDescription = '外部スクリプト';
                        break;
                }

                resultItem.innerHTML = `
                    <div><strong>${patternDescription}</strong> (${locationDescription})</div>
                    <div>${highlightedText}</div>
                    <small>${result.context}</small>
                `;
                resultsDiv.appendChild(resultItem);
            });
        } else {
            resultsDiv.innerHTML = '<div class="no-results">検索結果はありません</div>';
        }
    });
}); 