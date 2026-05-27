importScripts('patterns.js');

const STORAGE_PREFIX = 'secretScannerTab:';
const ICON_DEFAULT = {
  16: 'images/icon16.png',
  48: 'images/icon48.png',
  128: 'images/icon128.png',
};
const ICON_ALERT = {
  16: 'images/icon16_alert.png',
  48: 'images/icon48_alert.png',
  128: 'images/icon128_alert.png',
};

const tabData = {};

function storageKey(tabId) {
  return `${STORAGE_PREFIX}${tabId}`;
}

function emptyTabState() {
  return {
    url: '',
    skipped: false,
    results: [],
    iframes: [],
    scripts: [],
  };
}

function getTabState(tabId) {
  if (!tabData[tabId]) tabData[tabId] = emptyTabState();
  return tabData[tabId];
}

function getSessionStorage() {
  return chrome.storage?.session || null;
}

async function saveTabState(tabId) {
  const state = tabData[tabId];
  const storage = getSessionStorage();
  if (!state || !storage) return;
  try {
    await storage.set({ [storageKey(tabId)]: state });
  } catch (err) {
    console.warn('[Secret Scanner] saveTabState failed:', err);
  }
}

async function loadTabState(tabId) {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    const data = await storage.get(storageKey(tabId));
    const saved = data[storageKey(tabId)];
    if (saved) {
      tabData[tabId] = { ...emptyTabState(), ...saved };
    }
  } catch (err) {
    console.warn('[Secret Scanner] loadTabState failed:', err);
  }
}

async function ensureTabState(tabId) {
  if (!tabData[tabId]) {
    await loadTabState(tabId);
  }
  return getTabState(tabId);
}

function clearTabState(tabId) {
  delete tabData[tabId];
  const storage = getSessionStorage();
  if (!storage) return;
  storage.remove(storageKey(tabId)).catch(() => {});
}

function updateBadgeAndIcon(tabId) {
  const state = tabData[tabId];
  if (!state) {
    chrome.action.setBadgeText({ tabId, text: '' }, () => void chrome.runtime.lastError);
    chrome.action.setIcon({ tabId, path: ICON_DEFAULT }, () => void chrome.runtime.lastError);
    return;
  }

  if (state.skipped) {
    chrome.action.setBadgeText({ tabId, text: 'no' }, () => void chrome.runtime.lastError);
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748b' }, () => void chrome.runtime.lastError);
    chrome.action.setIcon({ tabId, path: ICON_DEFAULT }, () => void chrome.runtime.lastError);
    return;
  }

  const count = (state.results || []).length;
  chrome.action.setBadgeText({ tabId, text: count ? String(count) : '' }, () => void chrome.runtime.lastError);
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' }, () => void chrome.runtime.lastError);
  chrome.action.setIcon({ tabId, path: count ? ICON_ALERT : ICON_DEFAULT }, () => void chrome.runtime.lastError);
}

function buildTabPayload(state) {
  return {
    url: state.url,
    skipped: state.skipped,
    results: state.results || [],
    iframes: state.iframes || [],
    scripts: state.scripts || [],
    scanning: false,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  (async () => {
    if (message.type === 'SCAN_SKIPPED' && tabId !== undefined) {
      tabData[tabId] = { ...emptyTabState(), skipped: true, url: message.url || '' };
      await saveTabState(tabId);
      updateBadgeAndIcon(tabId);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'DOM_SCAN_RESULTS' && tabId !== undefined) {
      const state = getTabState(tabId);
      state.url = message.url || state.url;
      state.skipped = false;
      state.results = dedupeResults(message.results || []);
      state.iframes = message.iframes || [];
      state.scripts = message.scripts || [];

      await saveTabState(tabId);
      updateBadgeAndIcon(tabId);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'GET_TAB_DATA') {
      const state = await ensureTabState(message.tabId);
      sendResponse({ ok: true, data: buildTabPayload(state) });
      return;
    }

    if (message.type === 'RESCAN_TAB' && message.tabId !== undefined) {
      chrome.tabs.sendMessage(message.tabId, { type: 'FORCE_RESCAN' }, () => void chrome.runtime.lastError);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })();

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  if (!changeInfo.url?.startsWith('http')) return;

  clearTabState(tabId);
  chrome.action.setBadgeText({ tabId, text: '' }, () => void chrome.runtime.lastError);
  chrome.action.setIcon({ tabId, path: ICON_DEFAULT }, () => void chrome.runtime.lastError);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});
