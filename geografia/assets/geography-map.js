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

  function initialize(container, world) {
    var mode = container.dataset.mapMode || 'explorer';
    var section = container.closest('section') || container.parentElement;
    var controls = section && section.querySelector('[data-map-controls]');
    var dataNode = document.getElementById(container.dataset.mapData || 'geography-map-data');
    if (!dataNode) return;

    var svgNode = container.querySelector('svg');
    var svg = d3.select(svgNode);
    var status = container.querySelector('[data-map-status]');
    var missingSummary = section && section.querySelector('[data-map-missing-summary]');
    var missingList = section && section.querySelector('[data-map-missing-list]');
    var places = JSON.parse(dataNode.textContent);
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
        return !place.coordinates && countFor(place, filter) > 0;
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
      var width = Math.max(mode === 'overview' ? 260 : 320, container.clientWidth || 900);
      var narrow = width < 700;
      var height = isMobileModal
        ? Math.max(420, container.clientHeight || window.innerHeight - 56)
        : mode === 'overview'
        ? Math.max(170, Math.round(width / (narrow ? 1.75 : 2.75)))
        : Math.max(260, Math.round(width / (narrow ? 1.45 : 1.9)));
      var filter = mode === 'overview' ? 'content' : controls.elements.corpus.value;
      var view = mode === 'overview' ? 'world' : controls.elements.view.value;
      var visible = places.filter(function (place) {
        return place.coordinates && countFor(place, filter) > 0;
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
        .attr('data-hit-radius', mode === 'overview' ? 18 : 20)
        .attr('r', function () { return this.getAttribute('data-hit-radius'); });
      links.append('circle')
        .attr('class', function (place) {
          return place.kind === 'stato' ? 'map-marker map-marker-state' : 'map-marker';
        })
        .attr('cx', function (place) { return projection(place.coordinates)[0]; })
        .attr('cy', function (place) { return projection(place.coordinates)[1]; })
        .attr('data-base-radius', function (place) {
          var value = countFor(place, filter);
          if (mode === 'overview') return Math.min(6.5, 2.6 + Math.sqrt(value) * 0.82);
          return filter === 'all' ? 4 : Math.min(13, 4 + Math.sqrt(value) * 1.45);
        })
        .attr('data-min-screen-radius', function (place) {
          if (place.kind === 'stato') return 5;
          return mode === 'overview' ? 3.5 : 4;
        })
        .attr('r', function () { return this.getAttribute('data-base-radius'); });
      links.append('title').text(function (place) { return labelFor(place, filter); });

      if (mode === 'explorer' || mode === 'overview') {
        var zoom = d3.zoom()
          .scaleExtent([1, 320])
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
        var spec = viewSpecs[view] || viewSpecs.world;
        var projected = projection(spec.center);
        var initial = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(spec.scale)
          .translate(-projected[0], -projected[1]);
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
      var url = container.dataset.mapWorldUrl || '../assets/countries-110m.json';
      if (!groups.has(url)) groups.set(url, []);
      groups.get(url).push(container);
    });
    groups.forEach(function (items, url) {
      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error('Base cartografica non disponibile');
          return response.json();
        })
        .then(function (world) { items.forEach(function (container) { initialize(container, world); }); })
        .catch(function (error) {
          items.forEach(function (container) {
            var status = container.querySelector('[data-map-status]');
            if (status) status.textContent = error.message + '. Restano disponibili indice alfabetico e gerarchie.';
          });
        });
    });
  });
}());
