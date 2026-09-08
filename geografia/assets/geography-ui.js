(function () {
  "use strict";

  var geographyContent = document.querySelector(".geography-page .index-content");
  var geographyIntro = geographyContent && geographyContent.querySelector(".page-intro");
  if (geographyIntro && !geographyContent.querySelector(".geography-hero")) {
    var geographyMeta = geographyIntro.nextElementSibling;
    var geographyDescription = null;
    if (geographyMeta && geographyMeta.classList.contains("archive-meta-grid")) {
      var geographyLabel = geographyMeta.querySelector("strong");
      var geographyValue = geographyMeta.querySelector(".archive-meta-item span");
      var geographyText = geographyValue ? geographyValue.textContent.trim() : "";
      if (geographyLabel && geographyLabel.textContent.trim() === "Tipo") {
        if (geographyText.length > 90 || (geographyText.match(/\./g) || []).length >= 2) {
          geographyDescription = document.createElement("section");
          geographyDescription.className = "geography-description lead archive-intro";
          geographyDescription.innerHTML = "<h2>Descrizione</h2><p></p>";
          geographyDescription.querySelector("p").innerHTML = geographyValue.innerHTML;
          geographyMeta.remove();
          geographyMeta = null;
        } else {
          geographyLabel.textContent = "Classificazione";
        }
      }
    }

    var geographyNote = geographyContent.querySelector(".geography-editorial-note");
    var heroSource = geographyNote && geographyNote.querySelector(".geography-editorial-image img");
    var promotedFigure = heroSource && heroSource.closest("figure");
    if (!heroSource) {
      var photographyHeading = [].slice.call(geographyContent.querySelectorAll("h3")).find(function (heading) {
        return heading.textContent.indexOf("Fotografie") !== -1;
      });
      var photographyList = photographyHeading && photographyHeading.nextElementSibling;
      heroSource = photographyList && photographyList.querySelector("img");
    }

    var insertionAnchor = geographyMeta || geographyIntro;
    if (heroSource) {
      var hero = document.createElement("figure");
      hero.className = "geography-hero";
      var heroImage = heroSource.cloneNode(false);
      heroImage.src = heroImage.src.replace(/=w\d+-h\d+-no$/, "=w1800-h1200-no");
      heroImage.alt = (geographyIntro.querySelector("h1") || {}).textContent || "";
      heroImage.loading = "eager";
      heroImage.decoding = "async";
      hero.appendChild(heroImage);
      insertionAnchor.after(hero);
      insertionAnchor = hero;
      if (promotedFigure) {
        var imageGroup = promotedFigure.parentElement;
        promotedFigure.remove();
        if (imageGroup && !imageGroup.querySelector("figure")) imageGroup.remove();
      }
    }
    if (geographyDescription) insertionAnchor.after(geographyDescription);

    if (geographyNote) {
      var hierarchy = [].slice.call(geographyContent.querySelectorAll("section")).find(function (section) {
        var heading = section.firstElementChild;
        return heading && heading.tagName === "H2" && heading.textContent.trim() === "Gerarchie e appartenenze";
      });
      if (hierarchy) hierarchy.before(geographyNote);
    }
  }

  document.querySelector("[data-prototype-print]")?.addEventListener("click", function (event) {
    event.preventDefault();
    window.print();
  });
  document.querySelector("[data-prototype-copy]")?.addEventListener("click", async function (event) {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (_error) {
      window.prompt("Copia il link della pagina:", window.location.href);
    }
  });

  var placeInput = document.querySelector("[data-place-search]");
  if (placeInput) {
    var placeRows = [].slice.call(document.querySelectorAll("[data-place]"));
    var empty = document.querySelector("[data-place-empty]");
    placeInput.addEventListener("input", function () {
      var query = placeInput.value.trim().toLocaleLowerCase("it");
      var shown = 0;
      placeRows.forEach(function (row) {
        row.hidden = Boolean(query) && row.dataset.place.indexOf(query) === -1;
        if (!row.hidden) shown += 1;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  }

  var form = document.querySelector("[data-global-search]");
  if (!form) return;
  var results = document.querySelector("[data-search-results]");
  var status = document.querySelector("[data-search-status]");
  var filters = document.querySelector("[data-search-filters]");
  var items = [];
  var kind = "";

  function norm(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it");
  }

  function readStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    form.elements.q.value = params.get("q") || "";
    kind = params.get("corpus") || "";
    filters.querySelectorAll("button").forEach(function (button) {
      button.classList.toggle("active", (button.dataset.kind || "") === kind);
    });
  }

  function writeStateToUrl() {
    var params = new URLSearchParams();
    var query = form.elements.q.value.trim();
    if (query) params.set("q", query);
    if (kind) params.set("corpus", kind);
    var next = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.pushState({ q: query, corpus: kind }, "", next);
  }

  function resultLink(item) {
    var link = document.createElement("a");
    link.className = "search-result";
    link.href = item.url;
    var title = document.createElement("strong"); title.textContent = item.title; link.appendChild(title); if (item.summary) { var summary = document.createElement("span"); summary.className = "editorial-summary"; summary.textContent = item.summary; link.appendChild(summary); } return link;
  }

  function render() {
    var query = norm(form.elements.q.value).trim();
    var words = query.split(/\s+/).filter(Boolean);
    var found = items.filter(function (item) {
      var haystack = norm(item.title + " " + item.text);
      return (!kind || item.kind === kind) && words.every(function (word) {
        return haystack.indexOf(word) !== -1;
      });
    });
    status.textContent = query ? found.length + (found.length === 1 ? " risultato" : " risultati") : "Inserire una o più parole.";
    results.replaceChildren();
    if (!query) return;
    var groups = { ricette: "Ricette", fotografie: "Fotografie", approfondimenti: "Approfondimenti", geografia: "Geografia" };
    Object.keys(groups).forEach(function (groupKind) {
      var rows = found.filter(function (item) { return item.kind === groupKind; });
      if (!rows.length) return;
      var section = document.createElement("section");
      section.className = "search-group";
      var heading = document.createElement("h2");
      heading.textContent = groups[groupKind] + " ";
      var count = document.createElement("span");
      count.className = "count";
      count.textContent = rows.length;
      heading.appendChild(count);
      section.appendChild(heading);
      rows.forEach(function (item) { section.appendChild(resultLink(item)); });
      results.appendChild(section);
    });
  }

  fetch("../assets/search-data.json")
    .then(function (response) { return response.json(); })
    .then(function (data) {
      items = data;
      filters.hidden = false;
      readStateFromUrl();
      if (form.elements.q.value) render();
    });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    writeStateToUrl();
    render();
  });
  filters.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    kind = button.dataset.kind || "";
    filters.querySelectorAll("button").forEach(function (candidate) {
      candidate.classList.toggle("active", candidate === button);
    });
    writeStateToUrl();
    render();
  });
  window.addEventListener("popstate", function () {
    readStateFromUrl();
    render();
  });
}());


