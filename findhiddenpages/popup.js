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

function renderResults(results) {
  const container = document.getElementById('results');
  if (!results?.length) {
    container.className = 'empty';
    container.textContent = 'No results yet.';
    return;
  }

  container.className = '';
  container.innerHTML = results.map((url) => {
    const safeHref = escapeHtml(url);
    const safeText = escapeHtml(url);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  }).join('');
}

function renderState(state) {
  const progressDiv = document.getElementById('progress');
  const logBox = document.getElementById('logBox');
  const statusBadge = document.getElementById('statusBadge');

  if (!state) {
    progressDiv.textContent = 'Progress: 0% (0/0)';
    statusBadge.textContent = 'Idle';
    statusBadge.className = 'badge';
    return;
  }

  progressDiv.textContent = `Progress: ${state.progress || 0}% (${state.currentIndex}/${state.total})`;
  logBox.value = state.log || '';
  renderResults(state.results || []);
  statusBadge.textContent = state.isRunning ? 'Running' : 'Idle';
  statusBadge.className = state.isRunning ? 'badge running' : 'badge';
}

function renderHistory(entry) {
  const historyInfo = document.getElementById('historyInfo');
  if (!entry) {
    historyInfo.className = 'empty';
    historyInfo.textContent = 'No previous scan history for this domain.';
    return;
  }

  const dateStr = new Date(entry.lastScan).toLocaleString();
  historyInfo.className = '';
  historyInfo.textContent = `Last scan: ${dateStr}\nProfile: ${entry.profile || 'unknown'}\nFound: ${entry.results?.length || 0} / ${entry.total || '?'}`;
}

async function getActiveTabContext() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.url?.startsWith('http')) {
    return null;
  }
  const url = new URL(tab.url);
  return {
    tab,
    origin: url.origin,
    pathname: url.pathname,
  };
}

async function refreshTargetCount(ctx) {
  const profile = document.getElementById('profileSelect').value;
  const targetCount = document.getElementById('targetCount');
  const res = await sendMessage({
    type: 'PREVIEW_TARGET_COUNT',
    origin: ctx.origin,
    pathname: ctx.pathname,
    profile,
  });
  if (!res.ok) {
    targetCount.textContent = '';
    return;
  }
  const warning = res.count >= 50000 ? ' — Full scan may take hours' : '';
  targetCount.textContent = `Targets: ${res.count.toLocaleString()}${warning}`;
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      tabButtons.forEach((btn) => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const detailedMode = document.getElementById('detailedMode');
  const profileSelect = document.getElementById('profileSelect');
  const originLabel = document.getElementById('originLabel');
  const logBox = document.getElementById('logBox');

  const ctx = await getActiveTabContext();
  if (!ctx) {
    originLabel.textContent = 'HTTP(S) ページで開いてください';
    startBtn.disabled = true;
    resumeBtn.disabled = true;
    return;
  }

  originLabel.textContent = ctx.origin;
  await refreshTargetCount(ctx);

  const historyRes = await sendMessage({ type: 'GET_HISTORY', origin: ctx.origin });
  renderHistory(historyRes.history);

  const stateRes = await sendMessage({ type: 'GET_SCAN_STATE' });
  if (stateRes.state?.origin === ctx.origin) {
    renderState(stateRes.state);
    if (stateRes.state.profile) profileSelect.value = stateRes.state.profile;
  }

  profileSelect.addEventListener('change', () => refreshTargetCount(ctx));

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    const res = await sendMessage({
      type: 'START_SCAN',
      profile: profileSelect.value,
      origin: ctx.origin,
      pathname: ctx.pathname,
      detailedLog: detailedMode.checked,
      resume: false,
    });
    renderState(res.state);
    startBtn.disabled = false;
  });

  resumeBtn.addEventListener('click', async () => {
    const res = await sendMessage({
      type: 'RESUME_SCAN',
      profile: profileSelect.value,
      origin: ctx.origin,
      pathname: ctx.pathname,
      detailedLog: detailedMode.checked,
      resume: true,
    });
    renderState(res.state);
  });

  stopBtn.addEventListener('click', async () => {
    const res = await sendMessage({ type: 'STOP_SCAN' });
    renderState(res.state);
  });

  clearLogBtn.addEventListener('click', () => {
    logBox.value = '';
  });

  clearHistoryBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'CLEAR_HISTORY', origin: ctx.origin });
    renderHistory(null);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.hiddenScannerProgress) return;
    const state = changes.hiddenScannerProgress.newValue;
    if (state?.origin === ctx.origin) {
      renderState(state);
    }
    if (state === undefined) {
      sendMessage({ type: 'GET_HISTORY', origin: ctx.origin }).then((res) => {
        renderHistory(res.history);
      });
    }
  });
});
