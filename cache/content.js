// Content script to track loaded resources
let resourceCount = 0;
let resourceUrls = [];

function getResourceType(url) {
  if (url.endsWith('.css')) {
    return 'CSS';
  } else if (url.endsWith('.js')) {
    return 'JS';
  } else if (url.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
    return 'Image';
  } else {
    return 'Other';
  }
}

function updateResourceCount() {
  chrome.runtime.sendMessage({ type: 'updateResources', count: resourceCount, urls: resourceUrls });
}

// Listen for resource loads
window.addEventListener('load', function() {
  const resources = document.querySelectorAll('link[rel="stylesheet"], script[src], img[src]');
  resourceCount = resources.length;
  resources.forEach(function(resource) {
    const url = resource.href || resource.src;
    const type = getResourceType(url);
    resourceUrls.push(`${type}: ${url}`);
  });
  updateResourceCount();
});
