const EXCLUDE_JS_DOMAINS = [
  'www.gstatic.com',
  'pagead2.googlesyndication.com',
  'platform.twitter.com',
];

const VULNERABLE_JS_PATHS = [
  '/purl.js',
  '/jquery.query.js',
  '/jquery.query-object.js',
  '/pdf.js',
  '/lodash.js',
  'lodash.min.js',
  'jquery-1.7.2.',
];

const KEYWORDS = [
  'URLSearchParams',
  'decodeURI',
  'location',
  'Ziggy',
  'jsRoutes',
  'Object.prototype',
  'eval(',
  'innerHTML',
  '.html(',
];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLinkList(elementId, urls) {
  const el = document.getElementById(elementId);
  if (!urls?.length) {
    el.className = 'link-list empty';
    el.textContent = 'なし';
    return;
  }
  el.className = 'link-list';
  el.innerHTML = urls
    .map((url) => {
      const safe = escapeHtml(url);
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
    })
    .join('');
}

function renderKeywordResults(items) {
  const el = document.getElementById('keywordResults');
  if (!items?.length) {
    el.className = 'link-list empty';
    el.textContent = 'なし';
    return;
  }
  el.className = 'link-list';
  el.innerHTML = items
    .map((item) => {
      const safeUrl = escapeHtml(item.url);
      const kws = escapeHtml(item.foundKeywords.join(', '));
      return `<div><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>: ${kws}</div>`;
    })
    .join('');
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.tab;
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('http')) return null;
  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return null;
  }
  return { tab, hostname };
}

function runScan(tabId, hostname) {
  chrome.scripting.executeScript(
    {
      target: { tabId },
      func: listResources,
      args: [hostname],
    },
    (results) => {
      if (!results?.[0]?.result) {
        document.getElementById('resourceList').value = 'リソースを取得できませんでした';
        return;
      }

      const data = results[0].result;
      document.getElementById('resourceList').value = formatResourceList(data);

      const allUrls = [...data.sameDomain, ...data.differentDomain].filter(Boolean);
      const externalUrls = data.differentDomain.filter((u) => u && u.startsWith('http'));

      const awsUrls = externalUrls.filter((url) => {
        try {
          const h = new URL(url).hostname;
          return h.endsWith('amazonaws.com') || h.includes('.s3.');
        } catch {
          return false;
        }
      });
      renderLinkList('staticscan', awsUrls);

      const vulnUrls = allUrls.filter((url) => VULNERABLE_JS_PATHS.some((p) => url.includes(p)));
      renderLinkList('jsscan', vulnUrls);

      const jsUrls = allUrls.filter((url) => {
        try {
          if (!url.endsWith('.js')) return false;
          const h = new URL(url).hostname;
          return !EXCLUDE_JS_DOMAINS.some((d) => h.endsWith(d));
        } catch {
          return false;
        }
      });

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: checkForRegex,
          args: [jsUrls],
        },
        (regexResults) => {
          const payload = regexResults?.[0]?.result || { regexUrls: [], suspiciousUrls: [] };
          renderLinkList('regexscan', payload.regexUrls);
          renderLinkList('suspicious', payload.suspiciousUrls);
        }
      );

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: searchForKeywords,
          args: [jsUrls, KEYWORDS],
        },
        (kwResults) => {
          renderKeywordResults(kwResults?.[0]?.result || []);
        }
      );
    }
  );
}

function renderReflectionFindings(lines) {
  const container = document.getElementById('reflectionFindings');
  const findings = [];

  const hostLine = lines.find((l) => l.includes('X-Forwarded-Host Found in Body:'));
  const forLine = lines.find((l) => l.includes('X-Forwarded-For Found in Body:'));
  const otherLine = lines.find((l) => l.includes('X-Others Found in Body:'));
  const dosLine = lines.find((l) => l.includes('Status: 404 Not Found'));

  if (hostLine) findings.push({ label: 'X-Forwarded-Host 反射', html: hostLine });
  if (forLine) findings.push({ label: 'X-Forwarded-For 反射', html: forLine });
  if (otherLine) findings.push({ label: 'X-Others 反射', html: otherLine });
  if (dosLine) findings.push({ label: '404', html: dosLine });

  if (!findings.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = findings
    .map(
      (f) =>
        `<div class="alert hit finding"><strong>${escapeHtml(f.label)}</strong><br>${escapeHtml(f.html)}</div>`
    )
    .join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();

  const ctx = await getActiveTab();
  const originLabel = document.getElementById('originLabel');

  if (!ctx) {
    originLabel.textContent = 'HTTP(S) ページで開いてください';
    document.getElementById('resourceList').value = '';
    return;
  }

  originLabel.textContent = ctx.tab.url;
  runScan(ctx.tab.id, ctx.hostname);

  document.getElementById('loadJs').addEventListener('click', async () => {
    const btn = document.getElementById('loadJs');
    btn.disabled = true;
    document.getElementById('jsHeaders').value = 'スキャン中...';
    document.getElementById('reflectionFindings').innerHTML = '';

    chrome.scripting.executeScript(
      {
        target: { tabId: ctx.tab.id },
        func: loadJavaScriptAndCssAndImageHeaders,
        args: [ctx.hostname],
      },
      (results) => {
        btn.disabled = false;
        const text = results?.[0]?.result || '結果なし';
        document.getElementById('jsHeaders').value = text;
        renderReflectionFindings(text.split('\n'));
      }
    );
  });

  document.getElementById('jQuery171').addEventListener('click', () => {
    if (!confirm('ReDoS PoC を新タブで開きます。続行しますか？')) return;
    window.open(`${ctx.tab.url}#(%20%20%20%20%20%20%20%20xxx())`, '_blank');
  });

  document.getElementById('jQuery183').addEventListener('click', () => {
    if (!confirm('ReDoS PoC を新タブで開きます。続行しますか？')) return;
    window.open(`${ctx.tab.url}#A${'*'.repeat(50000)}A`, '_blank');
  });

  document.getElementById('XSLeak').addEventListener('click', () => {
    if (!confirm('XS-Leak PoC を新タブで開きます。ブラウザが重くなる可能性があります。')) return;
    const hash =
      '#x,*:has(*:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even:has(*:even)))))):contains(\'t\')';
    window.open(ctx.tab.url + hash, '_blank');
  });

  document.getElementById('pp').addEventListener('click', () => {
    window.open(
      `${ctx.tab.url}#__proto__[foo]=bar&constructor[prototype][foo]=bar&__proto__.foo=bar&constructor.prototype.test=test`,
      '_blank'
    );
  });
});

