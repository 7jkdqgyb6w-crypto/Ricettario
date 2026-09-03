(() => {
  'use strict';
  document.querySelectorAll('[data-photo-print]').forEach(button => button.addEventListener('click', () => window.print()));
  const form = document.querySelector('[data-photo-filters]');
  if (!form) return;
  const rows = [...document.querySelectorAll('[data-photo-album]')];
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').trim();
  function filter() {
    const query = normalize(form.elements.q.value);
    const decade = form.elements.decade.value;
    const place = form.elements.place.value;
    let count = 0;
    rows.forEach(row => {
      const match = (!query || row.dataset.title.includes(query)) && (!decade || row.dataset.decade === decade) && (!place || row.dataset.places.split(' ').includes(place));
      row.hidden = !match;
      if (match) count++;
    });
    document.querySelector('[data-photo-result]').textContent = `${count} ${count === 1 ? 'raccolta' : 'raccolte'} su ${rows.length} · ordine alfabetico`;
    document.querySelector('[data-photo-empty]').hidden = count !== 0;
  }
  form.hidden = false;
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('reset', () => setTimeout(filter, 0));
})();
