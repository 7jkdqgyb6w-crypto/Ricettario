(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || !script.src) return;
  var siteRoot = new URL('../../', script.src);
  var urls = {
    ricette: new URL('indici/ricette.html', siteRoot).href,
    ingredienti: new URL('indici/ingredienti.html', siteRoot).href,
    fonti: new URL('indici/fonti.html', siteRoot).href,
    geografia: new URL('indici/geografia.html', siteRoot).href,
    approfondimenti: new URL('approfondimenti/', siteRoot).href
  };
  var mobileQuery = window.matchMedia('(max-width: 54rem)');

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
    { key: 'approfondimenti', label: 'Approfondimenti', compact: false }
  ];

  function currentPrimaryKey() {
    var current = normalizedPage(location.href);
    for (var i = 0; i < primaryItems.length; i += 1) {
      var item = primaryItems[i];
      if (current === normalizedPage(urls[item.key])) return item.key;
    }
    return '';
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
      if (!overlay || overlay.dataset.globalSearchFallback === 'ready') return;
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
        overlay.querySelector('form').action = urls.ricette;
        document.body.appendChild(overlay);
      }
      wireOverlay();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      var input = overlay.querySelector('input');
      if (input) input.focus();
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
    if (back) back.remove();
    search.remove();
    nav.replaceChildren();
    nav.dataset.globalNav = 'ready';
    nav.setAttribute('aria-label', 'Navigazione principale');
    if (back) nav.appendChild(back);
    primaryItems.forEach(function (item) {
      if (item.key === currentKey) return;
      nav.appendChild(link(item.label, urls[item.key], item.compact ? '' : 'global-nav-wide'));
    });

    var more = document.createElement('div');
    more.className = 'global-nav-more';
    var menuId = 'global-nav-more-menu-' + index;
    more.innerHTML = '<button class="global-nav-more-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="' + menuId + '">Altro</button><div class="global-nav-more-menu" id="' + menuId + '" role="menu" hidden></div>';
    var menu = more.querySelector('.global-nav-more-menu');
    primaryItems.forEach(function (item) {
      if (item.compact || item.key === currentKey) return;
      menu.appendChild(link(item.label, urls[item.key], '', 'menuitem'));
    });
    nav.appendChild(more);
    nav.appendChild(search);
    setupMore(nav, more);
    setupFallbackSearch(search);
  }

  document.querySelectorAll('header.site-header').forEach(setupNavigation);
}());
