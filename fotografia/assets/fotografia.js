(() => {
  'use strict';
  document.querySelectorAll('[data-photo-print]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    window.print();
  }));
  document.querySelectorAll('[data-photo-copy]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    const originalTitle = button.title;
    try {
      await navigator.clipboard.writeText(window.location.href);
      button.title = 'Link copiato';
    } catch (_error) {
      window.prompt('Copia il link della pagina:', window.location.href);
    }
    window.setTimeout(() => { button.title = originalTitle; }, 1800);
  }));
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').trim();
  const form = document.querySelector('[data-photo-filters]');
  if (form) {
    const list = document.querySelector('.photo-catalog .photo-album-list');
    const rows = [...document.querySelectorAll('[data-photo-album]')];
    const result = document.querySelector('[data-photo-result]');
    const empty = document.querySelector('[data-photo-empty]');
    const orderLabels = {time: 'dal più recente', place: 'per luogo', title: 'per titolo'};
    function compareRows(left, right, order) {
      if (order === 'time') {
        const delta = Number(right.dataset.year) - Number(left.dataset.year);
        if (delta) return delta;
      }
      if (order === 'place') {
        const delta = left.dataset.placeLabel.localeCompare(right.dataset.placeLabel, 'it');
        if (delta) return delta;
      }
      return left.dataset.title.localeCompare(right.dataset.title, 'it');
    }
    function update() {
      const query = normalize(form.elements.q.value);
      const decade = form.elements.decade.value;
      const place = form.elements.place.value;
      const order = form.elements.order.value || 'time';
      rows.sort((left, right) => compareRows(left, right, order)).forEach(row => list.append(row));
      let count = 0;
      rows.forEach(row => {
        const match = (!query || row.dataset.title.includes(query)) && (!decade || row.dataset.decade === decade) && (!place || row.dataset.places.split(' ').includes(place));
        row.hidden = !match;
        if (match) count++;
      });
      result.textContent = `${count} ${count === 1 ? 'raccolta' : 'raccolte'} su ${rows.length} · ${orderLabels[order]}`;
      empty.hidden = count !== 0;
      const url = new URL(location.href);
      for (const name of ['q', 'decade', 'place', 'order']) {
        const value = form.elements[name].value;
        if (value && !(name === 'order' && value === 'time')) url.searchParams.set(name, value);
        else url.searchParams.delete(name);
      }
      history.replaceState(null, '', url);
    }
    const initial = new URLSearchParams(location.search);
    for (const name of ['q', 'decade', 'place', 'order']) {
      const control = form.elements[name];
      if (!initial.has(name)) continue;
      if (control.tagName !== 'SELECT' || [...control.options].some(option => option.value === initial.get(name))) control.value = initial.get(name);
    }
    form.hidden = false;
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', event => { event.preventDefault(); update(); });
    form.addEventListener('reset', () => setTimeout(update, 0));
    update();
  }

  const gallery = document.querySelector('[data-photo-gallery]');
  const dialog = document.querySelector('[data-photo-lightbox]');
  if (!gallery || !dialog || typeof dialog.showModal !== 'function') return;
  const links = [...gallery.querySelectorAll('[data-photo-open]')];
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('[data-photo-caption]');
  const closeButton = dialog.querySelector('[data-photo-close]');
  const previousButton = dialog.querySelector('[data-photo-prev]');
  const nextButton = dialog.querySelector('[data-photo-next]');
  closeButton.title = 'Chiudi';
  previousButton.title = 'Fotografia precedente';
  nextButton.title = 'Fotografia successiva';
  const bar = dialog.querySelector('.photo-lightbox-bar');
  const zoomIn = document.createElement('button');
  const zoomOut = document.createElement('button');
  zoomIn.type = zoomOut.type = 'button';
  zoomIn.className = 'photo-lightbox-zoom';
  zoomOut.className = 'photo-lightbox-zoom';
  zoomIn.textContent = '+';
  zoomOut.textContent = '−';
  zoomIn.setAttribute('aria-label', 'Ingrandisci fotografia');
  zoomOut.setAttribute('aria-label', 'Riduci fotografia');
  zoomIn.title = 'Ingrandisci fotografia';
  zoomOut.title = 'Riduci fotografia';
  bar.insertBefore(zoomIn, closeButton);
  bar.insertBefore(zoomOut, closeButton);
  let current = 0;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let pinchDistance = 0;
  let pinchScale = 1;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function renderZoom() {
    const maxX = Math.max(0, (image.offsetWidth * scale - dialog.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - dialog.clientHeight) / 2);
    panX = clamp(panX, -maxX, maxX);
    panY = clamp(panY, -maxY, maxY);
    image.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    image.classList.toggle('is-zoomed', scale > 1);
    zoomOut.disabled = scale <= 1;
    zoomIn.disabled = scale >= 6;
  }
  function setZoom(next, x = dialog.clientWidth / 2, y = dialog.clientHeight / 2) {
    const old = scale;
    scale = clamp(next, 1, 6);
    if (scale === 1) panX = panY = 0;
    else {
      panX = (panX + dialog.clientWidth / 2 - x) * scale / old - (dialog.clientWidth / 2 - x);
      panY = (panY + dialog.clientHeight / 2 - y) * scale / old - (dialog.clientHeight / 2 - y);
    }
    renderZoom();
  }
  function touchDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX,
                      touches[0].clientY - touches[1].clientY);
  }
  function show(index) {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.dataset.large;
    image.alt = link.dataset.caption;
    caption.textContent = `${current + 1} / ${links.length}${link.dataset.caption ? ' · ' + link.dataset.caption : ''}`;
    scale = 1;
    panX = panY = 0;
    renderZoom();
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault();
    show(index);
    dialog.showModal();
    document.body.classList.add('photo-lightbox-open');
  }));
  closeButton.addEventListener('click', () => dialog.close());
  previousButton.addEventListener('click', () => show(current - 1));
  nextButton.addEventListener('click', () => show(current + 1));
  zoomIn.addEventListener('click', () => setZoom(scale * 1.5));
  zoomOut.addEventListener('click', () => setZoom(scale / 1.5));
  image.addEventListener('load', renderZoom);
  image.addEventListener('mousedown', event => {
    if (event.button !== 0 || scale <= 1) return;
    event.preventDefault();
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    image.classList.add('is-dragging');
  });
  window.addEventListener('mousemove', event => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    panX += dx;
    panY += dy;
    lastX = event.clientX;
    lastY = event.clientY;
    renderZoom();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    image.classList.remove('is-dragging');
  });
  image.addEventListener('click', event => {
    if (moved) { moved = false; return; }
    if (scale === 1) setZoom(2, event.clientX, event.clientY);
  });
  image.addEventListener('touchstart', event => {
    if (event.touches.length === 2) {
      pinchDistance = touchDistance(event.touches);
      pinchScale = scale;
    } else if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  }, {passive: false});
  image.addEventListener('touchmove', event => {
    event.preventDefault();
    if (event.touches.length === 2 && pinchDistance) {
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      setZoom(pinchScale * touchDistance(event.touches) / pinchDistance, centerX, centerY);
    } else if (event.touches.length === 1 && scale > 1) {
      panX += event.touches[0].clientX - lastX;
      panY += event.touches[0].clientY - lastY;
      renderZoom();
    }
    if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  }, {passive: false});
  image.addEventListener('touchend', event => {
    if (event.touches.length < 2) pinchDistance = 0;
    if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  });
  image.addEventListener('dragstart', event => event.preventDefault());
  dialog.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(scale * 1.5); }
    if (event.key === '-') { event.preventDefault(); setZoom(scale / 1.5); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  });
  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    document.body.classList.remove('photo-lightbox-open');
    links[current].focus();
  });
  window.addEventListener('resize', renderZoom);
})();
