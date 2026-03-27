let currentSlug = null;
let dirty = false;
let ingredientToolbar = null;
let selectedFigure = null;
let savedRange = null;
let resizeState = null;

const recipeList = document.getElementById('recipeList');
const recipeCanvas = document.getElementById('recipeCanvas');
const imageArchive = document.getElementById('imageArchive');
const uploadInput = document.getElementById('uploadInput');
const saveBtn = document.getElementById('saveBtn');
const newRecipeBtn = document.getElementById('newRecipeBtn');
const statusText = document.getElementById('statusText');
const figureEmptyState = document.getElementById('figureEmptyState');
const figureProps = document.getElementById('figureProps');
const figAlt = document.getElementById('figAlt');
const figCaption = document.getElementById('figCaption');
const figWidth = document.getElementById('figWidth');
const figAnchor = document.getElementById('figAnchor');
const figRole = document.getElementById('figRole');
const figMoveUp = document.getElementById('figMoveUp');
const figMoveDown = document.getElementById('figMoveDown');
const figApply = document.getElementById('figApply');
const figRemove = document.getElementById('figRemove');
const overlay = document.getElementById('figureOverlay');
const overlayToggleAnchor = document.getElementById('overlayToggleAnchor');
const overlayMoveUp = document.getElementById('overlayMoveUp');
const overlayMoveDown = document.getElementById('overlayMoveDown');
const centerScroll = document.getElementById('centerScroll');

function setStatus(text) { statusText.textContent = text; }
function markDirty(value = true) { dirty = value; saveBtn.disabled = !dirty || !currentSlug; }

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

function normalizeFigure(figure) {
  figure.classList.add('recipe-figure');
  if (!figure.dataset.role) figure.dataset.role = 'body';
  if (!figure.dataset.anchor) figure.dataset.anchor = figure.dataset.role === 'cover' ? 'block' : 'float';
  const img = figure.querySelector('img');
  const raw = Number(figure.dataset.width || '') || 42;
  const w = Math.max(18, Math.min(95, raw));
  figure.dataset.width = String(w);
  if (figure.dataset.role === 'cover') {
    figure.dataset.anchor = 'block';
    figure.style.cssText = `float:none;display:block;width:${Math.max(w,64)}%;margin:0 auto 1rem;`;
  } else if (figure.dataset.anchor === 'float') {
    figure.style.cssText = `float:right;clear:right;width:${w}%;margin:0.15rem 0 1rem 1rem;`;
  } else {
    figure.style.cssText = `float:none;display:block;width:${w}%;margin:1rem auto;`;
  }
  if (img) img.style.cssText = 'display:block;width:100%;height:auto;';
  if (!figure.querySelector('figcaption')) {
    const caption = document.createElement('figcaption');
    figure.appendChild(caption);
  }
}

function updateOverlayPosition() {
  if (!selectedFigure) {
    overlay.hidden = true;
    return;
  }
  const figRect = selectedFigure.getBoundingClientRect();
  overlay.style.left = `${figRect.left}px`;
  overlay.style.top = `${figRect.top}px`;
  overlay.style.width = `${figRect.width}px`;
  overlay.style.height = `${figRect.height}px`;
  overlay.hidden = false;
  overlayToggleAnchor.textContent = selectedFigure.dataset.anchor === 'float' ? 'Contornata' : 'Blocco';
}

function syncFigurePanel() {
  if (!selectedFigure) {
    figureEmptyState.style.display = '';
    figureProps.classList.add('is-disabled');
    overlay.hidden = true;
    return;
  }
  figureEmptyState.style.display = 'none';
  figureProps.classList.remove('is-disabled');
  const img = selectedFigure.querySelector('img');
  const caption = selectedFigure.querySelector('figcaption');
  figAlt.value = img?.getAttribute('alt') || '';
  figCaption.value = caption?.textContent || '';
  figWidth.value = selectedFigure.dataset.width || '42';
  figAnchor.value = selectedFigure.dataset.anchor || 'float';
  figRole.value = selectedFigure.dataset.role || 'body';
  updateOverlayPosition();
}

function setSelectedFigure(figure) {
  recipeCanvas.querySelectorAll('figure.cms-selected').forEach(f => f.classList.remove('cms-selected'));
  selectedFigure = figure;
  if (figure) {
    figure.classList.add('cms-selected');
    normalizeFigure(figure);
  }
  syncFigurePanel();
}

function applyFigureProperties() {
  if (!selectedFigure) return;
  normalizeFigure(selectedFigure);
  const img = selectedFigure.querySelector('img');
  const caption = selectedFigure.querySelector('figcaption');
  const width = Math.max(18, Math.min(95, Number(figWidth.value || selectedFigure.dataset.width || 42)));
  if (img) img.setAttribute('alt', figAlt.value || '');
  if (caption) caption.textContent = figCaption.value || '';
  selectedFigure.dataset.width = String(width);
  selectedFigure.dataset.anchor = figAnchor.value;
  selectedFigure.dataset.role = figRole.value;
  if (figRole.value === 'cover') selectedFigure.dataset.anchor = 'block';
  if (selectedFigure.dataset.role === 'cover') {
    recipeCanvas.querySelectorAll('figure[data-role="cover"]').forEach(fig => {
      if (fig !== selectedFigure) fig.dataset.role = 'body';
    });
  }
  normalizeFigure(selectedFigure);
  markDirty(true);
  syncFigurePanel();
}

