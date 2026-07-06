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

  function injectMainWorldScript() {
    const script = document.createElement('script');
    script.textContent = `(${mainWorldUnblock.toString()})();`;
    const root = document.documentElement || document.head;
    if (!root) {
      return;
    }
    root.appendChild(script);
    script.remove();
  }

  function mainWorldUnblock() {
    const blockedEvents = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu'];
    const shortcutKeys = new Set(['a', 'c', 'v', 'x']);

    if (window.__enableCopyPasteActivated) {
      return;
    }
    window.__enableCopyPasteActivated = true;

    blockedEvents.forEach((eventName) => {
      window.addEventListener(
        eventName,
        (event) => {
          event.stopImmediatePropagation();
        },
        true
      );
      document.addEventListener(
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
        if (shortcutKeys.has(event.key.toLowerCase())) {
          event.stopImmediatePropagation();
        }
      },
      true
    );

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (blockedEvents.includes(type)) {
        return;
      }

      if (type === 'keydown' || type === 'keyup' || type === 'keypress') {
        const wrappedListener = function (event) {
          if ((event.ctrlKey || event.metaKey) && shortcutKeys.has(event.key.toLowerCase())) {
            return undefined;
          }
          return listener.call(this, event);
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    const handlerProperties = [
      'oncopy',
      'oncut',
      'onpaste',
      'onselectstart',
      'oncontextmenu',
      'ondragstart',
    ];

    function clearInlineHandlers(root) {
      if (!root || root.nodeType !== 1) {
        return;
      }

      handlerProperties.forEach((property) => {
        if (root[property]) {
          root[property] = null;
        }
      });

      blockedEvents.forEach((eventName) => {
        root.removeAttribute(`on${eventName}`);
      });

      root.removeAttribute('unselectable');
      if (root.style) {
        root.style.setProperty('-webkit-user-select', 'text', 'important');
        root.style.setProperty('-moz-user-select', 'text', 'important');
        root.style.setProperty('user-select', 'text', 'important');
      }
    }

    function scanTree(root) {
      clearInlineHandlers(root);
      if (!root.querySelectorAll) {
        return;
      }
      root.querySelectorAll('*').forEach(clearInlineHandlers);
    }

    scanTree(document.documentElement);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) {
            return;
          }
          clearInlineHandlers(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('*').forEach(clearInlineHandlers);
          }
        });

        if (mutation.type === 'attributes' && mutation.target.nodeType === 1) {
          clearInlineHandlers(mutation.target);
        }
      });
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'oncopy',
          'oncut',
          'onpaste',
          'onselectstart',
          'oncontextmenu',
          'style',
          'unselectable',
        ],
      });
    }
  }

  function enableUnblock() {
    injectStyles();
    injectMainWorldScript();

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
