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

/** オリジン直下でよく見つかる探索対象パス（診断で見逃すとまずいものを優先） */
const COMMON_PROBE_PATHS = [
  // 公開メタ・発見情報
  '/robots.txt',
  '/robots.txt.bak',
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap.txt',
  '/sitemaps.xml',
  '/humans.txt',
  '/security.txt',
  '/ads.txt',
  '/app-ads.txt',
  '/crossdomain.xml',
  '/clientaccesspolicy.xml',
  '/favicon.ico',
  '/manifest.json',
  '/site.webmanifest',
  '/browserconfig.xml',
  '/.well-known/security.txt',
  '/.well-known/change-password',
  '/.well-known/assetlinks.json',
  '/.well-known/apple-app-site-association',
  '/.well-known/openid-configuration',
  '/.well-known/oauth-authorization-server',
  '/.well-known/jwks.json',
  '/jwks.json',
  '/.well-known/host-meta',
  '/.well-known/nodeinfo',

  // VCS / 履歴露出
  '/.git/HEAD',
  '/.git/config',
  '/.git/index',
  '/.git/logs/HEAD',
  '/.gitignore',
  '/.gitattributes',
  '/.svn/entries',
  '/.svn/wc.db',
  '/.hg/hgrc',
  '/.hg/requires',
  '/CVS/Root',
  '/.bzr/README',

  // 環境変数・秘密情報・設定
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/.env.staging',
  '/.env.bak',
  '/.env.old',
  '/.env.backup',
  '/.env.example',
  '/.env.prod',
  '/.env.dev',
  '/config.json',
  '/config.yml',
  '/config.yaml',
  '/config.php',
  '/configuration.php',
  '/settings.py',
  '/local_settings.py',
  '/settings.json',
  '/appsettings.json',
  '/appsettings.Development.json',
  '/appsettings.Production.json',
  '/application.properties',
  '/application.yml',
  '/application-dev.yml',
  '/application-prod.yml',
  '/parameters.yml',
  '/secrets.yml',
  '/secrets.json',
  '/credentials.json',
  '/credentials.xml',
  '/service-account.json',
  '/firebase.json',
  '/google-services.json',
  '/.aws/credentials',
  '/.aws/config',
  '/aws.json',
  '/.npmrc',
  '/.yarnrc',
  '/.yarnrc.yml',
  '/.dockercfg',
  '/.docker/config.json',
  '/docker-compose.yml',
  '/docker-compose.yaml',
  '/Dockerfile',
  '/.gitlab-ci.yml',
  '/.travis.yml',
  '/Jenkinsfile',
  '/bitbucket-pipelines.yml',
  '/azure-pipelines.yml',
  '/.circleci/config.yml',
  '/sftp-config.json',
  '/.vscode/sftp.json',
  '/.idea/workspace.xml',
  '/.ftpconfig',
  '/.remote-sync.json',
  '/id_rsa',
  '/id_rsa.pub',
  '/.ssh/id_rsa',
  '/.ssh/authorized_keys',
  '/private.key',
  '/server.key',
  '/ssl.key',
  '/cert.pem',
  '/certificate.pem',
  '/keystore.jks',
  '/.htaccess',
  '/.htpasswd',
  '/web.config',
  '/web.config.bak',
  '/Web.config',

  // CMS / フレームワーク露出
  '/wp-config.php',
  '/wp-login.php',
  '/xmlrpc.php',
  '/readme.html',
  '/license.txt',
  '/wp-admin/',
  '/administrator/',
  '/user/login',
  '/sites/default/settings.php',
  '/LocalSettings.php',
  '/typo3conf/localconf.php',
  '/app/etc/local.xml',
  '/app/etc/env.php',
  '/storage/logs/laravel.log',
  '/storage/framework/sessions/',
  '/_ignition/health-check',
  '/telescope',
  '/horizon',
  '/nova',
  '/_profiler',
  '/_profiler/phpinfo',
  '/rails/info/properties',
  '/rails/info/routes',

  // 依存・ビルド成果物
  '/package.json',
  '/package-lock.json',
  '/yarn.lock',
  '/pnpm-lock.yaml',
  '/composer.json',
  '/composer.lock',
  '/Gemfile',
  '/Gemfile.lock',
  '/Pipfile',
  '/Pipfile.lock',
  '/requirements.txt',
  '/poetry.lock',
  '/go.mod',
  '/Cargo.toml',
  '/pom.xml',
  '/build.gradle',
  '/webpack.config.js',
  '/vite.config.js',
  '/vite.config.ts',
  '/next.config.js',
  '/nuxt.config.js',
  '/tsconfig.json',
  '/.babelrc',
  '/babel.config.js',

  // デバッグ・管理・情報開示
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/i.php',
  '/pi.php',
  '/php.php',
  '/server-status',
  '/server-info',
  '/status',
  '/health',
  '/healthz',
  '/ready',
  '/readiness',
  '/liveness',
  '/metrics',
  '/prometheus',
  '/debug',
  '/debug/vars',
  '/debug/pprof',
  '/__debug__',
  '/_debugbar',
  '/console',
  '/h2-console',
  '/jolokia',
  '/jolokia/list',
  '/elmah.axd',
  '/trace.axd',
  '/Trace.axd',
  '/adminer.php',
  '/adminer/',
  '/phpmyadmin/',
  '/pma/',
  '/myadmin/',
  '/mysql/',
  '/dbadmin/',
  '/admin/',
  '/administrator/index.php',
  '/manager/html',
  '/jmx-console/',
  '/web-console/',
  '/invoker/JMXInvokerServlet',

  // API ドキュメント・GraphQL
  '/swagger.json',
  '/swagger.yaml',
  '/swagger/v1/swagger.json',
  '/swagger-ui.html',
  '/swagger-ui/',
  '/swagger/index.html',
  '/openapi.json',
  '/openapi.yaml',
  '/openapi.yml',
  '/api-docs',
  '/api/swagger.json',
  '/api/openapi.json',
  '/api/documentation',
  '/v2/api-docs',
  '/v3/api-docs',
  '/docs',
  '/redoc',
  '/graphql',
  '/graphql/console',
  '/graphiql',
  '/altair',
  '/playground',
  '/api/graphql',

  // Spring Actuator（特に heapdump / env は重大）
  '/actuator',
  '/actuator/health',
  '/actuator/env',
  '/actuator/beans',
  '/actuator/mappings',
  '/actuator/configprops',
  '/actuator/heapdump',
  '/actuator/threaddump',
  '/actuator/logfile',
  '/actuator/gateway/routes',
  '/manage/env',
  '/manage/heapdump',

  // バックアップ・ダンプ・ログ
  '/backup.zip',
  '/backup.tar.gz',
  '/backup.rar',
  '/backup.7z',
  '/backup.sql',
  '/backup.bak',
  '/site.zip',
  '/www.zip',
  '/html.zip',
  '/public.zip',
  '/web.zip',
  '/dump.sql',
  '/database.sql',
  '/db.sql',
  '/db_backup.sql',
  '/data.sql',
  '/mysql.sql',
  '/export.sql',
  '/.DS_Store',
  '/Thumbs.db',
  '/desktop.ini',
  '/error_log',
  '/error.log',
  '/access.log',
  '/debug.log',
  '/laravel.log',
  '/npm-debug.log',
  '/yarn-error.log',
  '/.bash_history',
  '/.mysql_history',
  '/.sh_history',
  '/CHANGELOG.md',
  '/CHANGELOG.txt',
  '/changelog.txt',
  '/README.md',
  '/README.txt',
  '/INSTALL.txt',
  '/VERSION',
  '/version.txt',
  '/WEB-INF/web.xml',
  '/META-INF/MANIFEST.MF',
  '/cgi-bin/',
  '/.well-known/acme-challenge/',
];

