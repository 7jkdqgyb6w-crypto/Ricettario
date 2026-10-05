(function () {
  'use strict';
  if (window.RicettarioImageViewer) return;

  var style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/foto/ui/image-viewer.css?v=5';
  document.head.appendChild(style);

  var dialog = document.createElement('dialog');
  dialog.className = 'site-image-viewer';
  dialog.setAttribute('aria-label', 'Fotografia ingrandita');
  dialog.innerHTML = '<div class="site-image-viewer-controls">' +
    '<button type="button" data-image-zoom="in" aria-label="Ingrandisci fotografia">+</button>' +
    '<button type="button" data-image-zoom="out" aria-label="Riduci fotografia">−</button>' +
    '<button type="button" data-image-close aria-label="Chiudi">×</button></div>' +
    '<button type="button" data-image-previous aria-label="Fotografia precedente" title="Fotografia precedente" hidden>‹</button>' +
    '<img alt="" referrerpolicy="no-referrer"><div class="site-image-viewer-caption" hidden></div>';
  dialog.insertAdjacentHTML('beforeend',
    '<button type="button" data-image-next aria-label="Fotografia successiva" title="Fotografia successiva" hidden>›</button>');
  document.body.appendChild(dialog);
  var image = dialog.querySelector('img');
  var caption = dialog.querySelector('.site-image-viewer-caption');
  var zoomIn = dialog.querySelector('[data-image-zoom="in"]');
  var zoomOut = dialog.querySelector('[data-image-zoom="out"]');
  var previousButton = dialog.querySelector('[data-image-previous]');
  var nextButton = dialog.querySelector('[data-image-next]');
  zoomIn.title = 'Ingrandisci fotografia';
  zoomOut.title = 'Riduci fotografia';
  dialog.querySelector('[data-image-close]').title = 'Chiudi';
  var returnFocus = null;
  var albumLinks = [];
  var albumIndex = -1;
  var scale = 1;
  var panX = 0;
  var panY = 0;
  var dragging = false;
  var moved = false;
  var lastX = 0;
  var lastY = 0;
  var pinchDistance = 0;
  var pinchScale = 1;
  var twoFingerGesture = null;
  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  function render() {
    var maxX = Math.max(0, (image.offsetWidth * scale - dialog.clientWidth) / 2);
    var maxY = Math.max(0, (image.offsetHeight * scale - dialog.clientHeight) / 2);
    panX = clamp(panX, -maxX, maxX);
    panY = clamp(panY, -maxY, maxY);
    image.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
    zoomIn.disabled = scale >= 6;
    zoomOut.disabled = scale <= 1;
  }

  function setZoom(next, x, y) {
    x = x == null ? dialog.clientWidth / 2 : x;
    y = y == null ? dialog.clientHeight / 2 : y;
    var previous = scale;
    scale = clamp(next, 1, 6);
    if (scale === 1) panX = panY = 0;
    else {
      panX = (panX + dialog.clientWidth / 2 - x) * scale / previous - (dialog.clientWidth / 2 - x);
      panY = (panY + dialog.clientHeight / 2 - y) * scale / previous - (dialog.clientHeight / 2 - y);
    }
    render();
  }

  function distance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function showSource(source) {
    image.src = source.src;
    image.alt = source.alt || '';
    caption.textContent = source.caption || '';
    caption.hidden = !caption.textContent;
    scale = 1;
    panX = panY = 0;
    moved = false;
    render();
  }

  function open(source, opener) {
    if (!source || !source.src || typeof dialog.showModal !== 'function') return false;
    returnFocus = opener || source;
    var gallery = opener && opener.closest && opener.closest('[data-photo-gallery]');
    albumLinks = gallery && opener.matches('a[data-photo-open]')
      ? Array.prototype.slice.call(gallery.querySelectorAll('a[data-photo-open]')) : [];
    albumIndex = albumLinks.indexOf(opener);
    previousButton.hidden = nextButton.hidden = albumLinks.length < 2;
    showSource(source);
    dialog.showModal();
    document.body.classList.add('site-image-viewer-open');
    render();
    return true;
  }

  function navigateAlbum(step) {
    if (!dialog.open || albumLinks.length < 2) return;
    albumIndex = (albumIndex + step + albumLinks.length) % albumLinks.length;
    showSource(photographicSource(albumLinks[albumIndex]).source);
  }

  function photographicSource(target) {
    var albumLink = target.closest('a[data-photo-open]');
    if (albumLink && albumLink.closest('[data-photo-gallery]')) {
      return {
        source: {src: albumLink.dataset.large, alt: albumLink.dataset.caption || '',
          caption: albumLink.dataset.caption ? albumLink.dataset.caption + ' · Foto di Pierre' : 'Foto di Pierre'},
        opener: albumLink
      };
    }
    var photo = target.closest('img');
    if (!photo || !photo.closest('main')) return null;
    if (photo.closest('.site-footer, .recipe-qrcode-link, .photo-album-hero, .place-map, .ingredient-excellence-recognition')) return null;
    if (photo.closest('a[href]')) return null;
    if (!photo.matches('.js-index-lightbox-image, .index-editorial-card img, .index-editorial-images img, .article-body figure img, .article-hero img, .recipe-content figure img, main figure img')) return null;
    var figure = photo.closest('figure');
    var note = figure && figure.querySelector('figcaption');
    return {
      source: {src: photo.currentSrc || photo.src, alt: photo.alt || '',
        caption: note ? note.textContent.trim() : ''},
      opener: photo
    };
  }

  document.addEventListener('click', function (event) {
    var selected = photographicSource(event.target);
    if (!selected) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(selected.source, selected.opener);
  }, true);
  document.addEventListener('keydown', function (event) {
    if (dialog.open) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var selected = photographicSource(event.target);
    if (!selected) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(selected.source, selected.opener);
  }, true);

  zoomIn.addEventListener('click', function () { setZoom(scale * 1.5); });
  zoomOut.addEventListener('click', function () { setZoom(scale / 1.5); });
  previousButton.addEventListener('click', function () { navigateAlbum(-1); });
  nextButton.addEventListener('click', function () { navigateAlbum(1); });
  dialog.querySelector('[data-image-close]').addEventListener('click', close);
  image.addEventListener('load', render);
  image.addEventListener('wheel', function (event) {
    event.preventDefault();
    setZoom(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
  }, {passive: false});
  image.addEventListener('mousedown', function (event) {
    if (event.button !== 0 || scale <= 1) return;
    event.preventDefault();
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    image.classList.add('is-dragging');
  });
  window.addEventListener('mousemove', function (event) {
    if (!dragging) return;
    var dx = event.clientX - lastX;
    var dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    panX += dx;
    panY += dy;
    lastX = event.clientX;
    lastY = event.clientY;
    render();
  });
  window.addEventListener('mouseup', function () {
    dragging = false;
    image.classList.remove('is-dragging');
  });
  image.addEventListener('click', function (event) {
    if (moved) { moved = false; return; }
    event.stopPropagation();
    close();
  });
  image.addEventListener('touchstart', function (event) {
    if (event.touches.length === 2) {
      pinchDistance = distance(event.touches);
      pinchScale = scale;
      twoFingerGesture = {
        startX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        startY: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        lastX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        lastY: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        pinching: scale > 1
      };
    } else if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  }, {passive: false});
  image.addEventListener('touchmove', function (event) {
    event.preventDefault();
    if (event.touches.length === 2 && pinchDistance) {
      var centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      var centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      var ratio = distance(event.touches) / pinchDistance;
      if (twoFingerGesture) {
        twoFingerGesture.lastX = centerX;
        twoFingerGesture.lastY = centerY;
        if (Math.abs(ratio - 1) > .08) twoFingerGesture.pinching = true;
      }
      if (!twoFingerGesture || twoFingerGesture.pinching) {
        setZoom(pinchScale * ratio, centerX, centerY);
      }
      moved = true;
    } else if (event.touches.length === 1 && scale > 1) {
      panX += event.touches[0].clientX - lastX;
      panY += event.touches[0].clientY - lastY;
      render();
      moved = true;
    }
    if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  }, {passive: false});
  image.addEventListener('touchend', function (event) {
    if (event.touches.length < 2 && twoFingerGesture) {
      var deltaX = twoFingerGesture.lastX - twoFingerGesture.startX;
      var deltaY = twoFingerGesture.lastY - twoFingerGesture.startY;
      if (!twoFingerGesture.pinching && albumLinks.length > 1 && scale === 1 &&
          Math.abs(deltaX) >= 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        navigateAlbum(deltaX < 0 ? 1 : -1);
        moved = true;
      }
      twoFingerGesture = null;
    }
    if (event.touches.length < 2) pinchDistance = 0;
    if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  });
  image.addEventListener('dragstart', function (event) { event.preventDefault(); });
  dialog.addEventListener('keydown', function (event) {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(scale * 1.5); }
    if (event.key === '-') { event.preventDefault(); setZoom(scale / 1.5); }
    if (albumLinks.length > 1 && event.key === 'ArrowLeft') { event.preventDefault(); navigateAlbum(-1); }
    if (albumLinks.length > 1 && event.key === 'ArrowRight') { event.preventDefault(); navigateAlbum(1); }
  });
  dialog.addEventListener('close', function () {
    image.removeAttribute('src');
    albumLinks = [];
    albumIndex = -1;
    previousButton.hidden = nextButton.hidden = true;
    document.body.classList.remove('site-image-viewer-open');
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  });
  window.addEventListener('resize', render);

  window.RicettarioImageViewer = {open: open, close: close};
  document.querySelectorAll('[data-photo-gallery] a[data-photo-open], .article-body figure img, .article-hero img, .recipe-content figure img, .index-editorial-card img, .index-editorial-images img, .js-index-lightbox-image').forEach(function (node) {
    if (node.closest('a[href]') && !node.matches('a[data-photo-open]')) return;
    node.setAttribute('data-site-image-open', '');
    if (node.tagName === 'IMG') node.tabIndex = 0;
  });
})();
