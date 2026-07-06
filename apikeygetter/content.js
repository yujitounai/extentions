let isExtensionValid = true;
let scanTimer = null;
let scanInProgress = false;

function shouldSuppressError(error) {
  const message = error?.message || String(error || '');
  return message.includes('Extension context invalidated') || message.includes('Extension has been shutdown');
}

function sendMessageSafely(message) {
  if (!isExtensionValid) return;
  try {
    chrome.runtime.sendMessage(message, () => {
      const err = chrome.runtime.lastError;
      if (err && shouldSuppressError(err)) {
        isExtensionValid = false;
      }
    });
  } catch (error) {
    if (shouldSuppressError(error)) {
      isExtensionValid = false;
    }
  }
}

function searchPageHtml() {
  const root = document.documentElement;
  if (!root) return [];
  return scanText(root.outerHTML, 'html_source', location.href);
}

function searchTextNodes() {
  if (!document.body) return [];

  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    if (!text?.trim()) continue;
    const context = node.parentElement?.tagName || 'テキストノード';
    results.push(...scanText(text, 'text', context));
  }
  return results;
}

function searchInlineScripts() {
  return Array.from(document.querySelectorAll('script:not([src])')).flatMap((script) =>
    scanText(script.textContent, 'inline_script', 'インラインスクリプト')
  );
}

function collectPageAssets() {
  const iframes = Array.from(document.querySelectorAll('iframe[src]')).map((iframe) => iframe.src);
  const scripts = Array.from(document.querySelectorAll('script[src]'))
    .map((script) => script.src)
    .filter((src) => src && !src.startsWith('data:'));
  return { iframes, scripts };
}

function collectResourceReferences() {
  const items = [];

  function add(url, source) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    try {
      items.push({ url: new URL(url, location.href).href, source });
    } catch {
      /* skip */
    }
  }

  document.querySelectorAll('script[src]').forEach((el) => add(el.src, 'script'));
  document.querySelectorAll('link[href]').forEach((el) => add(el.href, 'link'));
  document.querySelectorAll('iframe[src]').forEach((el) => add(el.src, 'iframe'));
  document.querySelectorAll('img[src], source[src], video[src], audio[src]').forEach((el) => {
    add(el.src || el.currentSrc, el.tagName.toLowerCase());
  });

  for (const entry of performance.getEntriesByType('resource')) {
    add(entry.name, 'performance');
  }

  return items;
}

const SOURCE_LABELS = {
  script: 'script',
  link: 'link',
  iframe: 'iframe',
  img: 'img',
  source: 'source',
  video: 'video',
  audio: 'audio',
  performance: 'Performance API',
  html_reference: 'HTML内参照',
};

function detectSquattedCdns() {
  const hits = [];
  const matchedDomainsFromResources = new Set();

  for (const { url, source } of collectResourceReferences()) {
    const match = matchSquattedCdnUrl(url);
    if (!match) continue;
    matchedDomainsFromResources.add(match.matchedDomain);
    hits.push({
      url: match.url,
      hostname: match.hostname,
      matchedDomain: match.matchedDomain,
      source: SOURCE_LABELS[source] || source,
    });
  }

  const html = document.documentElement?.outerHTML || '';
  for (const domain of SQUATTED_CDN_DOMAINS) {
    if (!html.includes(domain)) continue;
    if (matchedDomainsFromResources.has(domain)) continue;
    hits.push({
      url: `（HTML内に "${domain}" の記述）`,
      hostname: domain,
      matchedDomain: domain,
      source: SOURCE_LABELS.html_reference,
    });
  }

  return dedupeSquattedCdnHits(hits);
}

function partitionScripts(scripts) {
  const inPage = [];
  const viaExtension = [];

  for (const src of scripts) {
    try {
      const url = new URL(src, location.href);
      if (url.protocol === 'blob:') continue;
      // HTTPS ページから HTTP スクリプトを fetch すると Mixed Content でブロックされる
      if (location.protocol === 'https:' && url.protocol === 'http:') {
        viaExtension.push(src);
      } else {
        inPage.push(src);
      }
    } catch {
      /* skip invalid URL */
    }
  }

  return { inPage, viaExtension };
}

function fetchScriptsViaExtension(urls) {
  if (!urls.length) return Promise.resolve([]);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'FETCH_AND_SCAN_SCRIPTS', urls }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (!shouldSuppressError(err)) {
          console.warn('[Secret Scanner] extension fetch failed:', err.message);
        }
        resolve([]);
        return;
      }
      resolve(response?.results || []);
    });
  });
}

async function fetchExternalScripts(scripts) {
  const results = [];
  const { inPage, viaExtension } = partitionScripts(scripts);

  await Promise.all(
    inPage.map(async (src) => {
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const text = await res.text();
        results.push(...scanText(text, 'external_script', `外部スクリプト: ${src}`));
      } catch {
        // same-origin は成功しやすい。cross-origin は CORS で失敗しうる
      }
    })
  );

  if (viaExtension.length) {
    const extensionResults = await fetchScriptsViaExtension(viaExtension);
    results.push(...extensionResults);
  }

  return results;
}

async function runScan() {
  if (!isExtensionValid || scanInProgress) return;
  scanInProgress = true;

  try {
    if (shouldSkipDomain(location.hostname)) {
      sendMessageSafely({ type: 'SCAN_SKIPPED', url: location.href });
      return;
    }

    const assets = collectPageAssets();
    const squattedCdns = detectSquattedCdns();
    const scriptResults = await fetchExternalScripts(assets.scripts);
    const domResults = dedupeResults([
      ...searchPageHtml(),
      ...searchTextNodes(),
      ...searchInlineScripts(),
      ...scriptResults,
    ]);

    sendMessageSafely({
      type: 'DOM_SCAN_RESULTS',
      url: location.href,
      results: domResults,
      iframes: assets.iframes,
      scripts: assets.scripts,
      squattedCdns,
    });
  } finally {
    scanInProgress = false;
  }
}

function scheduleScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    runScan();
  }, 400);
}

function init() {
  if (shouldSkipDomain(location.hostname)) {
    sendMessageSafely({ type: 'SCAN_SKIPPED', url: location.href });
    return;
  }

  runScan();

  if (!document.body) return;
  try {
    const observer = new MutationObserver(() => {
      if (!isExtensionValid) {
        observer.disconnect();
        return;
      }
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    if (!shouldSuppressError(error)) {
      console.warn('[Secret Scanner] MutationObserver error:', error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FORCE_RESCAN') {
    runScan();
  }
});
