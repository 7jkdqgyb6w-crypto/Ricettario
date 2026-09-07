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

    var svg = d3.select(container.querySelector('svg'));
    var status = container.querySelector('[data-map-status]');
    var missingSummary = section && section.querySelector('[data-map-missing-summary]');
    var missingList = section && section.querySelector('[data-map-missing-list]');
    var places = JSON.parse(dataNode.textContent);

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
      var width = Math.max(mode === 'overview' ? 260 : 320, container.clientWidth || 900);
      var narrow = width < 700;
      var height = mode === 'overview'
        ? Math.max(170, Math.round(width / (narrow ? 1.75 : 2.75)))
        : Math.max(260, Math.round(width / (narrow ? 1.45 : 1.9)));
      var filter = mode === 'overview' ? 'content' : controls.elements.corpus.value;
      var view = mode === 'overview' ? 'world' : controls.elements.view.value;
      var visible = places.filter(function (place) {
        return place.coordinates && countFor(place, filter) > 0;
      });

      svg.attr('viewBox', '0 0 ' + width + ' ' + height);
      svg.selectAll('g[data-map-layer]').remove();
      svg.on('.zoom', null);

      var projection = d3.geoEqualEarth()
        .fitExtent([[8, 8], [width - 8, height - 8]], { type: 'Sphere' });
      var path = d3.geoPath(projection);
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
        .on('blur mouseleave', function () { d3.select(this).classed('is-selected', false); });
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
        .attr('r', function () { return this.getAttribute('data-base-radius'); });
      links.append('title').text(function (place) { return labelFor(place, filter); });

      if (mode === 'explorer' || mode === 'overview') {
        var zoom = d3.zoom()
          .scaleExtent([1, 80])
          .clickDistance(10)
          .tapDistance(18)
          .on('zoom', function (event) {
          layer.attr('transform', event.transform);
          markers.selectAll('circle.map-marker')
            .attr('r', function () {
              return Number(this.getAttribute('data-base-radius')) / Math.pow(event.transform.k, 1.12);
            })
            .attr('stroke-width', 1 / event.transform.k);
          markers.selectAll('circle.map-marker-hit')
            .attr('r', function () {
              return Number(this.getAttribute('data-hit-radius')) / event.transform.k;
            });
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