/** 興味ありとみなす HTTP ステータス */
const INTERESTING_STATUSES = new Set([200, 201, 204, 301, 302, 307, 308, 401, 403]);

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
    squattedCdns: [],
    probeResults: [],
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

  const secretCount = (state.results || []).length;
  const cdnCount = (state.squattedCdns || []).length;
  const alert = secretCount > 0 || cdnCount > 0;

  let badgeText = '';
  if (cdnCount > 0) {
    badgeText = cdnCount > 9 ? '9+' : String(cdnCount);
  } else if (secretCount > 0) {
    badgeText = secretCount > 99 ? '99+' : String(secretCount);
  }

  chrome.action.setBadgeText({ tabId, text: badgeText }, () => void chrome.runtime.lastError);
  chrome.action.setBadgeBackgroundColor(
    { tabId, color: cdnCount > 0 ? '#dc2626' : '#ef4444' },
    () => void chrome.runtime.lastError
  );
  chrome.action.setIcon({ tabId, path: alert ? ICON_ALERT : ICON_DEFAULT }, () => void chrome.runtime.lastError);
}

function buildTabPayload(state) {
  return {
    url: state.url,
    skipped: state.skipped,
    results: state.results || [],
    iframes: state.iframes || [],
    scripts: state.scripts || [],
    squattedCdns: state.squattedCdns || [],
    probeResults: state.probeResults || [],
    scanning: false,
  };
}