(function () {
  var form = document.querySelector('[data-photo-controls]');
  var list = document.querySelector('[data-photo-list]');
  if (!form || !list) return;
  var cards = Array.from(list.querySelectorAll('.content-card'));
  var count = form.querySelector('[data-photo-count]');
  function render(writeUrl) {
    var country = form.elements.country.value;
    var order = form.elements.order.value;
    var decade = form.elements.decade ? form.elements.decade.value : '';
    var visible = cards.filter(function (card) {
      var countries = (card.dataset.countries || '').split(/\s+/).filter(Boolean);
      var countryOk = !country || (country === '__unknown__' ? countries.length === 0 : countries.includes(country));
      return countryOk && (!decade || card.dataset.decade === decade);
    });
    cards.forEach(function (card) { card.hidden = !visible.includes(card); });
    visible.sort(function (a, b) {
      if (order === 'title') return a.dataset.title.localeCompare(b.dataset.title, 'it');
      var delta = Number(a.dataset.year || 0) - Number(b.dataset.year || 0);
      return order === 'old' ? delta : -delta;
    }).forEach(function (card) { list.appendChild(card); });
    count.textContent = visible.length + (visible.length === 1 ? ' album' : ' album');
    if (writeUrl) {
      var params = new URLSearchParams();
      if (country) params.set('paese', country);
      if (order !== 'recent') params.set('ordine', order);
      if (decade) params.set('periodo', decade);
      history.pushState({}, '', location.pathname + (params.toString() ? '?' + params : ''));
    }
  }
  function readUrl() {
    var params = new URLSearchParams(location.search);
    form.elements.country.value = params.get('paese') || '';
    form.elements.order.value = params.get('ordine') || 'recent';
    if (form.elements.decade) form.elements.decade.value = params.get('periodo') || '';
    render(false);
  }
  form.addEventListener('change', function () { render(true); });
  addEventListener('popstate', readUrl);
  readUrl();
}());


(function () {
  var list = document.querySelector('[data-random-recipes]');
  var data = document.getElementById('home-recipe-data');
  if (!list || !data) return;
  var rows = JSON.parse(data.textContent).slice();
  for (var i = rows.length - 1; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var swap = rows[i]; rows[i] = rows[j]; rows[j] = swap;
  }
  rows.slice(0, 4).forEach(function (row) {
    var link = document.createElement('a');
    link.className = 'content-card';
    link.href = row.url;
    if (row.cover) {
      var image = document.createElement('img');
      image.src = row.cover;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      link.appendChild(image);
    }
    var title = document.createElement('strong');
    title.textContent = row.title;
    link.appendChild(title);
    list.appendChild(link);
  });
}());
