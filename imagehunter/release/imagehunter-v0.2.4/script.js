function toDecimal(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value.numerator != null && value.denominator != null) {
    return value.denominator === 0 ? null : value.numerator / value.denominator;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const deg = toDecimal(dms[0]);
  const min = toDecimal(dms[1]);
  const sec = toDecimal(dms[2]);
  if (deg == null || min == null || sec == null) return null;

  let decimal = deg + ((min * 60) + sec) / 3600;
  if (ref === 'S' || ref === 'W') decimal *= -1;
  return decimal;
}

function createActionLink(href, id, className, label, iconSrc) {
  const link = document.createElement('a');
  link.href = href;
  link.id = id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = `action-btn ${className}`;
  link.title = label;

  const icon = document.createElement('img');
  icon.src = iconSrc;
  icon.alt = label;
  link.appendChild(icon);
  return link;
}

function createGpsLink(href, id) {
  const link = document.createElement('a');
  link.href = href;
  link.id = id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'action-btn gps';
  link.title = 'Google Maps';
  link.textContent = 'GPS';
  return link;
}

function createCopyButton(imgUrl, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.className = 'action-btn copy';
  button.title = 'URLをコピー';

  const icon = document.createElement('img');
  icon.src = 'link.png';
  icon.alt = 'Copy';
  button.appendChild(icon);

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(imgUrl);
      button.classList.add('copied');
      button.title = 'コピーしました';
      setTimeout(() => {
        button.classList.remove('copied');
        button.title = 'URLをコピー';
      }, 1500);
    } catch {
      button.title = 'コピー失敗';
    }
  });

  return button;
}

function openImageInBrowser(imgUrl, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  chrome.tabs.create({ url: imgUrl });
}

function appendImageCard(container, imgUrl, index) {
  const card = document.createElement('article');
  card.className = 'image-card';

  const thumbLink = document.createElement('a');
  thumbLink.className = 'image-thumb';
  thumbLink.href = imgUrl;
  thumbLink.title = imgUrl;
  thumbLink.addEventListener('click', (event) => openImageInBrowser(imgUrl, event));
  card.appendChild(thumbLink);

  const imgEl = document.createElement('img');
  imgEl.src = imgUrl;
  imgEl.id = `img_${index}`;
  imgEl.title = imgUrl;
  imgEl.alt = 'Image thumbnail';
  thumbLink.appendChild(imgEl);

  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  card.appendChild(overlay);

  const exifInfo = document.createElement('div');
  exifInfo.className = 'exif-info';
  overlay.appendChild(exifInfo);

  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';
  overlay.appendChild(actionRow);

  const encodedUrl = encodeURIComponent(imgUrl);
  actionRow.appendChild(createCopyButton(imgUrl, `Copy_${imgEl.id}`));
  actionRow.appendChild(createActionLink(
    `https://www.google.co.jp/searchbyimage?image_url=${encodedUrl}&site=search&hl=ja`,
    `Google_${imgEl.id}`,
    'google',
    'Google',
    'google.svg',
  ));
  actionRow.appendChild(createActionLink(
    `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIHMP&sbisrc=UrlPaste&q=imgurl:${encodedUrl}`,
    `Bing_${imgEl.id}`,
    'bing',
    'Bing',
    'bing.svg',
  ));
  actionRow.appendChild(createActionLink(
    `https://yandex.com/images/search?rpt=imageview&url=${encodedUrl}`,
    `Yandex_${imgEl.id}`,
    'yandex',
    'Yandex',
    'yandex.svg',
  ));

  container.appendChild(card);

  function applyExif(imgNode) {
    EXIF.getData(imgNode, function onExifLoaded() {
      const tags = EXIF.getAllTags(this);
      if (!tags || Object.keys(tags).length === 0) {
        exifInfo.textContent = 'EXIF なし';
        return;
      }

      const make = EXIF.getTag(this, 'Make');
      const model = EXIF.getTag(this, 'Model');
      if (make || model) {
        exifInfo.textContent = [make, model].filter(Boolean).join(' ');
      }

      const gpsLat = EXIF.getTag(this, 'GPSLatitude');
      const gpsLng = EXIF.getTag(this, 'GPSLongitude');
      if (gpsLat !== undefined && gpsLng !== undefined) {
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const lngRef = EXIF.getTag(this, 'GPSLongitudeRef');
        const latitude = dmsToDecimal(gpsLat, latRef);
        const longitude = dmsToDecimal(gpsLng, lngRef);

        if (latitude != null && longitude != null) {
          actionRow.appendChild(createGpsLink(
            `https://www.google.com/maps?q=${latitude},${longitude}`,
            `GPS_${imgEl.id}`,
          ));
        }
      }
    });
  }

  function handleLoad() {
    const width = imgEl.naturalWidth;
    const height = imgEl.naturalHeight;
    if (width <= 2 && height <= 2) {
      card.remove();
      return;
    }
    applyExif(imgEl);
  }

  imgEl.onload = handleLoad;
  imgEl.onerror = () => {
    exifInfo.textContent = '読み込み不可';
  };

  if (imgEl.complete) {
    if (imgEl.naturalWidth > 0) handleLoad();
    else imgEl.onerror();
  }
}

function showLoadingState(container) {
  container.className = '';
  container.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
        <polyline points="21 3 21 9 15 9"/>
      </svg>
      <p>スキャン中...</p>
    </div>
  `;
}

function renderEmptyState(container) {
  container.className = '';
  container.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <p>画像が見つかりません</p>
      <small>ページを読み込むか、↻ で再スキャンしてください</small>
    </div>
  `;
}

function renderImages(tabData) {
  const container = document.getElementById('imgs');
  const siteInfo = document.getElementById('siteInfo');
  const captionCount = document.getElementById('captionCount');
  container.innerHTML = '';

  const imgs = (tabData.imgs || []).filter((url) => url.startsWith('http://') || url.startsWith('https://'));

  if (siteInfo) {
    const url = tabData.siteUrl || '';
    try {
      siteInfo.textContent = url ? new URL(url).hostname : 'スキャン待ち';
    } catch {
      siteInfo.textContent = url || 'スキャン待ち';
    }
    siteInfo.title = url;
  }

  if (captionCount) {
    captionCount.textContent = imgs.length > 0 ? String(imgs.length) : '';
  }

  if (imgs.length === 0) {
    renderEmptyState(container);
    return;
  }

  container.className = 'grid';
  imgs.forEach((imgUrl, index) => {
    appendImageCard(container, imgUrl, index);
  });
}

function loadImagesForActiveTab(options = {}) {
  const { autoScan = true } = options;
  const container = document.getElementById('imgs');
  if (container) showLoadingState(container);

  chrome.runtime.sendMessage({ type: autoScan ? 'GET_OR_SCAN' : 'GET_TAB_IMAGES' }, (response) => {
    if (chrome.runtime.lastError) return;
    renderImages(response || { imgs: [], siteUrl: '' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadImagesForActiveTab({ autoScan: true });

  const reloadButton = document.getElementById('reload');
  reloadButton?.addEventListener('click', () => {
    reloadButton.disabled = true;
    chrome.runtime.sendMessage({ type: 'RESCAN' }, (response) => {
      reloadButton.disabled = false;
      if (response?.data) {
        renderImages(response.data);
      } else {
        loadImagesForActiveTab({ autoScan: false });
      }
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) return;
      const key = `tabImages_${tabId}`;
      if (changes[key]) {
        renderImages(changes[key].newValue || { imgs: [], siteUrl: '' });
      }
    });
  });
});
