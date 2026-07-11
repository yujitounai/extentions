chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'INJECT_MAIN_WORLD') {
    return false;
  }

  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;

  if (tabId === undefined) {
    sendResponse({ ok: false });
    return false;
  }

  chrome.scripting
    .executeScript({
      target: { tabId, frameIds: [frameId] },
      world: 'MAIN',
      files: ['main-world.js'],
    })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));

  return true;
});
