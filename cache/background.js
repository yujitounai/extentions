const BADGE_COLORS = {
  cache: '#22c55e',
  no: '#64748b',
  err: '#ef4444',
};

function cacheStorageKey(tabId) {
  return `cacheScan_${tabId}`;
}

async function scanCacheHeaders() {
  const MAX_FETCH = 10;
  const FETCH_CONCURRENCY = 4;
  const STATIC_EXT = /\.(js|mjs|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico|avif|map|json)(\?|#|$)/i;

  function sameOrigin(url) {
    try {
      return new URL(url, location.href).hostname === location.hostname;
    } catch {
      return false;
    }
  }

  function addUrl(set, raw) {
    if (!raw) return;
    try {
      const href = new URL(raw, location.href).href;
      if (sameOrigin(href)) set.add(href);
    } catch {
      /* skip */
    }
  }

  function collectUrls() {
    const urls = new Set();

    document
      .querySelectorAll(
        'link[href], script[src], img[src], source[src], video[src], audio[src], iframe[src]'
      )
      .forEach((el) => {
        addUrl(urls, el.href || el.src || el.currentSrc);
      });

    for (const entry of performance.getEntriesByType('resource')) {
      addUrl(urls, entry.name);
    }

    addUrl(urls, location.href);
    return urls;
  }

  function scoreUrl(url) {
    let score = 0;
    if (STATIC_EXT.test(url)) score += 12;
    if (/\.(js|css|mjs)(\?|#|$)/i.test(url)) score += 6;
    if (/\.(png|jpe?g|gif|webp|svg|woff2?)(\?|#|$)/i.test(url)) score += 4;
    if (url.split('?')[0] === location.href.split('?')[0]) score -= 8;
    return score;
  }

  function prioritize(urls, limit) {
    return [...urls].sort((a, b) => scoreUrl(b) - scoreUrl(a)).slice(0, limit);
  }

  function headersToObject(res) {
    const h = {};
    res.headers.forEach((v, k) => {
      h[k.toLowerCase()] = v;
    });
    return h;
  }

  function pick(h, ...keys) {
    for (const key of keys) {
      const v = h[key.toLowerCase()];
      if (v) return v;
    }
    return null;
  }

  function extractFields(h) {
    return {
      cacheControl: pick(h, 'cache-control'),
      expires: pick(h, 'expires'),
      etag: pick(h, 'etag'),
      lastModified: pick(h, 'last-modified'),
      age: pick(h, 'age'),
      xCache: pick(h, 'x-cache'),
      xCacheHits: pick(h, 'x-cache-hits'),
      cfCacheStatus: pick(h, 'cf-cache-status'),
      xCacheStatus: pick(h, 'x-cache-status'),
      surrogateControl: pick(h, 'surrogate-control'),
      cdnCacheControl: pick(h, 'cdn-cache-control'),
      via: pick(h, 'via'),
      vary: pick(h, 'vary'),
    };
  }

  function analyzeHeaders(h, url) {
    const fields = extractFields(h);
    const cc = (fields.cacheControl || '').toLowerCase();
    const reasons = [];

    if (cc.includes('no-store')) {
      return { hit: false, reason: null, ...fields };
    }

    if (/max-age|s-maxage|immutable|stale-while-revalidate|stale-if-error/.test(cc)) {
      reasons.push('Cache-Control（TTL / 拡張）');
    }
    if (/\bpublic\b/.test(cc) || /\bprivate\b/.test(cc)) {
      reasons.push('Cache-Control: public / private');
    }
    if (cc.includes('no-cache')) {
      reasons.push('Cache-Control: no-cache（再検証キャッシュ）');
    }

    const expires = fields.expires;
    if (expires && expires !== '0') {
      const expMs = Date.parse(expires);
      if (Number.isNaN(expMs) || expMs > Date.now()) {
        reasons.push(`Expires`);
      }
    }

    const ageNum = parseInt(fields.age || '', 10);
    if (!Number.isNaN(ageNum) && ageNum > 0) {
      reasons.push(`Age: ${fields.age}`);
    }

    const cdnPairs = [
      ['x-cache', 'X-Cache'],
      ['x-cache-hits', 'X-Cache-Hits'],
      ['cf-cache-status', 'CF-Cache-Status'],
      ['x-cache-status', 'X-Cache-Status'],
      ['x-varnish', 'X-Varnish'],
      ['x-served-by', 'X-Served-By'],
      ['surrogate-control', 'Surrogate-Control'],
      ['cdn-cache-control', 'CDN-Cache-Control'],
      ['x-amz-cf-pop', 'CloudFront POP'],
      ['x-amz-cf-id', 'CloudFront'],
    ];
    for (const [key, label] of cdnPairs) {
      const v = pick(h, key);
      if (v) reasons.push(`${label}: ${v}`);
    }

    const via = fields.via;
    if (via && /cache|varnish|cloudflare|cdn|squid|akamai|fastly|proxy/i.test(via)) {
      reasons.push(`Via: ${via}`);
    }

    const isStatic = STATIC_EXT.test(url);
    if (isStatic && (fields.etag || fields.lastModified)) {
      const parts = [];
      if (fields.etag) parts.push('ETag');
      if (fields.lastModified) parts.push('Last-Modified');
      reasons.push(`検証子（${parts.join(' / ')}）`);
    }

    return {
      hit: reasons.length > 0,
      reason: reasons.join(' · '),
      ...fields,
    };
  }

  function scanPerformanceCache() {
    const byUrl = new Map();

    const nav = performance.getEntriesByType('navigation')[0];
    if (nav?.name && sameOrigin(nav.name)) {
      let reason = null;
      if (nav.deliveryType === 'cache') {
        reason = 'ブラウザキャッシュ（deliveryType=cache）';
      } else if (nav.transferSize === 0 && nav.decodedBodySize > 0) {
        reason = 'ブラウザキャッシュ（transferSize=0）';
      }
      if (reason) {
        byUrl.set(nav.name, {
          url: nav.name,
          hit: true,
          reason,
          source: 'performance',
          deliveryType: nav.deliveryType || null,
          transferSize: nav.transferSize,
        });
      }
    }

    for (const entry of performance.getEntriesByType('resource')) {
      if (!entry.name || !sameOrigin(entry.name)) continue;

      let reason = null;
      if (entry.deliveryType === 'cache') {
        reason = 'ブラウザキャッシュ（deliveryType=cache）';
      } else if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
        reason = 'ブラウザキャッシュ（transferSize=0）';
      }

      if (reason) {
        byUrl.set(entry.name, {
          url: entry.name,
          hit: true,
          reason,
          source: 'performance',
          deliveryType: entry.deliveryType || null,
          transferSize: entry.transferSize,
        });
      }
    }

    return [...byUrl.values()];
  }

  async function fetchOne(url) {
    const res = await fetch(url, { method: 'GET', cache: 'reload', credentials: 'same-origin' });
    const analysis = analyzeHeaders(headersToObject(res), url);
    return {
      url,
      httpStatus: res.status,
      source: 'fetch',
      ...analysis,
    };
  }

  async function mapConcurrent(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        const item = items[i];
        try {
          results[i] = await fn(item);
        } catch (err) {
          results[i] = { url: item, hit: false, error: err?.message || String(err), source: 'fetch' };
        }
      }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  try {
    const allUrls = collectUrls();
    const candidates = prioritize(allUrls, MAX_FETCH);
    const checked = [];
    const seen = new Set();

    for (const perfHit of scanPerformanceCache()) {
      checked.push(perfHit);
      seen.add(perfHit.url);
    }

    if (candidates.length) {
      const fetched = await mapConcurrent(candidates, FETCH_CONCURRENCY, fetchOne);
      for (const entry of fetched) {
        const existingIdx = checked.findIndex((c) => c.url === entry.url);
        if (existingIdx >= 0 && entry.hit) {
          const perf = checked[existingIdx];
          checked[existingIdx] = {
            ...entry,
            reason: entry.reason ? `${perf.reason} · ${entry.reason}` : perf.reason,
          };
        } else if (existingIdx < 0) {
          checked.push(entry);
        } else if (!seen.has(entry.url)) {
          checked.push(entry);
        }
        seen.add(entry.url);
      }
    }

    if (!allUrls.size) {
      return { status: 'no', checked, scannedAt: Date.now() };
    }

    const hasHit = checked.some((c) => c.hit);
    if (!hasHit && checked.length && checked.every((c) => c.error)) {
      return { status: 'err', checked, scannedAt: Date.now() };
    }

    return { status: hasHit ? 'cache' : '', checked, scannedAt: Date.now() };
  } catch {
    return { status: 'err', checked: [], scannedAt: Date.now() };
  }
}

function setTabBadge(tabId, status) {
  const text = status || '';
  chrome.action.setBadgeText({ tabId, text }, () => void chrome.runtime.lastError);
  const color = BADGE_COLORS[status] || '#6366f1';
  chrome.action.setBadgeBackgroundColor({ tabId, color }, () => void chrome.runtime.lastError);
}

async function runCacheScanForTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: scanCacheHeaders,
    });
    const payload = results?.[0]?.result ?? { status: 'err', checked: [], scannedAt: Date.now() };
    await chrome.storage.session.set({ [cacheStorageKey(tabId)]: payload });
    setTabBadge(tabId, payload.status);
    return payload;
  } catch {
    const payload = { status: 'err', checked: [], scannedAt: Date.now() };
    await chrome.storage.session.set({ [cacheStorageKey(tabId)]: payload });
    setTabBadge(tabId, 'err');
    return payload;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;
  void runCacheScanForTab(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({ tabId, text: '' }, () => void chrome.runtime.lastError);
  void chrome.storage.session.remove(cacheStorageKey(tabId));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_CACHE_SCAN') {
    const key = cacheStorageKey(message.tabId);
    chrome.storage.session.get(key).then((data) => {
      sendResponse(data[key] ?? null);
    });
    return true;
  }
  if (message?.type === 'REFRESH_CACHE_SCAN') {
    runCacheScanForTab(message.tabId).then(sendResponse);
    return true;
  }
  return false;
});
