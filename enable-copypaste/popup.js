const STORAGE_KEY = 'settings';
const DEFAULT_SETTINGS = {
  enabled: true,
  disabledHosts: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  const siteToggle = document.getElementById('siteToggle');
  const globalToggle = document.getElementById('globalToggle');
  const currentDomain = document.getElementById('currentDomain');
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const reloadHint = document.getElementById('reloadHint');

  let currentHost = null;
  let settings = { ...DEFAULT_SETTINGS };
  let isSpecialPage = false;

  function normalizeHost(hostname) {
    return String(hostname || '').replace(/^www\./, '');
  }

  function isHostInDisabledList(host, disabledHosts) {
    const bare = normalizeHost(host);
    return disabledHosts.some((entry) => normalizeHost(entry) === bare);
  }

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function getHostFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    settings = result[STORAGE_KEY] || DEFAULT_SETTINGS;
    if (!Array.isArray(settings.disabledHosts)) {
      settings.disabledHosts = [];
    }
    return settings;
  }

  async function saveSettings() {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  function isSiteEnabled() {
    if (!currentHost || isSpecialPage) {
      return false;
    }
    return settings.enabled && !isHostInDisabledList(currentHost, settings.disabledHosts);
  }

  function updateUI() {
    const globalEnabled = settings.enabled;
    const siteEnabled = isSiteEnabled();
    const siteToggleDisabled = isSpecialPage || !currentHost || !globalEnabled;

    globalToggle.dataset.enabled = String(globalEnabled);
    siteToggle.dataset.enabled = String(siteEnabled);
    siteToggle.disabled = siteToggleDisabled;
    siteToggle.style.opacity = siteToggleDisabled ? '0.5' : '1';

    statusBar.className = 'status-bar ' + (siteEnabled ? 'enabled' : 'disabled');
    statusText.textContent = siteEnabled ? 'コピペ解除 有効' : 'コピペ解除 無効';

    const statusIcon = statusBar.querySelector('.status-icon');
    statusIcon.textContent = siteEnabled ? '✓' : '✕';
  }

  function showReloadHint() {
    reloadHint.classList.add('show');
  }

  async function reloadPage() {
    const tab = await getCurrentTab();
    if (tab?.id) {
      chrome.tabs.reload(tab.id);
    }
  }

  async function init() {
    const tab = await getCurrentTab();
    await loadSettings();

    if (!tab?.url) {
      isSpecialPage = true;
      currentDomain.textContent = '利用不可';
      updateUI();
      return;
    }

    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-extension://')
    ) {
      isSpecialPage = true;
      currentDomain.textContent = '特殊ページ';
      updateUI();
      return;
    }

    currentHost = getHostFromUrl(tab.url);
    currentDomain.textContent = currentHost || '-';
    updateUI();
  }

  siteToggle.addEventListener('click', async () => {
    if (!currentHost || isSpecialPage || !settings.enabled || siteToggle.disabled) {
      return;
    }

    siteToggle.classList.add('loading');
    const currentlyEnabled = isSiteEnabled();

    if (currentlyEnabled) {
      if (!isHostInDisabledList(currentHost, settings.disabledHosts)) {
        settings.disabledHosts.push(currentHost);
      }
    } else {
      const bare = normalizeHost(currentHost);
      settings.disabledHosts = settings.disabledHosts.filter((host) => normalizeHost(host) !== bare);
    }

    await saveSettings();
    siteToggle.classList.remove('loading');
    updateUI();
    showReloadHint();
  });

  globalToggle.addEventListener('click', async () => {
    if (globalToggle.classList.contains('loading')) {
      return;
    }

    globalToggle.classList.add('loading');
    settings.enabled = !settings.enabled;
    await saveSettings();
    globalToggle.classList.remove('loading');
    updateUI();
    showReloadHint();
  });

  reloadHint.addEventListener('click', reloadPage);

  init();
});