function moveFigure(direction) {
  if (!selectedFigure) return;
  const parent = selectedFigure.parentNode;
  if (!parent) return;
  const items = Array.from(parent.children).filter(el => el.tagName !== 'H2');
  const idx = items.indexOf(selectedFigure);
  const target = items[idx + direction];
  if (!target) return;
  if (direction < 0) parent.insertBefore(selectedFigure, target);
  else parent.insertBefore(selectedFigure, target.nextSibling);
  normalizeFigure(selectedFigure);
  markDirty(true);
  requestAnimationFrame(updateOverlayPosition);
}

function removeFigure() {
  if (!selectedFigure) return;
  const toRemove = selectedFigure;
  setSelectedFigure(null);
  toRemove.remove();
  markDirty(true);
}

function bindSelectionTracking() {
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (recipeCanvas.contains(range.startContainer)) {
      savedRange = range.cloneRange();
    }
  });
}

function decorateEditable(root) {
  root.querySelectorAll('h1, .meta-card span').forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.addEventListener('input', () => markDirty(true));
  });

  root.querySelectorAll('section.lead, section.notes').forEach(section => {
    section.querySelectorAll(':scope > p, :scope > div, :scope > ul, :scope > ol').forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('input', () => markDirty(true));
    });
  });

  root.querySelectorAll('ol.steps li').forEach(li => {
    li.setAttribute('contenteditable', 'true');
    li.addEventListener('input', () => markDirty(true));
  });

  root.querySelectorAll('table.recipe-table tbody td').forEach(td => {
    td.setAttribute('contenteditable', 'true');
    td.addEventListener('input', () => markDirty(true));
    td.addEventListener('focus', () => showIngredientToolbar(td));
  });

  root.querySelectorAll('figure').forEach(fig => {
    normalizeFigure(fig);
    fig.addEventListener('click', e => {
      e.stopPropagation();
      setSelectedFigure(fig);
    });
  });
}

function ensureIngredientToolbar() {
  if (ingredientToolbar) return ingredientToolbar;
  ingredientToolbar = document.createElement('div');
  ingredientToolbar.className = 'cms-ingredient-toolbar';
  ingredientToolbar.innerHTML = `<button type="button" id="addIngredientRowBtn">+ Riga</button><button type="button" id="delIngredientRowBtn">− Riga</button>`;
  document.body.appendChild(ingredientToolbar);
  document.getElementById('addIngredientRowBtn').addEventListener('click', addIngredientRow);
  document.getElementById('delIngredientRowBtn').addEventListener('click', deleteIngredientRow);
  return ingredientToolbar;
}

function showIngredientToolbar(td) {
  const toolbar = ensureIngredientToolbar();
  toolbar.dataset.rowIndex = td.parentElement.rowIndex;
  const rect = td.getBoundingClientRect();
  toolbar.style.display = 'flex';
  toolbar.style.top = `${window.scrollY + rect.top - 34}px`;
  toolbar.style.left = `${window.scrollX + rect.left}px`;
}

function currentIngredientTbody() {
  return recipeCanvas.querySelector('table.recipe-table tbody');
}

function addIngredientRow() {
  const tbody = currentIngredientTbody();
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = '<td></td><td></td><td></td><td></td>';
  tbody.appendChild(tr);
  markDirty(true);
  decorateEditable(recipeCanvas);
}

function deleteIngredientRow() {
  const toolbar = ensureIngredientToolbar();
  const tbody = currentIngredientTbody();
  if (!tbody) return;
  const idx = Number(toolbar.dataset.rowIndex || '-1');
  const rows = tbody.querySelectorAll('tr');
  if (idx >= 0 && rows[idx]) {
    rows[idx].remove();
    if (!tbody.querySelector('tr')) addIngredientRow();
    markDirty(true);
    toolbar.style.display = 'none';
  }
}

recipeCanvas.addEventListener('click', (e) => {
  if (!e.target.closest('figure')) setSelectedFigure(null);
  if (!e.target.closest('td')) { const tb = ensureIngredientToolbar(); tb.style.display = 'none'; }
});

centerScroll.addEventListener('scroll', updateOverlayPosition);
window.addEventListener('resize', updateOverlayPosition);

async function loadRecipes() {
  const slugs = await fetchJson('/api/recipes');
  recipeList.innerHTML = slugs.map(slug => `<div class="cms-recipe-item" data-slug="${slug}">${slug}</div>`).join('');
  recipeList.querySelectorAll('.cms-recipe-item').forEach(el => {
    el.addEventListener('click', () => openRecipe(el.dataset.slug));
  });
}

