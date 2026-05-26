const STORAGE_SCAN = 'hiddenScannerProgress';
const STORAGE_HISTORY = 'scanHistory';

const PROFILES = {
  quick: {
    extensions: ['', '.html', '.php'],
    backups: ['', '.bak'],
    pathScope: 'root',
    method: 'head-then-get',
    throttleMs: 300,
  },
  standard: {
    extensions: ['', '.html', '.htm', '.php', '.asp', '.aspx', '.jsp', '.txt', '.xml', '.conf', '.ini'],
    backups: ['', '~', '.bak', '.gz', '.temp', '.tgz'],
    pathScope: 'both',
    method: 'head-then-get',
    throttleMs: 400,
  },
  full: {
    useAllExtensions: true,
    useAllBackups: true,
    pathScope: 'both',
    method: 'head-then-get',
    throttleMs: 500,
  },
};

let wordlists = null;
let scanAbort = false;
let scanRunning = false;
let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
  }, 20000);
}

function stopKeepAlive() {
  if (!keepAliveTimer) return;
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

async function loadWordlists() {
  if (wordlists) return wordlists;
  const [fileList, extensionList, backupSuffixList, defaultExtensions] = await Promise.all([
    fetch(chrome.runtime.getURL('fileList.json')).then((r) => r.json()),
    fetch(chrome.runtime.getURL('extensionList.json')).then((r) => r.json()),
    fetch(chrome.runtime.getURL('backupSuffixList.json')).then((r) => r.json()),
    fetch(chrome.runtime.getURL('defaultExtensions.json')).then((r) => r.json()),
  ]);
  wordlists = { fileList, extensionList, backupSuffixList, defaultExtensions };
  return wordlists;
}

function getDirectoryPaths(pathname) {
  const paths = [''];
  let dir = pathname.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
  if (dir.match(/^[^/]*\.[^/\.]*$/)) dir = '';
  if (dir && dir !== '/') paths.push(dir);
  return [...new Set(paths)];
}

function resolveProfile(profileName, lists) {
  const base = PROFILES[profileName] || PROFILES.standard;
  const extensions = base.useAllExtensions ? lists.extensionList : base.extensions;
  const backups = base.useAllBackups ? lists.backupSuffixList : base.backups;
  return {
    ...base,
    extensions,
    backups,
  };
}

function buildTargets(origin, pathname, profile, lists) {
  const config = resolveProfile(profile, lists);
  let bases = [''];
  if (config.pathScope === 'both') bases = getDirectoryPaths(pathname);
  else if (config.pathScope === 'current') bases = getDirectoryPaths(pathname).filter((p) => p !== '');

  const targets = [];
  const seen = new Set();
  for (const base of bases) {
    for (const filePath of lists.fileList) {
      for (const ext of config.extensions) {
        for (const backup of config.backups) {
          const url = `${origin}${base}${filePath}${ext}${backup}`;
          if (!seen.has(url)) {
            seen.add(url);
            targets.push(url);
          }
        }
      }
    }
  }
  return { targets, config };
}

function appendLog(state, message, always = false) {
  if (always || state.detailedLog) {
    state.log += `${message}\n`;
  }
}

async function getScanState() {
  const data = await chrome.storage.local.get(STORAGE_SCAN);
  return data[STORAGE_SCAN] || null;
}

async function saveScanState(state) {
  await chrome.storage.local.set({ [STORAGE_SCAN]: state });
}

async function saveHistory(origin, entry) {
  const data = await chrome.storage.local.get(STORAGE_HISTORY);
  const history = data[STORAGE_HISTORY] || {};
  history[origin] = entry;
  await chrome.storage.local.set({ [STORAGE_HISTORY]: history });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeUrl(url, method) {
  return fetch(url, { method, redirect: 'manual' });
}

async function checkUrl(url, methodMode) {
  if (methodMode === 'head-then-get') {
    try {
      const headRes = await probeUrl(url, 'HEAD');
      if (headRes.status === 200) return { status: 200, method: 'HEAD' };
      if (headRes.status === 405 || headRes.status === 501) {
        const getRes = await probeUrl(url, 'GET');
        return { status: getRes.status, method: 'GET' };
      }
      return { status: headRes.status, method: 'HEAD' };
    } catch {
      const getRes = await probeUrl(url, 'GET');
      return { status: getRes.status, method: 'GET' };
    }
  }

  const method = methodMode.toUpperCase();
  const res = await probeUrl(url, method);
  return { status: res.status, method };
}

async function runScanLoop() {
  if (scanRunning) return;
  scanRunning = true;
  scanAbort = false;
  startKeepAlive();

  try {
    while (!scanAbort) {
      const state = await getScanState();
      if (!state || !state.isRunning) break;

      if (state.currentIndex >= state.total) {
        state.isRunning = false;
        state.finishedAt = new Date().toISOString();
        appendLog(state, 'Scan complete.', true);
        await saveScanState(state);
        await saveHistory(state.origin, {
          lastScan: state.finishedAt,
          results: state.results,
          log: state.log,
          profile: state.profile,
          total: state.total,
        });
        await chrome.storage.local.remove(STORAGE_SCAN);
        break;
      }

      const target = state.targets[state.currentIndex];
      try {
        const result = await checkUrl(target, state.method);
        if (result.status === 200) {
          state.results.push(target);
          appendLog(state, `200 OK (${result.method}): ${target}`, true);
        } else {
          appendLog(state, `${result.status} (${result.method}): ${target}`);
        }
      } catch (err) {
        appendLog(state, `Error: ${target} - ${err.message}`);
      }

      state.currentIndex += 1;
      state.progress = state.total ? Math.floor((state.currentIndex / state.total) * 100) : 0;
      await saveScanState(state);
      await delay(state.throttleMs);
    }
  } finally {
    scanRunning = false;
    stopKeepAlive();
  }
}

async function startScan({ profile, origin, pathname, detailedLog, resume = false }) {
  const lists = await loadWordlists();
  let state = resume ? await getScanState() : null;

  if (resume && state && state.origin === origin && state.currentIndex < state.total) {
    state.isRunning = true;
    state.detailedLog = detailedLog;
    await saveScanState(state);
    runScanLoop();
    return state;
  }

  const { targets, config } = buildTargets(origin, pathname, profile, lists);
  state = {
    origin,
    pathname,
    profile,
    detailedLog,
    targets,
    results: [],
    log: 'Starting scan...\n',
    currentIndex: 0,
    total: targets.length,
    progress: 0,
    isRunning: true,
    method: config.method,
    throttleMs: config.throttleMs,
    startedAt: new Date().toISOString(),
  };

  appendLog(state, `Profile: ${profile}`, true);
  appendLog(state, `Targets: ${targets.length}`, true);
  await saveScanState(state);
  runScanLoop();
  return state;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'START_SCAN') {
      const state = await startScan(message);
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === 'STOP_SCAN') {
      scanAbort = true;
      const state = await getScanState();
      if (state) {
        state.isRunning = false;
        appendLog(state, 'Scan stopped.', true);
        await saveScanState(state);
      }
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === 'RESUME_SCAN') {
      const state = await startScan({ ...message, resume: true });
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === 'GET_SCAN_STATE') {
      sendResponse({ ok: true, state: await getScanState() });
      return;
    }

    if (message.type === 'GET_HISTORY') {
      const data = await chrome.storage.local.get(STORAGE_HISTORY);
      sendResponse({ ok: true, history: data[STORAGE_HISTORY]?.[message.origin] || null });
      return;
    }

    if (message.type === 'CLEAR_HISTORY') {
      const data = await chrome.storage.local.get(STORAGE_HISTORY);
      const history = data[STORAGE_HISTORY] || {};
      delete history[message.origin];
      await chrome.storage.local.set({ [STORAGE_HISTORY]: history });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'PREVIEW_TARGET_COUNT') {
      const lists = await loadWordlists();
      const { targets } = buildTargets(message.origin, message.pathname, message.profile, lists);
      sendResponse({ ok: true, count: targets.length });
      return;
    }

    sendResponse({ ok: false });
  })();
  return true;
});

(async () => {
  const state = await getScanState();
  if (state?.isRunning && state.currentIndex < state.total) {
    runScanLoop();
  }
})();