// --- Injected page functions ---

function listResources(activeTabDomain) {
  const resources = document.querySelectorAll('link[rel="stylesheet"], script[src], img[src]');
  return Array.from(resources).reduce(
    (acc, el) => {
      const url = el.href || el.src;
      if (!url) return acc;
      try {
        const domain = new URL(url, location.href).hostname;
        if (domain === activeTabDomain) acc.sameDomain.push(url);
        else acc.differentDomain.push(url);
      } catch {
        /* skip */
      }
      return acc;
    },
    { sameDomain: [], differentDomain: [] }
  );
}

function formatResourceList(resourceData) {
  const same = resourceData.sameDomain.join('\n') || '(なし)';
  const diff = resourceData.differentDomain.join('\n') || '(なし)';
  return `Same Domain URLs:\n${same}\n\nDifferent Domain URLs:\n${diff}`;
}

function checkForRegex(urls) {
  const regexPattern = /\/(?:\\\/|[^\/\n])+\/[gimuy]*/g;
  const suspiciousPattern = /\+\)\+|\+\)\*/g;

  return Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((r) => r.text())
        .then((scriptContent) => {
          const cleaned = scriptContent.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
          const regexUrls = [];
          const suspiciousUrls = [];
          const matches = cleaned.match(regexPattern);
          if (matches) {
            if (matches.some((m) => suspiciousPattern.test(m))) suspiciousUrls.push(url);
            else regexUrls.push(url);
          }
          return { regexUrls, suspiciousUrls };
        })
        .catch(() => ({ regexUrls: [], suspiciousUrls: [] }))
    )
  ).then((results) => ({
    regexUrls: [...new Set(results.flatMap((r) => r.regexUrls))],
    suspiciousUrls: [...new Set(results.flatMap((r) => r.suspiciousUrls))],
  }));
}

function searchForKeywords(urls, keywords) {
  return Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((r) => r.text())
        .then((content) => {
          const foundKeywords = keywords.filter((kw) => content.includes(kw));
          return foundKeywords.length ? { url, foundKeywords } : null;
        })
        .catch(() => null)
    )
  ).then((results) => results.filter(Boolean));
}

function loadJavaScriptAndCssAndImageHeaders(activeTabDomain) {
  const BODY_PREVIEW_MAX = 4000;

  function fetchResource(url) {
    const r2 = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    const r3 = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    const r4 = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    const r1 = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    const hasQuery = url.includes('?');
    const fetchUrl = `${url}${hasQuery ? '&' : '?'}cb=${r1}`;

    const headers = new Headers();
    headers.append('X-Forwarded-Host', r2);
    headers.append('X-Forwarded-For', r3);
    headers.append('Base-Url', r4);
    headers.append('Client-IP', r4);
    headers.append('Http-Url', r4);
    headers.append('Proxy-Host', r4);
    headers.append('Real-Ip', r4);
    headers.append('Referer', r4);
    headers.append('Url', r4);

    return fetch(fetchUrl, { method: 'GET', headers })
      .then(async (response) => {
        const headersString = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');

        if (response.status === 404) {
          return `Status: 404 Not Found: ${fetchUrl}`;
        }

        let body = await response.text();
        if (body.length > BODY_PREVIEW_MAX) {
          body = `${body.slice(0, BODY_PREVIEW_MAX)}\n... (truncated)`;
        }

        let result = `URL: ${fetchUrl}\nStatus: ${response.status}\n\nHeaders:\n${headersString}\n\nBody:\n${body}`;

        if (body.includes(r2)) {
          result += `\n\nX-Forwarded-Host Found in Body: ${fetchUrl}`;
        }
        if (body.includes(r3)) {
          result += `\n\nX-Forwarded-For Found in Body: ${fetchUrl}`;
        }
        if (body.includes(r4)) {
          result += `\n\nX-Others Found in Body: ${fetchUrl}`;
        }
        return result;
      })
      .catch((error) => `Error: ${error.message} (${url})`);
  }

  const scripts = [...document.scripts].filter((s) => {
    try {
      return s.src && new URL(s.src, location.href).hostname === activeTabDomain;
    } catch {
      return false;
    }
  });

  const stylesheets = [...document.styleSheets].filter((s) => {
    try {
      return s.href && new URL(s.href, location.href).hostname === activeTabDomain;
    } catch {
      return false;
    }
  });

  const images = [...document.images].filter((img) => {
    try {
      return img.src && new URL(img.src, location.href).hostname === activeTabDomain;
    } catch {
      return false;
    }
  });

  const promises = [fetchResource(location.href)];
  if (scripts[0]) promises.push(fetchResource(scripts[0].src));
  if (stylesheets[0]) promises.push(fetchResource(stylesheets[0].href));
  if (images[0]) promises.push(fetchResource(images[0].src));

  return Promise.all(promises).then((results) => results.join('\n\n---\n\n'));
}
