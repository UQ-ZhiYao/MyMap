/* Travel Atlas — world map page
   Uses Google Maps when an API key is set in js/config.js,
   otherwise falls back to the built-in (no key needed) SVG map. */
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const COLORS = { visited: '#1f9d74', known: '#e0a02b', none: '#8a94a3' };

const keyOf = f => f.id ? String(f.id) : 'n:' + f.properties.name;
const pageUrl = f => `country.html?c=${encodeURIComponent(keyOf(f))}&n=${encodeURIComponent(f.properties.name)}`;
const gKey = () => (typeof GOOGLE_MAPS_API_KEY === 'string' ? GOOGLE_MAPS_API_KEY.trim() : '');
const hasKey = () => gKey() && gKey() !== 'YOUR_API_KEY';

let features = [];
let listTab = 'visited';
let renderer = null;   // { repaint(), focus(feature) }

(async function main() {
  await Store.init();

  const status = document.getElementById('mapStatus');
  let world;
  try { world = await d3.json(WORLD_URL); }
  catch (e) { status.textContent = 'Could not load the map. Check your connection.'; return; }

  features = topojson.feature(world, world.objects.countries).features
    .filter(f => f.properties.name !== 'Antarctica');

  if (hasKey()) {
    try { await loadGoogle(); renderer = initGoogleMap(); }
    catch (e) { console.warn('Google Maps unavailable, using built-in map:', e); renderer = initSvgMap(); }
  } else {
    renderer = initSvgMap();
  }
  status.remove();

  // Search: jump to a country on the map
  const names = [...new Set(features.map(f => f.properties.name))].sort((a, b) => a.localeCompare(b));
  document.getElementById('countryList').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
  const search = document.getElementById('countrySearch');
  const go = () => {
    const v = search.value.trim().toLowerCase();
    if (!v) return;
    const f = features.find(f => f.properties.name.toLowerCase() === v)
          || features.find(f => f.properties.name.toLowerCase().startsWith(v));
    if (f) renderer.focus(f);
  };
  search.addEventListener('change', go);
  search.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });

  // Sidebar
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    listTab = t.dataset.tab; refreshSide();
  });
  document.getElementById('exportBtn').onclick = () => Store.export();
  document.getElementById('importFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await Store.import(f); location.reload(); } catch (err) { alert('Import failed: ' + err.message); }
  };
  document.getElementById('resetBtn').onclick = () => {
    if (confirm('Clear all statuses and notes in this browser? Export first if you want a backup.')) { Store.reset(); location.reload(); }
  };

  refreshSide();
})();

/* ---------- Shared behaviour ---------- */
function tipHtml(key, name) {
  const st = Store.statusOf(key), c = Store.peek(key);
  const n = c && c.notes ? c.notes.length : 0;
  return `<b>${esc(name)}</b><span class="tip-st ${st}">${STATUS[st].label}</span>${n ? `<span class="muted"> · ${n} note${n > 1 ? 's' : ''}</span>` : ''}`;
}
function showTip(html, clientX, clientY) {
  const tip = document.getElementById('tooltip');
  const r = document.querySelector('.map-wrap').getBoundingClientRect();
  tip.innerHTML = html; tip.hidden = false;
  let x = clientX - r.left + 14, y = clientY - r.top + 14;
  if (x + tip.offsetWidth > r.width) x -= tip.offsetWidth + 28;
  tip.style.transform = `translate(${x}px, ${y}px)`;
}
const hideTip = () => { document.getElementById('tooltip').hidden = true; };

/* Click on a country: open its page, or mark it (depending on the dropdown) */
function handleCountryClick(key, name) {
  const mode = document.getElementById('clickMode').value;
  if (mode === 'open') {
    location.href = `country.html?c=${encodeURIComponent(key)}&n=${encodeURIComponent(name)}`;
    return;
  }
  Store.setStatus(key, name, mode);
  renderer.repaint();
  refreshSide();
}

