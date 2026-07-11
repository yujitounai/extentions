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

function renderSquattedCdns(hits) {
  const panel = document.getElementById('squattedCdnPanel');
  const list = document.getElementById('squattedCdnList');

  if (!hits?.length) {
    panel.hidden = true;
    list.innerHTML = '';
    return;
  }

  panel.hidden = false;
  list.innerHTML = hits
    .map((hit) => {
      const isLink = hit.url.startsWith('http');
      const urlHtml = isLink
        ? `<a href="${escapeHtml(hit.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hit.url)}</a>`
        : escapeHtml(hit.url);
      return `<div class="cdn-hit">
        ${urlHtml}
        <div class="meta">ドメイン: ${escapeHtml(hit.matchedDomain)} · ${escapeHtml(hit.source)}</div>
      </div>`;
    })
    .join('');
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

function statusPillClass(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  return 'ok';
}

function kindLabel(kind) {
  if (kind === 'sourcemap') return 'source map';
  return '共通パス';
}

function renderProbeResults(items, { emptyMessage = 'まだ探索していません' } = {}) {
  const container = document.getElementById('probeResults');
  if (!items?.length) {
    container.className = 'results-list empty';
    container.textContent = emptyMessage;
    return;
  }
  container.className = 'results-list';
  container.innerHTML = items
    .map((item) => {
      const safeUrl = escapeHtml(item.url);
      const pill = statusPillClass(item.status);
      return `<div class="probe-item">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>
        <div class="meta">
          <span class="status-pill ${pill}">${escapeHtml(String(item.status))}</span>
          ${escapeHtml(kindLabel(item.kind))}
          ${item.label ? ` · ${escapeHtml(item.label)}` : ''}
        </div>
      </div>`;
    })
    .join('');
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
    renderSquattedCdns([]);
    renderAssetList('iframes', []);
    renderAssetList('scripts', []);
    renderProbeResults([], { emptyMessage: '除外ドメインのため探索対象外です' });
    return;
  }

  const count = data.results?.length || 0;
  const cdnCount = data.squattedCdns?.length || 0;
  const alert = count > 0 || cdnCount > 0;

  if (data.scanning) {
    statusBadge.textContent = 'Scanning';
    statusBadge.className = 'badge';
  } else if (cdnCount > 0) {
    statusBadge.textContent = `CDN ${cdnCount}`;
    statusBadge.className = 'badge alert';
  } else if (count > 0) {
    statusBadge.textContent = `${count} found`;
    statusBadge.className = 'badge alert';
  } else {
    statusBadge.textContent = 'Clean';
    statusBadge.className = 'badge';
  }

  const countParts = [];
  if (cdnCount) countParts.push(`危険 CDN ${cdnCount} 件`);
  if (count) countParts.push(`秘密情報候補 ${count} 件`);
  resultCount.textContent = data.scanning
    ? 'スキャン中...'
    : countParts.length
      ? countParts.join(' · ')
      : '検出なし';

  renderSquattedCdns(data.squattedCdns);
  renderResults(data.results);
  renderAssetList('iframes', data.iframes);
  renderAssetList('scripts', data.scripts);
  if (data.probeResults?.length) {
    renderProbeResults(data.probeResults);
    const probeStatus = document.getElementById('probeStatus');
    if (probeStatus && !probeStatus.dataset.busy) {
      probeStatus.textContent = `${data.probeResults.length} 件ヒット`;
    }
  }
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
  const probeBtn = document.getElementById('probeBtn');
  const probeStatus = document.getElementById('probeStatus');
  let pollTimer = null;
  let pollAttempts = 0;
  const MAX_POLL_ATTEMPTS = 20;
  let latestData = null;

  const tab = await getActiveTab();
  if (!tab?.url?.startsWith('http')) {
    originLabel.textContent = 'HTTP(S) ページで開いてください';
    rescanBtn.disabled = true;
    probeBtn.disabled = true;
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
    latestData = res.data;
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
      const hasResults = (data?.results?.length || 0) > 0 || (data?.squattedCdns?.length || 0) > 0;
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

  probeBtn.addEventListener('click', async () => {
    probeBtn.disabled = true;
    probeStatus.dataset.busy = '1';
    probeStatus.textContent = '探索中...';
    renderProbeResults([], { emptyMessage: '探索中...' });

    const res = await sendMessage({
      type: 'PROBE_FILES',
      tabId: tab.id,
      url: tab.url,
      scripts: latestData?.scripts || [],
    });

    delete probeStatus.dataset.busy;
    probeBtn.disabled = false;

    if (!res.ok) {
      probeStatus.textContent = '失敗';
      renderProbeResults([], { emptyMessage: res.error || '探索に失敗しました' });
      return;
    }

    const found = res.found || [];
    probeStatus.textContent = found.length
      ? `${found.length} / ${res.total} 件ヒット`
      : `ヒットなし（${res.total} 件確認）`;
    renderProbeResults(found, {
      emptyMessage: `ヒットなし（${res.total} 件確認）`,
    });
  });

  // popup 表示時は非同期スキャン完了までポーリング
  await sendMessage({ type: 'RESCAN_TAB', tabId: tab.id });
  startPolling();
});
