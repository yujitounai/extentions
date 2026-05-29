const BADGE_COLORS = {
  cache: '#22c55e',
  no: '#64748b',
  err: '#ef4444',
};

async function scanCacheHeaders() {
  try {
    const domain = location.hostname;
    const urls = new Set([location.href]);

    for (const script of document.scripts) {
      if (!script.src) continue;
      try {
        if (new URL(script.src, location.href).hostname === domain) urls.add(script.src);
      } catch {
        /* skip invalid */
      }
    }

    for (const sheet of document.styleSheets) {
      if (!sheet.href) continue;
      try {
        if (new URL(sheet.href, location.href).hostname === domain) urls.add(sheet.href);
      } catch {
        /* skip */
      }
    }

    for (const img of document.images) {
      if (!img.src) continue;
      try {
        if (new URL(img.src, location.href).hostname === domain) urls.add(img.src);
      } catch {
        /* skip */
      }
    }

    const candidates = [...urls].slice(0, 5);
    if (!candidates.length) return 'no';

    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'reload', credentials: 'same-origin' });
        const cacheControl = (res.headers.get('cache-control') || '').toLowerCase();
        if (cacheControl.includes('max-age') || cacheControl.includes('s-maxage')) {
          return 'cache';
        }
        if (res.headers.get('x-cache') || res.headers.get('x-cache-hits') || res.headers.get('cf-cache-status')) {
          return 'cache';
        }
      } catch {
        continue;
      }
    }

    return '';
  } catch {
    return 'err';
  }
}

function setTabBadge(tabId, status) {
  const text = status || '';
  chrome.action.setBadgeText({ tabId, text }, () => void chrome.runtime.lastError);
  const color = BADGE_COLORS[status] || '#6366f1';
  chrome.action.setBadgeBackgroundColor({ tabId, color }, () => void chrome.runtime.lastError);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  chrome.scripting
    .executeScript({
      target: { tabId },
      func: scanCacheHeaders,
    })
    .then((results) => {
      const status = results?.[0]?.result ?? '';
      setTabBadge(tabId, status);
    })
    .catch(() => {
      setTabBadge(tabId, 'err');
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({ tabId, text: '' }, () => void chrome.runtime.lastError);
});