async function openRecipe(slug) {
  currentSlug = slug;
  recipeList.querySelectorAll('.cms-recipe-item').forEach(el => el.classList.toggle('active', el.dataset.slug === slug));
  const data = await fetchJson(`/api/recipe/${slug}`);
  recipeCanvas.innerHTML = data.html;
  decorateEditable(recipeCanvas);
  setSelectedFigure(null);
  await loadImages(slug);
  markDirty(false);
  setStatus(`Aperta: ${slug}`);
}

async function loadImages(slug) {
  const images = await fetchJson(`/api/images/${slug}`);
  imageArchive.innerHTML = images.map(name => `
    <div class="cms-image-card" data-name="${name}">
      <img src="/foto/${slug}/${name}" alt="${name}">
      <div class="cms-image-name">${name}</div>
    </div>
  `).join('');
  imageArchive.querySelectorAll('.cms-image-card').forEach(card => {
    card.addEventListener('click', () => insertImage(card.dataset.name));
  });
}

function insertImage(name) {
  if (!currentSlug) return;
  let range = savedRange;
  if (!range && window.getSelection().rangeCount) range = window.getSelection().getRangeAt(0).cloneRange();
  if (!range || !recipeCanvas.contains(range.startContainer)) return;
  const fig = document.createElement('figure');
  fig.className = 'recipe-figure';
  fig.dataset.role = 'body';
  fig.dataset.anchor = 'float';
  fig.dataset.width = '42';
  fig.innerHTML = `<img src="../../foto/${currentSlug}/${name}" alt=""><figcaption></figcaption>`;
  range.collapse(true);
  range.insertNode(fig);
  range.setStartAfter(fig);
  range.setEndAfter(fig);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedRange = range.cloneRange();
  decorateEditable(recipeCanvas);
  setSelectedFigure(fig);
  markDirty(true);
}

uploadInput.addEventListener('change', async (e) => {
  if (!currentSlug || !e.target.files.length) return;
  for (const file of Array.from(e.target.files)) {
    const fd = new FormData();
    fd.append('file', file);
    await fetchJson(`/api/upload/${currentSlug}`, { method: 'POST', body: fd });
  }
  await loadImages(currentSlug);
  e.target.value = '';
  setStatus('Immagine importata');
});

figApply.addEventListener('click', applyFigureProperties);
figMoveUp.addEventListener('click', () => moveFigure(-1));
figMoveDown.addEventListener('click', () => moveFigure(1));
figRemove.addEventListener('click', removeFigure);
overlayToggleAnchor.addEventListener('click', () => {
  if (!selectedFigure) return;
  figAnchor.value = selectedFigure.dataset.anchor === 'float' ? 'block' : 'float';
  applyFigureProperties();
});
overlayMoveUp.addEventListener('click', () => moveFigure(-1));
overlayMoveDown.addEventListener('click', () => moveFigure(1));

function startResize(e) {
  if (!selectedFigure) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = selectedFigure.getBoundingClientRect();
  resizeState = {
    startX: e.clientX,
    startWidth: rect.width,
    direction: e.target.dataset.handle || 'se',
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e) {
  if (!resizeState || !selectedFigure) return;
  const isWest = resizeState.direction.includes('w');
  const delta = e.clientX - resizeState.startX;
  let px = resizeState.startWidth + (isWest ? -delta : delta);
  px = Math.max(120, Math.min(recipeCanvas.clientWidth * 0.95, px));
  const pct = Math.round((px / Math.max(1, recipeCanvas.clientWidth)) * 100);
  selectedFigure.dataset.width = String(Math.max(18, Math.min(95, pct)));
  normalizeFigure(selectedFigure);
  figWidth.value = selectedFigure.dataset.width;
  markDirty(true);
  updateOverlayPosition();
}

function stopResize() {
  resizeState = null;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

document.querySelectorAll('.cms-resize-handle').forEach(handle => handle.addEventListener('mousedown', startResize));

saveBtn.addEventListener('click', async () => {
  if (!currentSlug) return;
  setSelectedFigure(null);
  const meta = {};
  recipeCanvas.querySelectorAll('.meta-card').forEach(card => {
    const key = (card.querySelector('strong')?.textContent || '').replace(':', '').trim();
    const value = (card.querySelector('span')?.textContent || '').trim();
    if (key) meta[key] = value;
  });
  const h1 = recipeCanvas.querySelector('h1')?.textContent?.trim() || currentSlug;
  await fetchJson(`/api/recipe/${currentSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: recipeCanvas.innerHTML, h1, meta })
  });
  markDirty(false);
  setStatus('Salvato');
  const openedSlug = currentSlug;
  await openRecipe(openedSlug);
});

bindSelectionTracking();
loadRecipes().then(() => setStatus('Pronto'));

newRecipeBtn.addEventListener('click', async () => {
  const title = window.prompt('Titolo nuova ricetta:', 'Nuova ricetta');
  if (!title) return;
  const slugDefault = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const slug = window.prompt('Slug:', slugDefault || 'nuova-ricetta');
  if (!slug) return;
  const res = await fetchJson('/api/recipe/new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, slug, meta: { Autore: '', Categoria: '', Origine: '', Fonte: '' } }) });
  await loadRecipes();
  await openRecipe(res.slug);
  setStatus(`Creata: ${res.slug}`);
});
