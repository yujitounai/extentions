const AVOID_DOMAINS = [
  'localhost',
  'gmail.com',
  'amazon.com',
  'amazon.co.jp',
  'youtube.com',
  'google.com',
  'yahoo.co.jp',
];

const SCAN_DEBOUNCE_MS = 300;
const MAX_IMAGES = 500;
const scanTimers = new Map();
const pendingScans = new Map();

function storageKey(tabId) {
  return `tabImages_${tabId}`;
}

function isScannableUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function shouldScanUrl(url) {
  if (!isScannableUrl(url)) return false;
  try {
    const hostname = new URL(url).hostname;
    return !AVOID_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function setBadge(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }, () => chrome.runtime.lastError);
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#14b8a6' }, () => chrome.runtime.lastError);
}

function storeTabImages(tabId, payload) {
  const imgs = Array.isArray(payload.imgs) ? payload.imgs.slice(0, MAX_IMAGES) : [];
  chrome.storage.local.set({
    [storageKey(tabId)]: {
      imgs,
      siteUrl: payload.siteUrl,
      updatedAt: Date.now(),
    },
  });
}

function applyScanResult(tabId, result) {
  if (!result) return;

  if (result.skipped) {
    setBadge(tabId, 'no');
    storeTabImages(tabId, { imgs: [], siteUrl: result.siteUrl || '' });
  } else {
    setBadge(tabId, String(result.imgs.length));
    storeTabImages(tabId, { imgs: result.imgs, siteUrl: result.siteUrl || '' });
  }
}

function resolvePendingScan(tabId) {
  const resolve = pendingScans.get(tabId);
  if (!resolve) return;
  pendingScans.delete(tabId);
  resolve();
}

function scanTab(tabId) {
  return chrome.tabs.get(tabId).then((tab) => {
    if (!shouldScanUrl(tab.url)) {
      setBadge(tabId, 'no');
      storeTabImages(tabId, { imgs: [], siteUrl: tab.url || '' });
      resolvePendingScan(tabId);
      return null;
    }

    return chrome.scripting.executeScript({
      target: { tabId },
      function: collectAndObserveImages,
      args: [AVOID_DOMAINS, tabId],
    }).then((results) => {
      const result = results?.[0]?.result;
      applyScanResult(tabId, result);
      resolvePendingScan(tabId);
      return result;
    }).catch(() => {
      setBadge(tabId, '!');
      storeTabImages(tabId, { imgs: [], siteUrl: tab.url || '' });
      resolvePendingScan(tabId);
      return null;
    });
  }).catch(() => {
    resolvePendingScan(tabId);
    return null;
  });
}

function scanTabAndWait(tabId, timeoutMs = 5000) {
  return new Promise((resolve) => {
    pendingScans.set(tabId, resolve);
    const timer = setTimeout(() => resolvePendingScan(tabId), timeoutMs);
    scanTab(tabId).finally(() => clearTimeout(timer));
  });
}

function scheduleScan(tabId) {
  clearTimeout(scanTimers.get(tabId));
  scanTimers.set(
    tabId,
    setTimeout(() => {
      scanTimers.delete(tabId);
      scanTab(tabId);
    }, SCAN_DEBOUNCE_MS),
  );
}

function collectAndObserveImages(avoidDomains, tabId) {
  function shouldSkipDomain() {
    return avoidDomains.some((domain) => document.domain === domain || document.domain.endsWith(`.${domain}`));
  }

  function addUrl(urlSet, rawUrl) {
    if (!rawUrl) return;
    try {
      const absolute = new URL(rawUrl, location.href).href;
      if (absolute.startsWith('http://') || absolute.startsWith('https://')) {
        urlSet.add(absolute);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  function addSrcset(urlSet, srcset) {
    if (!srcset) return;
    srcset.split(',').forEach((part) => {
      const candidate = part.trim().split(/\s+/)[0];
      addUrl(urlSet, candidate);
    });
  }

  function collectImageUrls() {
    const urlSet = new Set();

    document.querySelectorAll('img').forEach((img) => {
      addUrl(urlSet, img.currentSrc || img.src);
      addSrcset(urlSet, img.srcset);
      ['data-src', 'data-original', 'data-lazy-src', 'data-url'].forEach((attr) => {
        addUrl(urlSet, img.getAttribute(attr));
      });
      addSrcset(urlSet, img.getAttribute('data-srcset'));
    });

    document.querySelectorAll('picture source').forEach((source) => {
      addUrl(urlSet, source.src);
      addSrcset(urlSet, source.srcset);
    });

    document.querySelectorAll('video[poster]').forEach((video) => {
      addUrl(urlSet, video.poster);
    });

    document.querySelectorAll('link[rel="preload"][as="image"]').forEach((link) => {
      addUrl(urlSet, link.href);
    });

    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]').forEach((meta) => {
      addUrl(urlSet, meta.content);
    });

    return Array.from(urlSet);
  }

  function buildResult() {
    if (shouldSkipDomain()) {
      return { skipped: true, imgs: [], siteUrl: location.href };
    }
    return { skipped: false, imgs: collectImageUrls(), siteUrl: location.href };
  }

  function notifyBackground(result) {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage({
        type: 'SCAN_RESULTS',
        tabId,
        imgs: result.imgs,
        siteUrl: result.siteUrl,
        skipped: result.skipped,
      }, () => void chrome.runtime.lastError);
    } catch {
      // Extension context invalidated 等
    }
  }

  const initialResult = buildResult();

  if (!window.__imageHunterObserver) {
    window.__imageHunterObserver = true;

    let debounceTimer;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => notifyBackground(buildResult()), 500);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'data-lazy-src', 'poster'],
    });
  }

  return initialResult;
}

function getTabImagesData(tabId, fallbackUrl = '') {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [storageKey(tabId)]: null }, (data) => {
      resolve(data[storageKey(tabId)] || { imgs: [], siteUrl: fallbackUrl });
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active) return;
  scheduleScan(tabId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  scheduleScan(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs[0]?.id) scheduleScan(tabs[0].id);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTimeout(scanTimers.get(tabId));
  scanTimers.delete(tabId);
  chrome.storage.local.remove(storageKey(tabId));
  chrome.action.setBadgeText({ tabId, text: '' }, () => chrome.runtime.lastError);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = message.tabId ?? sender.tab?.id;

  if (message.type === 'SCAN_RESULTS' && tabId != null) {
    applyScanResult(tabId, {
      skipped: message.skipped,
      imgs: message.imgs,
      siteUrl: message.siteUrl,
    });
    resolvePendingScan(tabId);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'RESCAN') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ ok: false });
        return;
      }

      scanTabAndWait(tab.id).then(() => {
        getTabImagesData(tab.id, tab.url || '').then((data) => {
          sendResponse({ ok: true, data });
        });
      });
    });
    return true;
  }

  if (message.type === 'GET_TAB_IMAGES') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ imgs: [], siteUrl: '' });
        return;
      }

      getTabImagesData(tab.id, tab.url || '').then(sendResponse);
    });
    return true;
  }

  if (message.type === 'GET_OR_SCAN') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ imgs: [], siteUrl: '' });
        return;
      }

      getTabImagesData(tab.id, tab.url || '').then((data) => {
        if (data.imgs.length > 0 || !shouldScanUrl(tab.url)) {
          sendResponse(data);
          return;
        }
        scanTabAndWait(tab.id).then(() => {
          getTabImagesData(tab.id, tab.url || '').then(sendResponse);
        });
      });
    });
    return true;
  }
});