function buildProbeTargets(pageUrl, scripts = []) {
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  const targets = [];
  const seen = new Set();

  const add = (url, kind, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    targets.push({ url, kind, label });
  };

  for (const path of COMMON_PROBE_PATHS) {
    add(`${origin}${path}`, 'common', path);
  }

  for (const scriptUrl of scripts) {
    if (!scriptUrl || typeof scriptUrl !== 'string') continue;
    try {
      const u = new URL(scriptUrl, origin);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (!u.pathname.endsWith('.map')) {
        add(`${u.href}.map`, 'sourcemap', `${u.pathname}.map`);
      }
    } catch {
      // ignore invalid script URLs
    }
  }

  return targets;
}

async function probeOneUrl(url) {
  try {
    let res;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'manual', cache: 'no-store' });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store' });
      }
    } catch {
      res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store' });
    }
    return { url, status: res.status, ok: INTERESTING_STATUSES.has(res.status) };
  } catch (err) {
    return { url, status: 0, ok: false, error: err?.message || 'fetch failed' };
  }
}

async function runFileProbe(pageUrl, scripts = []) {
  const targets = buildProbeTargets(pageUrl, scripts);
  const found = [];
  const concurrency = 6;

  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (target) => {
        const result = await probeOneUrl(target.url);
        return { ...target, ...result };
      })
    );
    for (const item of results) {
      if (item.ok) found.push(item);
    }
  }

  found.sort((a, b) => a.url.localeCompare(b.url));
  return { found, total: targets.length };
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

    if (message.type === 'FETCH_AND_SCAN_SCRIPTS') {
      const urls = Array.isArray(message.urls) ? message.urls : [];
      const results = [];

      await Promise.all(
        urls.map(async (src) => {
          try {
            const res = await fetch(src);
            if (!res.ok) return;
            const text = await res.text();
            results.push(...scanText(text, 'external_script', `外部スクリプト: ${src}`));
          } catch {
            // 取得できない場合は URL 文字列のみスキャン
            results.push(...scanText(src, 'external_script', `外部スクリプト URL（未取得）: ${src}`));
          }
        })
      );

      sendResponse({ ok: true, results: dedupeResults(results) });
      return;
    }

    if (message.type === 'DOM_SCAN_RESULTS' && tabId !== undefined) {
      const state = getTabState(tabId);
      state.url = message.url || state.url;
      state.skipped = false;
      state.results = dedupeResults(message.results || []);
      state.iframes = message.iframes || [];
      state.scripts = message.scripts || [];
      state.squattedCdns = message.squattedCdns || [];

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

    if (message.type === 'PROBE_FILES' && message.tabId !== undefined) {
      const state = await ensureTabState(message.tabId);
      let pageUrl = message.url || state.url;
      if (!pageUrl) {
        try {
          const tab = await chrome.tabs.get(message.tabId);
          pageUrl = tab?.url || '';
        } catch {
          pageUrl = '';
        }
      }
      if (!pageUrl?.startsWith('http')) {
        sendResponse({ ok: false, error: 'HTTP(S) ページでのみ探索できます' });
        return;
      }

      const scripts = Array.isArray(message.scripts)
        ? message.scripts
        : state.scripts || [];
      const { found, total } = await runFileProbe(pageUrl, scripts);
      state.url = pageUrl;
      state.probeResults = found;
      await saveTabState(message.tabId);
      sendResponse({ ok: true, found, total });
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
