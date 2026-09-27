/* Small orientation map using the atlas' existing country geometry.
   It deliberately has no production-area marker: a cartographic cue is not a
   geographic attribution or an approved Eccellenza-to-Place bridge. */
(function () {
  const maps = Array.from(document.querySelectorAll('svg[data-territory-country]'));
  if (!maps.length || !window.d3 || !window.topojson) return;
  const names = {Italia: 'Italy', Francia: 'France'};
  fetch('/geografia/assets/countries-110m.json').then(response => {
    if (!response.ok) throw new Error('Carta geografica non disponibile');
    return response.json();
  }).then(world => {
    const countries = topojson.feature(world, world.objects.countries).features;
    maps.forEach(node => {
      const wanted = names[node.dataset.territoryCountry] || node.dataset.territoryCountry;
      const feature = countries.find(item => item.properties && item.properties.name === wanted);
      if (!feature) return;
      const projection = d3.geoMercator().fitExtent([[12, 10], [208, 155]], feature);
      const path = d3.geoPath(projection);
      d3.select(node).append('path').datum(feature).attr('d', path)
        .attr('fill', '#dce4df').attr('stroke', '#718680').attr('stroke-width', 1.1);
    });
  }).catch(() => { /* The attested textual territory remains available. */ });
}());
