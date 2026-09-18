(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || !script.src) return;
  var siteRoot = new URL('../../', script.src);
  var urls = {
    ricette: new URL('indici/ricette.html', siteRoot).href,
    ingredienti: new URL('indici/ingredienti.html', siteRoot).href,
    fonti: new URL('indici/fonti.html', siteRoot).href,
    geografia: new URL('geografia/', siteRoot).href,
    approfondimenti: new URL('approfondimenti/', siteRoot).href,
    fotografia: new URL('fotografia/', siteRoot).href,
    cerca: new URL('cerca/', siteRoot).href
  };
  var mobileQuery = window.matchMedia('(max-width: 54rem)');

  function shuffledCopy(items, chooseIndex) {
    var shuffled = items.slice();
    for (var index = shuffled.length - 1; index > 0; index -= 1) {
      var selected = chooseIndex(index + 1);
      if (!Number.isInteger(selected) || selected < 0 || selected > index) {
        throw new RangeError('Indice di permutazione non valido');
      }
      var swap = shuffled[index];
      shuffled[index] = shuffled[selected];
      shuffled[selected] = swap;
    }
    return shuffled;
  }

  function cryptoIndex(upperExclusive) {
    var range = 0x100000000;
    var ceiling = Math.floor(range / upperExclusive) * upperExclusive;
    var values = new Uint32Array(1);
    var value;
    do {
      window.crypto.getRandomValues(values);
      value = values[0];
    } while (value >= ceiling);
    return value % upperExclusive;
  }

  function initializeGroupedSequence(sequence, chooseIndex, classes) {
    if (!sequence || sequence.dataset.presentationReady === 'true') return false;

    var groups = Array.prototype.filter.call(sequence.children, function (node) {
      return node.classList.contains(classes.group);
    });
    var actions = Array.prototype.filter.call(sequence.children, function (node) {
      return node.classList.contains(classes.actions);
    });
    var groupSizes = [];
    var items = [];
    groups.forEach(function (group) {
      var groupItems = Array.prototype.filter.call(group.children, function (node) {
        return node.classList.contains(classes.item);
      });
      groupSizes.push(groupItems.length);
      items = items.concat(groupItems);
    });
    if (!groups.length) {
      items = Array.prototype.filter.call(sequence.children, function (node) {
        return node.classList.contains(classes.item);
      });
    }

    var shuffled = shuffledCopy(items, chooseIndex);
    var offset = 0;
    if (groups.length) {
      groups.forEach(function (group, index) {
        shuffled.slice(offset, offset + groupSizes[index]).forEach(function (item) {
          group.appendChild(item);
        });
        offset += groupSizes[index];
        group.hidden = index !== 0;
      });
    } else {
      shuffled.forEach(function (item) { sequence.appendChild(item); });
    }
    actions.forEach(function (action, index) {
      action.hidden = index !== 0;
    });
    sequence.dataset.presentationReady = 'true';
    return true;
  }

  function initializeStorySequence(sequence, chooseIndex) {
    return initializeGroupedSequence(sequence, chooseIndex, {
      group: 'story-continue-group', actions: 'story-actions', item: 'story-item'
    });
  }

  function initializePlaceCorpusSequence(sequence, chooseIndex) {
    return initializeGroupedSequence(sequence, chooseIndex, {
      group: 'place-corpus-group', actions: 'place-corpus-actions', item: 'place-content-card'
    });
  }

  function initializePhotoRelatedSequence(sequence, chooseIndex) {
    return initializeGroupedSequence(sequence, chooseIndex, {
      group: 'photo-related-group', actions: 'photo-related-actions', item: 'photo-related-item'
    });
  }

  function initializePlaceImages(nodes, chooseIndex) {
    var used = new Set();
    Array.prototype.forEach.call(nodes, function (node) {
      if (!node || node.dataset.presentationReady === 'true') return;
      var candidates;
      try { candidates = JSON.parse(node.dataset.imageCandidates || '[]'); }
      catch (error) { candidates = []; }
      candidates = candidates.filter(function (candidate) { return candidate && !used.has(candidate); });
      var image = node.querySelector('img');
      if (image && candidates.length) {
        var selected = candidates[chooseIndex(candidates.length)];
        image.setAttribute('src', selected);
        used.add(selected);
      }
      node.dataset.presentationReady = 'true';
    });
  }

  function setupVariablePresentations() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return;
    document.querySelectorAll('.transversal-continuation .story-sequence').forEach(function (sequence) {
      initializeStorySequence(sequence, cryptoIndex);
    });
    document.querySelectorAll('.place-corpus-fotografie .place-corpus-sequence, .place-corpus-ricette .place-corpus-sequence').forEach(function (sequence) {
      initializePlaceCorpusSequence(sequence, cryptoIndex);
    });
    document.querySelectorAll('.photo-related-albums .photo-related-sequence').forEach(function (sequence) {
      initializePhotoRelatedSequence(sequence, cryptoIndex);
    });
    initializePlaceImages(document.querySelectorAll('.story-place[data-image-candidates]'), cryptoIndex);
  }

  window.RicettarioTransversalPresentation = Object.freeze({
    initializeSequence: initializeStorySequence,
    initializePlaceCorpusSequence: initializePlaceCorpusSequence,
    initializePhotoRelatedSequence: initializePhotoRelatedSequence,
    initializePlaceImages: initializePlaceImages,
    shuffledCopy: shuffledCopy
  });

  function normalizedPage(url) {
    return new URL(url, location.href).href
      .replace(/index\.html(?=([?#]|$))/i, '')
      .replace(/[?#].*$/, '');
  }

  var primaryItems = [
    { key: 'ricette', label: 'Ricette', compact: true },
    { key: 'ingredienti', label: 'Ingredienti', compact: false },
    { key: 'fonti', label: 'Fonti', compact: false },
    { key: 'geografia', label: 'Geografia', compact: true },
    { key: 'approfondimenti', label: 'Approfondimenti', compact: false },
    { key: 'fotografia', label: 'Fotografia', compact: false }
  ];

  function currentPrimaryKey() {
    var current = normalizedPage(location.href);
    var path = new URL(current).pathname;
    if (path.indexOf('/geografia/') === 0) return 'geografia';
    if (path.indexOf('/ricette/') === 0 || path.indexOf('/indici/ricette.html') !== -1) return 'ricette';
    if (path.indexOf('/fotografia/') === 0) return 'fotografia';
    if (path.indexOf('/approfondimenti/') === 0) return 'approfondimenti';
    for (var i = 0; i < primaryItems.length; i += 1) {
      var item = primaryItems[i];
      if (current === normalizedPage(urls[item.key])) return item.key;
    }
    return '';
  }

  function omitFromNavigation(item) {
    var active = currentPrimaryKey();
    if (item.key === 'ingredienti' || item.key === 'fonti') return active !== 'ricette';
    return item.key === active;
  }

  function iconButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-search-button js-global-search-open';
    button.setAttribute('aria-label', 'Cerca nel ricettario');
    button.setAttribute('title', 'Cerca nel ricettario');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>';
    return button;
  }

  function link(label, href, className, role) {
    var anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = label;
    if (className) anchor.className = className;
    if (role) anchor.setAttribute('role', role);
    if (normalizedPage(location.href) === normalizedPage(href)) {
      anchor.setAttribute('aria-current', 'page');
    }
    return anchor;
  }

  function closeMore(nav, restoreFocus) {
    var button = nav.querySelector('.global-nav-more-toggle');
    var menu = nav.querySelector('.global-nav-more-menu');
    if (!button || !menu || menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }

  function setupMore(nav, wrap) {
    var button = wrap.querySelector('.global-nav-more-toggle');
    var menu = wrap.querySelector('.global-nav-more-menu');
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') === 'true';
      menu.hidden = open;
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('[role="menuitem"]');
        if (first) first.focus();
      }
    });
    nav.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMore(nav, true);
      }
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) closeMore(nav, false);
    });
    var onBreakpoint = function () { if (!mobileQuery.matches) closeMore(nav, false); };
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onBreakpoint);
    else mobileQuery.addListener(onBreakpoint);
  }

  function setupFallbackSearch(button) {
    // Riusa il pannello editoriale quando esiste e crea quello globale solo
    // nelle pagine che ne sono prive. In questo modo la lente resta operativa
    // anche se uno script specifico della pagina non viene inizializzato.
    var overlay = document.getElementById('recipeSearchOverlay');
    var lastTrigger = button;
    var triggers = Array.prototype.slice.call(document.querySelectorAll('.js-global-search-open'));
    if (triggers.indexOf(button) === -1) triggers.push(button);
    var sourceIcon = button.querySelector('svg');
    var liveItems = null;
    var liveInput = null;
    var liveOutput = null;
    var kindLabels = { ricette: 'Ricetta', fotografie: 'Album fotografico', approfondimenti: 'Approfondimento', geografia: 'Luogo' };
    function normalizeSearch(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').replace(/\s+/g, ' ').trim();
    }
    function renderLiveSearch() {
      if (!liveInput || !liveOutput) return;
      var query = normalizeSearch(liveInput.value);
      liveOutput.replaceChildren();
      liveOutput.hidden = !query;
      if (!query) return;
      if (!liveItems) {
        liveOutput.textContent = 'Caricamento risultati…';
        return;
      }
      var words = query.split(' ').filter(Boolean);
      var found = liveItems.filter(function (item) {
        var haystack = normalizeSearch((item.title || '') + ' ' + (item.text || ''));
        return words.every(function (word) { return haystack.indexOf(word) !== -1; });
      });
      var status = document.createElement('p');
      status.className = 'global-nav-search-live-status';
      status.textContent = found.length + (found.length === 1 ? ' risultato' : ' risultati');
      liveOutput.appendChild(status);
      found.slice(0, 8).forEach(function (item) {
        var link = document.createElement('a');
        link.className = 'global-nav-search-live-result';
        link.href = item.url;
        var label = document.createElement('small');
        label.textContent = kindLabels[item.kind] || item.kind || '';
        var title = document.createElement('strong');
        title.textContent = item.title || '';
        link.appendChild(label);
        link.appendChild(title);
        liveOutput.appendChild(link);
      });
    }
    function prepareLiveSearch(form) {
      if (!form) return;
      liveInput = form.querySelector('input[type="search"]');
      if (!liveInput) return;
      liveOutput = form.querySelector('.global-nav-search-live');
      if (!liveOutput) {
        liveOutput = document.createElement('div');
        liveOutput.className = 'global-nav-search-live';
        liveOutput.hidden = true;
        liveOutput.setAttribute('aria-live', 'polite');
        form.appendChild(liveOutput);
      }
      if (liveInput.dataset.globalLiveSearch !== 'ready') {
        liveInput.dataset.globalLiveSearch = 'ready';
        liveInput.addEventListener('input', renderLiveSearch);
        fetch(new URL('assets/search-data.json', siteRoot).href, { cache: 'no-store' })
          .then(function (response) { return response.ok ? response.json() : []; })
          .then(function (items) {
            liveItems = Array.isArray(items) ? items : [];
            renderLiveSearch();
          })
          .catch(function () {
            liveItems = [];
            renderLiveSearch();
          });
      }
    }
    triggers.forEach(function (trigger) {
      if (trigger === button || !sourceIcon || trigger.querySelector('svg')) return;
      var clonedIcon = sourceIcon.cloneNode(true);
      clonedIcon.setAttribute('class', 'home-term-search-icon');
      trigger.appendChild(clonedIcon);
    });
    function close() {
      if (!overlay) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      lastTrigger.focus();
    }
    function wireOverlay() {
      if (!overlay) return;
      var form = overlay.querySelector('form');
      if (form) {
        form.action = urls.cerca;
        prepareLiveSearch(form);
        var hint = overlay.querySelector('.recipe-search-hint');
        if (hint) hint.textContent = 'La ricerca interroga tutti gli archivi; potrai restringere i risultati nella pagina successiva.';
      }
      if (overlay.dataset.globalSearchFallback === 'ready') return;
      overlay.dataset.globalSearchFallback = 'ready';
      overlay.querySelectorAll('.js-site-search-close, .js-recipe-search-close, .global-nav-search-backdrop, .global-nav-search-close').forEach(function (control) {
        control.addEventListener('click', close);
      });
      overlay.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
      });
    }
    function open(event) {
      if (event) event.preventDefault();
      lastTrigger = event && event.currentTarget ? event.currentTarget : button;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'global-nav-search-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = '<div class="global-nav-search-backdrop"></div><section class="global-nav-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title"><button class="global-nav-search-close" type="button" aria-label="Chiudi ricerca">×</button><h2 id="global-search-title">Cerca nel ricettario</h2><form method="get"><label for="global-search-input">Parole da cercare</label><input class="global-nav-search-input" id="global-search-input" name="q" type="search" autocomplete="off"><button class="global-nav-search-submit" type="submit">Cerca</button></form></section>';
        overlay.querySelector('form').action = urls.cerca;
        document.body.appendChild(overlay);
      }
      wireOverlay();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      var input = overlay.querySelector('input');
      if (input) {
        input.value = '';
        renderLiveSearch();
        input.focus();
      }
    }
    wireOverlay();
    triggers.forEach(function (trigger) { trigger.addEventListener('click', open); });
  }

  function setupNavigation(header, index) {
    var nav = header.querySelector('nav');
    if (!nav || nav.dataset.globalNav === 'ready') return;
    var back = nav.querySelector('.recipe-nav-back, .index-nav-back');
    var search = nav.querySelector('.site-search-button') || iconButton();
    var currentKey = currentPrimaryKey();
    if (back) {
      // Le pagine storiche possono avere già un listener inline sul Back.
      // Clonandolo eliminiamo i listener precedenti e garantiamo un solo passo indietro.
      var cleanBack = back.cloneNode(true);
      back.remove();
      back = cleanBack;
    }
    search.remove();
    nav.replaceChildren();
    nav.dataset.globalNav = 'ready';
    nav.setAttribute('aria-label', 'Navigazione principale');
    if (back) {
      back.setAttribute('href', '#');
      back.removeAttribute('onclick');
      back.dataset.globalBack = 'ready';
      back.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (history.length > 1) history.back();
        else location.href = siteRoot.href;
      }, true);
      nav.appendChild(back);
    }
    primaryItems.forEach(function (item) {
      if (item.key === currentKey || omitFromNavigation(item)) return;
      nav.appendChild(link(item.label, urls[item.key], item.compact ? '' : 'global-nav-wide'));
    });

    var more = document.createElement('div');
    more.className = 'global-nav-more';
    var menuId = 'global-nav-more-menu-' + index;
    more.innerHTML = '<button class="global-nav-more-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="' + menuId + '">Altro</button><div class="global-nav-more-menu" id="' + menuId + '" role="menu" hidden></div>';
    var menu = more.querySelector('.global-nav-more-menu');
    primaryItems.forEach(function (item) {
      if (item.compact || item.key === currentKey || omitFromNavigation(item)) return;
      menu.appendChild(link(item.label, urls[item.key], '', 'menuitem'));
    });
    nav.appendChild(more);
    nav.appendChild(search);
    setupMore(nav, more);
    setupFallbackSearch(search);
  }

  setupVariablePresentations();
  document.querySelectorAll('header.site-header').forEach(setupNavigation);
}());
