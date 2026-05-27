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

async function fetchExternalScripts(scripts) {
  const results = [];
  await Promise.all(
    scripts.map(async (src) => {
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
