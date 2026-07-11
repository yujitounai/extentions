(function () {
  if (window.__enableCopyPasteActivated) {
    return;
  }
  window.__enableCopyPasteActivated = true;

  const blockedEvents = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu'];
  const shortcutKeys = new Set(['a', 'c', 'v', 'x']);

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
    if (!root) {
      return;
    }
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
})();