/* ---------- Google Maps renderer ---------- */
function loadGoogle() {
  return new Promise((resolve, reject) => {
    window.__gmReady = resolve;
    window.gm_authFailure = () => {
      // Key rejected (wrong key, API not enabled, billing off, or referrer not allowed)
      const el = document.createElement('div');
      el.className = 'map-error';
      el.innerHTML = 'Google Maps rejected the API key. Check the key, that the <b>Maps JavaScript API</b> is enabled, that billing is on, and that this site is in the key\'s allowed referrers. See README.';
      document.querySelector('.map-card').prepend(el);
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(gKey())}&v=weekly&loading=async&callback=__gmReady`;
    s.async = true;
    s.onerror = () => reject(new Error('Could not load Google Maps script'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Google Maps timed out')), 15000);
  });
}

function initGoogleMap() {
  document.getElementById('map').remove();
  document.querySelector('.zoom-btns').hidden = true;   // Google has its own controls
  const el = document.getElementById('gmap');
  el.hidden = false;

  const map = new google.maps.Map(el, {
    center: { lat: 20, lng: 15 },
    zoom: 2, minZoom: 2,
    streetViewControl: false,
    mapTypeControl: true,
    fullscreenControl: true,
    gestureHandling: 'greedy'
  });

  // Country shapes as an overlay. IDs are dropped (a few territories share one) and kept as properties.
  map.data.addGeoJson({
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature', geometry: f.geometry,
      properties: { key: keyOf(f), name: f.properties.name }
    }))
  });

  const style = feat => {
    const st = Store.statusOf(feat.getProperty('key'));
    return {
      fillColor: COLORS[st],
      fillOpacity: st === 'none' ? 0.04 : 0.6,
      strokeColor: st === 'none' ? '#8a94a3' : '#ffffff',
      strokeOpacity: st === 'none' ? 0.5 : 0.9,
      strokeWeight: 0.6,
      cursor: 'pointer'
    };
  };
  map.data.setStyle(style);

  map.data.addListener('mouseover', e => {
    map.data.revertStyle();
    map.data.overrideStyle(e.feature, { strokeWeight: 2, strokeColor: '#1d2433', strokeOpacity: 1, fillOpacity: Store.statusOf(e.feature.getProperty('key')) === 'none' ? 0.18 : 0.75 });
  });
  map.data.addListener('mousemove', e => {
    if (e.domEvent) showTip(tipHtml(e.feature.getProperty('key'), e.feature.getProperty('name')), e.domEvent.clientX, e.domEvent.clientY);
  });
  map.data.addListener('mouseout', () => { map.data.revertStyle(); hideTip(); });
  map.data.addListener('click', e => handleCountryClick(e.feature.getProperty('key'), e.feature.getProperty('name')));

  return {
    repaint() { map.data.revertStyle(); map.data.setStyle(style); },
    focus(f) {
      const [[w, s], [e, n]] = d3.geoBounds(f);
      map.fitBounds({ west: w, south: s, east: e, north: n }, 40);
    }
  };
}

/* ---------- Built-in SVG renderer (no API key needed) ---------- */
function initSvgMap() {
  const gm = document.getElementById('gmap'); if (gm) gm.remove();
  const svg = d3.select('#map');
  const g = svg.append('g');
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [952, 492]], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  g.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  g.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));

  const countries = g.selectAll('path.country')
    .data(features)
    .join('path')
    .attr('class', f => 'country ' + Store.statusOf(keyOf(f)))
    .attr('d', path)
    .on('mousemove', (e, f) => showTip(tipHtml(keyOf(f), f.properties.name), e.clientX, e.clientY))
    .on('mouseleave', hideTip)
    .on('click', (e, f) => handleCountryClick(keyOf(f), f.properties.name));

  const zoom = d3.zoom().scaleExtent([1, 14])
    .translateExtent([[0, 0], [960, 500]])
    .on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom);
  document.getElementById('zoomIn').onclick = () => svg.transition().call(zoom.scaleBy, 1.6);
  document.getElementById('zoomOut').onclick = () => svg.transition().call(zoom.scaleBy, 1 / 1.6);
  document.getElementById('zoomReset').onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);

  return {
    repaint() { countries.attr('class', f => 'country ' + Store.statusOf(keyOf(f))); },
    focus(f) {
      const [[x0, y0], [x1, y1]] = path.bounds(f);
      const k = Math.min(10, 0.8 / Math.max((x1 - x0) / 960, (y1 - y0) / 500));
      svg.transition().duration(750).call(zoom.transform,
        d3.zoomIdentity.translate(480, 250).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
      countries.classed('flash', d => d === f);
      setTimeout(() => countries.classed('flash', false), 1800);
    }
  };
}

/* ---------- Sidebar ---------- */
/* One entry per country key (some tiny territories share an ISO code with their country) */
function uniqueCountries() {
  const m = new Map();
  for (const f of features) {
    const k = keyOf(f), prev = m.get(k);
    if (!prev || d3.geoArea(f) > d3.geoArea(prev)) m.set(k, f);
  }
  return [...m.values()];
}

function refreshSide() {
  const uniq = uniqueCountries();
  const total = uniq.length;
  const all = Store.get().countries;
  const byStatus = s => uniq.filter(f => (all[keyOf(f)] || {}).status === s);
  const visited = byStatus('visited'), known = byStatus('known');
  document.getElementById('nVisited').textContent = visited.length;
  document.getElementById('nKnown').textContent = known.length;
  document.getElementById('nNone').textContent = total - visited.length - known.length;
  const pct = total ? (visited.length / total * 100) : 0;
  document.getElementById('progressBar').style.width = pct.toFixed(1) + '%';
  document.getElementById('progressText').textContent = `${pct.toFixed(1)}% of the world visited`;

  let list;
  if (listTab === 'visited') list = visited;
  else if (listTab === 'known') list = known;
  else list = uniq.filter(f => ((all[keyOf(f)] || {}).notes || []).length);
  list.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  const ul = document.getElementById('countryListView');
  ul.innerHTML = list.length
    ? list.map(f => {
        const c = all[keyOf(f)] || {};
        const n = (c.notes || []).length;
        return `<li><a href="${pageUrl(f)}"><i class="sw ${c.status || 'none'}"></i>${esc(f.properties.name)}${n ? `<span class="count">${n}</span>` : ''}</a></li>`;
      }).join('')
    : `<li class="empty">Nothing here yet — click countries on the map.</li>`;
}
