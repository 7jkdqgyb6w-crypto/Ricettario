(() => {
  'use strict';
  document.querySelectorAll('[data-photo-print]').forEach(button => button.addEventListener('click', () => window.print()));
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
  const external = dialog.querySelector('[data-photo-external]');
  let current = 0;
  function show(index) {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.dataset.large;
    image.alt = link.dataset.caption;
    caption.textContent = `${current + 1} / ${links.length}${link.dataset.caption ? ' · ' + link.dataset.caption : ''}`;
    external.href = link.dataset.external;
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault();
    show(index);
    dialog.showModal();
  }));
  dialog.querySelector('[data-photo-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-photo-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-photo-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', () => { image.removeAttribute('src'); });
})();
