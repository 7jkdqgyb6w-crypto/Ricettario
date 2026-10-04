(function () {
  'use strict';

  var viewSpecs = {
    world: { center: [10, 12], scale: 1 },
    'europe-mediterranean': { center: [15, 42], scale: 2.45 },
    'italy-adriatic': { center: [14, 43], scale: 7.8 },
    australia: { center: [134, -25], scale: 3.2 }
  };

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function countFor(place, filter) {
    if (filter === 'all') return 1;
    if (filter === 'content') return place.total || 0;
    return (place.counts && place.counts[filter]) || 0;
  }

  function labelFor(place, filter) {
    var count = countFor(place, filter);
    if (filter === 'all') return place.label + ' · ' + place.kind.replaceAll('_', ' ');
    return place.label + ' · ' + count + (count === 1 ? ' contenuto' : ' contenuti');
  }

  function initialize(container, world, places, regions) {
    var mode = container.dataset.mapMode || 'explorer';
    var section = container.closest('section') || container.parentElement;
    var controls = section && section.querySelector('[data-map-controls]');

    var svgNode = container.querySelector('svg');
    var svg = d3.select(svgNode);
    var status = container.querySelector('[data-map-status]');
    var missingSummary = section && section.querySelector('[data-map-missing-summary]');
    var missingList = section && section.querySelector('[data-map-missing-list]');
    var mobileMapQuery = window.matchMedia('(max-width: 54rem)');
    var modal = null;
    var modalPlaceholder = null;
    var modalSelection = null;
    var modalSelectionLink = null;
    var suppressClicksUntil = 0;
    var selectedPlaceId = '';
    var currentVisible = [];
    var currentProjection = null;
    var currentTransform = d3.zoomIdentity;
    var currentWidth = 0;
    var currentHeight = 0;

    function positionModalSelection(place) {
      if (!modal || !modalSelection || modalSelection.hidden || !place || !currentProjection) return;
      var holder = modal.querySelector('.mobile-map-holder');
      if (!holder) return;
      var holderRect = holder.getBoundingClientRect();
      var svgRect = svgNode.getBoundingClientRect();
      var projected = currentTransform.apply(currentProjection(place.coordinates));
      var x = svgRect.left - holderRect.left + projected[0] * svgRect.width / Math.max(1, currentWidth);
      var y = svgRect.top - holderRect.top + projected[1] * svgRect.height / Math.max(1, currentHeight);
      var horizontalMargin = Math.min(92, holderRect.width / 2);
      modalSelection.style.left = Math.max(horizontalMargin, Math.min(holderRect.width - horizontalMargin, x)) + 'px';
      modalSelection.style.top = y + 'px';
      modalSelection.classList.toggle('is-below', y < 92);
    }

    function closeMobileMap(redraw) {
      if (!modal) return;
      if (modalPlaceholder && modalPlaceholder.parentNode) {
        modalPlaceholder.parentNode.replaceChild(container, modalPlaceholder);
      }
      container.classList.remove('is-mobile-map-modal');
      modal.remove();
      modal = null;
      modalPlaceholder = null;
      modalSelection = null;
      modalSelectionLink = null;
      selectedPlaceId = '';
      document.body.classList.remove('mobile-map-modal-open');
      document.removeEventListener('keydown', onModalKeydown);
      if (redraw !== false) requestAnimationFrame(draw);
    }

    function onModalKeydown(event) {
      if (event.key === 'Escape') closeMobileMap();
    }

    function openMobileMap() {
      if (modal || !mobileMapQuery.matches || !container.parentNode) return;
      modalPlaceholder = document.createComment('mobile-map-placeholder');
      container.parentNode.insertBefore(modalPlaceholder, container);

      modal = document.createElement('div');
      modal.className = 'mobile-map-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Planisfero interattivo');

      var toolbar = document.createElement('div');
      toolbar.className = 'mobile-map-toolbar';
      var closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'mobile-map-close';
      closeButton.setAttribute('aria-label', 'Chiudi il planisfero');
      closeButton.textContent = '×';
      closeButton.addEventListener('click', function () { closeMobileMap(); });
      toolbar.appendChild(closeButton);

      var holder = document.createElement('div');
      holder.className = 'mobile-map-holder';
      container.classList.add('is-mobile-map-modal');
      holder.appendChild(container);

      modalSelection = document.createElement('div');
      modalSelection.className = 'mobile-map-tooltip';
      modalSelection.hidden = true;
      modalSelection.setAttribute('aria-live', 'polite');
      modalSelectionLink = document.createElement('a');
      modalSelectionLink.addEventListener('click', function (event) {
        event.preventDefault();
        var destination = modalSelectionLink.getAttribute('href');
        closeMobileMap(false);
        location.assign(destination);
      });
      modalSelection.appendChild(modalSelectionLink);
      holder.appendChild(modalSelection);
      modal.appendChild(toolbar);
      modal.appendChild(holder);
      document.body.appendChild(modal);
      document.body.classList.add('mobile-map-modal-open');
      document.addEventListener('keydown', onModalKeydown);
      requestAnimationFrame(draw);
      closeButton.focus();
    }

    svgNode.addEventListener('pointerdown', function (event) {
      if (!modal && mobileMapQuery.matches) {
        suppressClicksUntil = Date.now() + 700;
        event.preventDefault();
        event.stopImmediatePropagation();
        openMobileMap();
      }
    }, true);

    svgNode.addEventListener('click', function (event) {
      if (Date.now() < suppressClicksUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!modal) return;
      if (!currentProjection || !currentVisible.length) return;
      var point = d3.pointer(event, svgNode);
      var rect = svgNode.getBoundingClientRect();
      var threshold = 24 * (currentWidth / Math.max(1, rect.width));
      var nearest = null;
      var nearestDistance = Infinity;
      currentVisible.forEach(function (place) {
        var projected = currentProjection(place.coordinates);
        var transformed = currentTransform.apply(projected);
        var dx = point[0] - transformed[0];
        var dy = point[1] - transformed[1];
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearest = place;
          nearestDistance = distance;
        }
      });
      if (!nearest || nearestDistance > threshold) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectedPlaceId = nearest.id;
      svg.selectAll('.map-markers a').classed('is-selected', function (place) {
        return place.id === selectedPlaceId;
      });
      modalSelectionLink.href = nearest.url;
      modalSelectionLink.textContent = nearest.label + ' →';
      modalSelection.hidden = false;
      positionModalSelection(nearest);
    }, true);

    function renderMissing(filter) {
      if (!missingSummary || !missingList || mode !== 'explorer') return;
      var rows = places.filter(function (place) {
        return place.place_active !== false && !place.coordinates && countFor(place, filter) > 0;
      }).sort(function (a, b) { return a.label.localeCompare(b.label, 'it'); });
      missingSummary.textContent = rows.length + (rows.length === 1 ? ' voce senza coordinate' : ' voci senza coordinate');
      missingList.replaceChildren();
      rows.forEach(function (place) {
        var link = document.createElement('a');
        link.href = place.url;
        link.textContent = place.label;
        missingList.appendChild(link);
      });
    }

    function draw() {
      var isMobileModal = container.classList.contains('is-mobile-map-modal');
      var width = Math.max(mode === 'territory' ? 180 : mode === 'overview' ? 260 : 320, container.clientWidth || 900);
      var narrow = width < 700;
      var height = isMobileModal
        ? Math.max(420, container.clientHeight || window.innerHeight - 56)
        : mode === 'territory'
        ? Math.max(150, Math.round(width * 3 / 4))
        : mode === 'overview'
        ? Math.max(170, Math.round(width / (narrow ? 1.75 : 2.75)))
        : Math.max(260, Math.round(width / (narrow ? 1.45 : 1.9)));
      var filter = mode === 'territory' ? 'all' : mode === 'overview' ? 'content' : controls.elements.corpus.value;
      var view = mode === 'territory' ? 'territory' : mode === 'overview' ? 'world' : controls.elements.view.value;
      var visible = places.filter(function (place) {
        return place.map_visible !== false && place.coordinates && countFor(place, filter) > 0;
      });
      currentVisible = visible;
      currentWidth = width;
      currentHeight = height;

      svg.attr('viewBox', '0 0 ' + width + ' ' + height);
      svg.selectAll('g[data-map-layer]').remove();
      svg.on('.zoom', null);

      var projection = d3.geoEqualEarth()
        .fitExtent([[8, 8], [width - 8, height - 8]], { type: 'Sphere' });
      var path = d3.geoPath(projection);
      currentProjection = projection;
      currentTransform = d3.zoomIdentity;
      var layer = svg.append('g').attr('data-map-layer', '');

      layer.append('path').attr('class', 'map-sphere').attr('d', path({ type: 'Sphere' }));
      layer.append('path').attr('class', 'map-graticule').attr('d', path(d3.geoGraticule10()));
      layer.selectAll('path.map-land')
        .data(topojson.feature(world, world.objects.countries).features)
        .join('path')
        .attr('class', 'map-land')
        .attr('d', path);

      var regionName = container.dataset.mapRegionName;
      var region = regions && regionName
        ? topojson.feature(regions, regions.objects.regions).features.find(function (feature) {
          return feature.properties.reg_name === regionName;
        }) : null;
      if (region) {
        layer.append('path').datum(region).attr('class', 'map-region').attr('d', path);
      }

      var markers = layer.append('g').attr('class', 'map-markers');
      var links = markers.selectAll('a').data(visible).join('a')
        .attr('href', function (place) { return place.url; })
        .attr('aria-label', function (place) { return labelFor(place, filter); })
        .on('focus mouseenter', function () { d3.select(this).classed('is-selected', true); })
        .on('blur mouseleave', function (event, place) {
          d3.select(this).classed('is-selected', place.id === selectedPlaceId);
        })
        .classed('is-selected', function (place) { return place.id === selectedPlaceId; });
      links.append('circle')
        .attr('class', 'map-marker-hit')
        .attr('cx', function (place) { return projection(place.coordinates)[0]; })
        .attr('cy', function (place) { return projection(place.coordinates)[1]; })
        .attr('data-hit-radius', mode === 'overview' ? 18 : mode === 'territory' ? 10 : 20)
        .attr('r', function () { return this.getAttribute('data-hit-radius'); });
      links.append('circle')
        .attr('class', function (place) {
          return place.kind === 'stato' ? 'map-marker map-marker-state' : 'map-marker';
        })
        .attr('cx', function (place) { return projection(place.coordinates)[0]; })
        .attr('cy', function (place) { return projection(place.coordinates)[1]; })
        .attr('data-base-radius', function (place) {
          var value = countFor(place, filter);
          if (mode === 'territory') return 2;
          if (mode === 'overview') return Math.min(6.5, 2.6 + Math.sqrt(value) * 0.82);
          return filter === 'all' ? 4 : Math.min(13, 4 + Math.sqrt(value) * 1.45);
        })
        .attr('data-min-screen-radius', function (place) {
          if (mode === 'territory') return 2;
          if (place.kind === 'stato') return 5;
          return mode === 'overview' ? 3.5 : 4;
        })
        .attr('r', function () { return this.getAttribute('data-base-radius'); });
      links.append('title').text(function (place) { return labelFor(place, filter); });

      if (mode === 'explorer' || mode === 'overview' || mode === 'territory') {
        var zoom = d3.zoom()
          .scaleExtent([1, 2048])
          .clickDistance(10)
          .tapDistance(18)
          .on('zoom', function (event) {
          currentTransform = event.transform;
          layer.attr('transform', event.transform);
          markers.selectAll('circle.map-marker')
            .attr('r', function () {
              var baseRadius = Number(this.getAttribute('data-base-radius'));
              var minimumScreenRadius = Number(this.getAttribute('data-min-screen-radius'));
              var screenRadius = Math.max(minimumScreenRadius, baseRadius / Math.pow(event.transform.k, 0.12));
              return screenRadius / event.transform.k;
            })
            .attr('stroke-width', 1 / event.transform.k);
          markers.selectAll('circle.map-marker-hit')
            .attr('r', function () {
              return Number(this.getAttribute('data-hit-radius')) / event.transform.k;
            });
          if (selectedPlaceId) {
            var selectedPlace = currentVisible.find(function (place) { return place.id === selectedPlaceId; });
            positionModalSelection(selectedPlace);
          }
        });
        svg.call(zoom);
        var focus = (container.dataset.mapFocus || '').split(',').map(Number);
        var territorySpec = focus.length === 2 && focus.every(Number.isFinite)
          ? { center: focus, scale: Number(container.dataset.mapScale) || 18 }
          : viewSpecs['italy-adriatic'];
        var spec = view === 'territory' ? territorySpec : viewSpecs[view] || viewSpecs.world;
        var projected = projection(spec.center);
        var initial;
        if (region && view === 'territory') {
          var bounds = path.bounds(region);
          var regionWidth = bounds[1][0] - bounds[0][0];
          var regionHeight = bounds[1][1] - bounds[0][1];
          var regionScale = Math.min(width * .82 / regionWidth, height * .72 / regionHeight);
          var regionCenter = [(bounds[0][0] + bounds[1][0]) / 2,
                              (bounds[0][1] + bounds[1][1]) / 2];
          initial = d3.zoomIdentity.translate(width / 2, height / 2)
            .scale(regionScale).translate(-regionCenter[0], -regionCenter[1]);
        } else {
          initial = d3.zoomIdentity.translate(width / 2, height / 2)
            .scale(spec.scale).translate(-projected[0], -projected[1]);
        }
        svg.call(zoom.transform, initial);
        if (status && mode === 'explorer') {
          status.textContent = visible.length + (visible.length === 1 ? ' luogo visualizzato' : ' luoghi visualizzati') + ' · trascina o ingrandisci la mappa; seleziona un punto per aprire la voce.';
        }
        if (mode === 'explorer') renderMissing(filter);
      }
    }

    if (controls) {
      var params = new URLSearchParams(location.search);
      var requestedCorpus = params.get('corpus');
      var requestedView = params.get('view');
      if (requestedCorpus && controls.elements.corpus.querySelector('option[value="' + requestedCorpus + '"]')) {
        controls.elements.corpus.value = requestedCorpus;
      }
      if (requestedView && controls.elements.view.querySelector('option[value="' + requestedView + '"]')) {
        controls.elements.view.value = requestedView;
      }
      controls.addEventListener('change', function () {
        var next = new URLSearchParams(location.search);
        if (controls.elements.corpus.value === 'content') next.delete('corpus');
        else next.set('corpus', controls.elements.corpus.value);
        if (controls.elements.view.value === 'world') next.delete('view');
        else next.set('view', controls.elements.view.value);
        history.replaceState({}, '', location.pathname + (next.toString() ? '?' + next : '') + location.hash);
        draw();
      });
    }
    draw();
    new ResizeObserver(draw).observe(container);
  }

  ready(function () {
    var containers = Array.from(document.querySelectorAll('[data-geography-map]'));
    if (!containers.length) return;
    var groups = new Map();
    containers.forEach(function (container) {
      var worldUrl = container.dataset.mapWorldUrl || '../assets/countries-110m.json';
      var dataUrl = container.dataset.mapJsonUrl;
      var regionUrl = container.dataset.mapRegionUrl || null;
      var key = JSON.stringify([worldUrl, dataUrl, regionUrl]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(container);
    });
    groups.forEach(function (items, key) {
      var urls = JSON.parse(key);
      Promise.all(urls.map(function (url, index) {
        if (!url && index === 2) return Promise.resolve(null);
        if (!url) return Promise.reject(new Error('Dati geografici non configurati'));
        return fetch(url).then(function (response) {
          if (!response.ok) throw new Error('Risorsa del planisfero non disponibile: ' + url);
          return response.json();
        });
      }))
        .then(function (resources) {
          items.forEach(function (container) { initialize(container, resources[0], resources[1], resources[2]); });
        })
        .catch(function (error) {
          items.forEach(function (container) {
            var status = container.querySelector('[data-map-status]');
            if (status) status.textContent = error.message + '. Restano disponibili indice alfabetico e gerarchie.';
          });
        });
    });
  });

  ready(function () {
    var host = document.querySelector('[data-progressive-geography]');
    if (!host) return;
    fetch(host.dataset.geoIndexUrl).then(function (response) {
      if (!response.ok) throw new Error('Indice geografico non disponibile');
      return response.json();
    }).then(function (rows) {
      var byId = new Map(rows.map(function (row) { return [row.id, row]; }));
      var adminRows = rows.filter(function (row) { return row.administrative_visible !== false; });
      var territoryRows = rows.filter(function (row) { return row.territorial_visible !== false; });
      var alphabetRows = rows.filter(function (row) { return row.index_visible !== false; });
      var searchableRows = rows.filter(function (row) { return row.search_visible !== false; });
      function branchFor(edge) {
        return edge.relation === 'amministrativa' ? 'amministrativa'
          : ['territoriale', 'storico_culturale', 'fisico_geografica'].includes(edge.relation)
            ? 'territoriale' : null;
      }
      function visibleParents(row, branch, seen) {
        seen = seen || new Set();
        var result = [];
        (row.broader || []).forEach(function (edge) {
          if (branchFor(edge) !== branch || seen.has(edge.id)) return;
          var parent = byId.get(edge.id);
          if (!parent) return;
          seen.add(edge.id);
          if (parent.canonical_index_id && byId.has(parent.canonical_index_id)) {
            var canonical = byId.get(parent.canonical_index_id);
            if ((branch === 'amministrativa' ? canonical.administrative_visible
                   : canonical.territorial_visible) !== false) {
              result.push(canonical);
              return;
            }
          }
          if ((branch === 'amministrativa' ? parent.administrative_visible
                 : parent.territorial_visible) !== false) result.push(parent);
          else result.push.apply(result, visibleParents(parent, branch, seen));
        });
        return result;
      }
      var children = { amministrativa: new Map(), territoriale: new Map() };
      [['amministrativa', adminRows], ['territoriale', territoryRows]].forEach(function (group) {
        var branch = group[0];
        group[1].forEach(function (row) {
          visibleParents(row, branch).forEach(function (parent) {
            if (!children[branch].has(parent.id)) children[branch].set(parent.id, new Map());
            children[branch].get(parent.id).set(row.id, row);
          });
        });
      });
      // Show documented territories beneath their containing administrative branch too.
      // The same Place may appear beneath more than one parent; no new edge is inferred.
      territoryRows.forEach(function (row) {
        visibleParents(row, 'territoriale').forEach(function (parent) {
          if (!children.amministrativa.has(parent.id)) children.amministrativa.set(parent.id, new Map());
          children.amministrativa.get(parent.id).set(row.id, row);
        });
      });
      function ordered(items) {
        return items.slice().sort(function (a, b) { return a.label.localeCompare(b.label, 'it'); });
      }
      var treeStateKey = 'ricettario-geography-open-branches';
      var openBranches = { amministrativa: [], territoriale: [] };
      try {
        var navigation = performance.getEntriesByType('navigation')[0];
        if (navigation && navigation.type === 'back_forward') {
          var storedBranches = JSON.parse(sessionStorage.getItem(treeStateKey) || '{}');
          ['amministrativa', 'territoriale'].forEach(function (branch) {
            if (Array.isArray(storedBranches[branch])) openBranches[branch] = storedBranches[branch];
          });
        } else {
          sessionStorage.removeItem(treeStateKey);
        }
      } catch (_error) { /* An unavailable session store must not block the index. */ }
      function saveTreeState() {
        try { sessionStorage.setItem(treeStateKey, JSON.stringify(openBranches)); } catch (_error) { /* no-op */ }
      }
      function node(row, branch, trail) {
        var li = document.createElement('li');
        var link = document.createElement('a');
        link.href = '/geografia/' + encodeURIComponent(row.id) + '/';
        link.textContent = row.label;
        li.appendChild(link);
        var next = Array.from((children[branch].get(row.id) || new Map()).values()).filter(function (child) {
          return !trail.includes(child.id);
        });
        if (next.length) {
          var button = document.createElement('button');
          button.type = 'button';
          var restored = openBranches[branch].includes(row.id);
          button.textContent = restored ? 'Comprimi' : 'Espandi';
          button.setAttribute('aria-label', (restored ? 'Comprimi ' : 'Espandi ') + row.label);
          button.setAttribute('aria-expanded', String(restored));
          li.insertBefore(button, link);
          function appendChildren() {
            var list = document.createElement('ul');
            ordered(next).forEach(function (child) { list.appendChild(node(child, branch, trail.concat(child.id))); });
            li.appendChild(list);
          }
          button.addEventListener('click', function () {
            var open = button.getAttribute('aria-expanded') === 'true';
            if (branch === 'amministrativa' && trail.length === 1 && !open) {
              li.parentElement.querySelectorAll(':scope > li > button[aria-expanded="true"]').forEach(function (other) {
                if (other !== button) other.click();
              });
            }
            button.setAttribute('aria-expanded', String(!open));
            button.textContent = open ? 'Espandi' : 'Comprimi';
            button.setAttribute('aria-label', (open ? 'Espandi ' : 'Comprimi ') + row.label);
            openBranches[branch] = open
              ? openBranches[branch].filter(function (id) { return id !== row.id; })
              : openBranches[branch].concat(row.id).filter(function (id, index, ids) { return ids.indexOf(id) === index; });
            saveTreeState();
            if (open) {
              li.querySelector(':scope > ul')?.remove();
              return;
            }
            appendChildren();
          });
          if (restored) appendChildren();
        }
        return li;
      }
      var admin = host.querySelector('[data-geo-tree="amministrativa"]');
      ordered(adminRows.filter(function (row) { return ['country', 'stato', 'paese'].includes(row.kind); }))
        .forEach(function (row) { admin.appendChild(node(row, 'amministrativa', [row.id])); });
      var territorial = host.querySelector('[data-geo-tree="territoriale"]');
      ordered(territoryRows.filter(function (row) {
        return children.territoriale.has(row.id) && !visibleParents(row, 'territoriale').length;
      })).forEach(function (row) { territorial.appendChild(node(row, 'territoriale', [row.id])); });
      var territoryPrimary = host.querySelector('[data-geo-territory-primary]');
      if (territoryPrimary) {
        ordered(territoryRows.filter(function (row) {
          return row.territorial_visible === true && row.administrative_visible !== true;
        })).forEach(function (row) {
          var item = document.createElement('li');
          var link = document.createElement('a');
          link.href = '/geografia/' + encodeURIComponent(row.id) + '/';
          link.textContent = row.label;
          item.appendChild(link);
          var parents = ordered(visibleParents(row, 'territoriale'));
          if (parents.length) {
            var button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Espandi';
            button.setAttribute('aria-label', 'Mostra appartenenze di ' + row.label);
            button.setAttribute('aria-expanded', 'false');
            item.insertBefore(button, link);
            button.addEventListener('click', function () {
              var open = button.getAttribute('aria-expanded') === 'true';
              button.setAttribute('aria-expanded', String(!open));
              button.textContent = open ? 'Espandi' : 'Comprimi';
              button.setAttribute('aria-label', (open ? 'Mostra' : 'Nascondi') + ' appartenenze di ' + row.label);
              if (open) {
                item.querySelector(':scope > ul')?.remove();
                return;
              }
              var list = document.createElement('ul');
              parents.forEach(function (parent) {
                var parentItem = document.createElement('li');
                var parentLink = document.createElement('a');
                parentLink.href = '/geografia/' + encodeURIComponent(parent.id) + '/';
                parentLink.textContent = parent.label;
                parentItem.appendChild(parentLink);
                list.appendChild(parentItem);
              });
              item.appendChild(list);
            });
          }
          territoryPrimary.appendChild(item);
        });
      }

      var alphabet = document.querySelector('[data-geo-alphabet]');
      var letterBar = alphabet.querySelector('[data-geo-letters]');
      var list = alphabet.querySelector('[data-geo-letter-items]');
      var input = document.querySelector('[data-geo-index-search]');
      var searchResults = document.querySelector('[data-geo-search-results]');
      var currentLetter = '';
      var letters = [...new Set(alphabetRows.map(function (row) { return row.label.trim().slice(0, 1).toLocaleUpperCase('it') || '#'; }))].sort(function (a, b) { return a.localeCompare(b, 'it'); });
      var labelCounts = new Map();
      searchableRows.forEach(function (row) {
        var label = row.label.trim().toLocaleLowerCase('it');
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      });
      function show(items, target) {
        target = target || list;
        target.replaceChildren();
        ordered(items).forEach(function (row) {
          var link = document.createElement('a');
          link.href = '/geografia/' + encodeURIComponent(row.id) + '/';
          var strong = document.createElement('strong');
          strong.textContent = row.label.trim();
          link.appendChild(strong);
          if (labelCounts.get(row.label.trim().toLocaleLowerCase('it')) > 1) {
            var qualifier = document.createElement('small');
            qualifier.textContent = ' · ' + row.kind.replaceAll('_', ' ');
            link.appendChild(qualifier);
          }
          target.appendChild(link);
        });
      }
      letters.forEach(function (letter) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = letter;
        button.addEventListener('click', function () {
          currentLetter = letter;
          letterBar.querySelectorAll('button').forEach(function (candidate) {
            candidate.setAttribute('aria-pressed', String(candidate === button));
          });
          input.value = '';
          if (searchResults) searchResults.replaceChildren();
          show(alphabetRows.filter(function (row) { return row.label.trim().slice(0, 1).toLocaleUpperCase('it') === letter; }));
        });
        letterBar.appendChild(button);
      });
      input?.addEventListener('input', function () {
        var query = input.value.trim().toLocaleLowerCase('it');
        if (!query) {
          if (searchResults) searchResults.replaceChildren();
          return;
        }
        if (searchResults) show(searchableRows.filter(function (row) {
          return (row.label + ' ' + (row.aliases || []).join(' ')).toLocaleLowerCase('it').includes(query);
        }).slice(0, 100), searchResults);
      });
    }).catch(function (error) {
      host.textContent = error.message;
    });
  });
}());
