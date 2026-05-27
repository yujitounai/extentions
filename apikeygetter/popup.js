function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false });
    });
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LOCATION_LABELS = {
  html_source: 'ページHTML',
  text: 'ページ内テキスト',
  inline_script: 'インラインスクリプト',
  external_script: '外部スクリプト',
};

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
      tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
    });
  });
}

function renderResultItem(result) {
  const matchPos = result.text.indexOf(result.match);
  let textHtml;
  if (matchPos >= 0) {
    const before = escapeHtml(result.text.slice(0, matchPos));
    const match = escapeHtml(result.match);
    const after = escapeHtml(result.text.slice(matchPos + result.match.length));
    textHtml = `${before}<span class="highlight">${match}</span>${after}`;
  } else {
    textHtml = escapeHtml(result.text);
  }

  return `
    <div class="result-item">
      <div class="result-title">${escapeHtml(result.patternName)}</div>
      <div class="result-meta">${escapeHtml(LOCATION_LABELS[result.type] || result.type)} · ${escapeHtml(result.context || '')}</div>
      <div class="result-text">${textHtml}</div>
    </div>
  `;
}

function renderResults(results) {
  const container = document.getElementById('results');
  if (!results?.length) {
    container.className = 'results-list empty';
    container.textContent = '検出結果はありません';
    return;
  }
  container.className = 'results-list';
  container.innerHTML = results.map(renderResultItem).join('');
}

function renderAssetList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!items?.length) {
    container.className = 'asset-list empty';
    container.textContent = 'なし';
    return;
  }
  container.className = 'asset-list';
  container.innerHTML = items.map((url) => {
    const safe = escapeHtml(url);
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
  }).join('');
}

function renderState(data) {
  const statusBadge = document.getElementById('statusBadge');
  const resultCount = document.getElementById('resultCount');

  if (data.skipped) {
    statusBadge.textContent = 'Skipped';
    statusBadge.className = 'badge muted';
    resultCount.textContent = 'このドメインはスキャン対象外です';
    document.getElementById('results').className = 'results-list skipped';
    document.getElementById('results').textContent = '除外ドメインのためスキャンしていません';
    renderAssetList('iframes', []);
    renderAssetList('scripts', []);
    return;
  }

  const count = data.results?.length || 0;
  statusBadge.textContent = data.scanning ? 'Scanning' : count ? `${count} found` : 'Clean';
  statusBadge.className = data.scanning ? 'badge' : count ? 'badge alert' : 'badge';
  resultCount.textContent = data.scanning
    ? '外部 script をスキャン中...'
    : `${count} 件の候補を検出`;

  renderResults(data.results);
  renderAssetList('iframes', data.iframes);
  renderAssetList('scripts', data.scripts);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function loadTabData(tabId) {
  return sendMessage({ type: 'GET_TAB_DATA', tabId });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();

  const originLabel = document.getElementById('originLabel');
  const rescanBtn = document.getElementById('rescanBtn');
  let pollTimer = null;
  let pollAttempts = 0;
  const MAX_POLL_ATTEMPTS = 20;

  const tab = await getActiveTab();
  if (!tab?.url?.startsWith('http')) {
    originLabel.textContent = 'HTTP(S) ページで開いてください';
    rescanBtn.disabled = true;
    document.getElementById('results').className = 'results-list empty';
    document.getElementById('results').textContent = 'このページではスキャンできません';
    return;
  }

  originLabel.textContent = tab.url;

  async function refresh() {
    const res = await loadTabData(tab.id);
    if (!res.ok || !res.data) {
      document.getElementById('results').className = 'results-list empty';
      document.getElementById('results').textContent = '結果を取得できませんでした';
      return null;
    }
    renderState(res.data);
    return res.data;
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    pollAttempts = 0;
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      pollAttempts += 1;
      const data = await refresh();
      const hasResults = (data?.results?.length || 0) > 0;
      const done = data?.skipped || hasResults || !data?.scanning;
      if (done || pollAttempts >= MAX_POLL_ATTEMPTS) {
        stopPolling();
      }
    }, 500);
  }

  rescanBtn.addEventListener('click', async () => {
    rescanBtn.disabled = true;
    stopPolling();
    await sendMessage({ type: 'RESCAN_TAB', tabId: tab.id });
    startPolling();
    setTimeout(() => {
      rescanBtn.disabled = false;
    }, 500);
  });

  // popup 表示時は非同期スキャン完了までポーリング
  await sendMessage({ type: 'RESCAN_TAB', tabId: tab.id });
  startPolling();
});
