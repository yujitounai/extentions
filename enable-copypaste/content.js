(function () {
  const STORAGE_KEY = 'settings';
  const STYLE_ID = 'enable-copypaste-style';
  const DEFAULT_SETTINGS = {
    enabled: true,
    disabledHosts: [],
  };

  const BLOCKED_EVENTS = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu'];
  const SHORTCUT_KEYS = new Set(['a', 'c', 'v', 'x']);

  const STYLE_TEXT = `
* {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  user-select: text !important;
}
input,
textarea,
[contenteditable="true"],
[contenteditable=""] {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  user-select: text !important;
}
`.trim();

  let activated = false;
  let mainWorldRequested = false;

  function normalizeHost(hostname) {
    return String(hostname || '').replace(/^www\./, '');
  }

  function isHostDisabled(hostname, disabledHosts) {
    const bare = normalizeHost(hostname);
    return (disabledHosts || []).some((host) => normalizeHost(host) === bare);
  }

  function shouldEnable(settings) {
    if (!settings?.enabled) {
      return false;
    }
    return !isHostDisabled(location.hostname, settings.disabledHosts);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    const root = document.documentElement || document.head;
    if (root) {
      root.appendChild(style);
    }
  }

  function requestMainWorldUnblock() {
    if (mainWorldRequested) {
      return;
    }
    mainWorldRequested = true;

    chrome.runtime.sendMessage({ type: 'INJECT_MAIN_WORLD' }, () => {
      void chrome.runtime.lastError;
    });
  }

  function enableUnblock() {
    injectStyles();
    requestMainWorldUnblock();

    BLOCKED_EVENTS.forEach((eventName) => {
      window.addEventListener(
        eventName,
        (event) => {
          event.stopImmediatePropagation();
        },
        true
      );
    });

    window.addEventListener(
      'keydown',
      (event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }
        if (SHORTCUT_KEYS.has(event.key.toLowerCase())) {
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  function activate() {
    if (activated) {
      return;
    }
    activated = true;
    enableUnblock();
  }

  function applySettings(settings) {
    if (shouldEnable(settings)) {
      activate();
    }
  }

  chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_SETTINGS }, (result) => {
    applySettings(result[STORAGE_KEY] || DEFAULT_SETTINGS);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    applySettings(changes[STORAGE_KEY].newValue || DEFAULT_SETTINGS);
  });
})();
