/* Travel Atlas — world map page
   Street map: Leaflet + OpenStreetMap (free, no account or key).
   If Leaflet can't load, falls back to a simple built-in SVG map. */
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const COLORS = { visited: '#1f9d74', known: '#e0a02b', none: '#8a94a3' };

const keyOf = f => f.id ? String(f.id) : 'n:' + f.properties.name;
const pageUrl = f => `country.html?c=${encodeURIComponent(keyOf(f))}&n=${encodeURIComponent(f.properties.name)}`;

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

  if (window.L) {
    try { renderer = initLeafletMap(); }
    catch (e) { console.warn('Street map unavailable, using simple map:', e); renderer = initSvgMap(); }
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

/* ---------- Street map renderer: Leaflet + OpenStreetMap (free, no key) ---------- */
function initLeafletMap() {
  document.getElementById('map').remove();
  document.querySelector('.zoom-btns').hidden = true;   // Leaflet has its own controls
  const el = document.getElementById('lmap');
  el.hidden = false;

  const map = L.map(el, { center: [20, 15], zoom: 2, minZoom: 2, maxZoom: 18, worldCopyJump: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const style = f => {
    const st = Store.statusOf(keyOf(f));
    return {
      fillColor: COLORS[st],
      fillOpacity: st === 'none' ? 0.04 : 0.6,
      color: st === 'none' ? '#8a94a3' : '#ffffff',
      opacity: st === 'none' ? 0.5 : 0.9,
      weight: 0.7
    };
  };
  // Countries crossing the 180° line (Russia, Fiji…) would draw a streak across a flat map:
  // keep each ring continuous by letting longitudes run past ±180.
  const unwrapRing = ring => {
    let prev = null;
    return ring.map(([x, y]) => {
      if (prev !== null) { while (x - prev > 180) x -= 360; while (x - prev < -180) x += 360; }
      prev = x; return [x, y];
    });
  };
  const unwrap = g => g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: g.coordinates.map(unwrapRing) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map(poly => poly.map(unwrapRing)) };
  const flat = features.map(f => ({ type: 'Feature', id: f.id, properties: f.properties, geometry: unwrap(f.geometry), src: f }));

  const layerOf = new Map();
  const layer = L.geoJSON(flat, {
    style,
    onEachFeature(f, lyr) {
      layerOf.set(f.src, lyr);
      lyr.on({
        mouseover: () => lyr.setStyle({ weight: 2, color: '#1d2433', opacity: 1, fillOpacity: Store.statusOf(keyOf(f)) === 'none' ? 0.18 : 0.75 }),
        mousemove: e => showTip(tipHtml(keyOf(f), f.properties.name), e.originalEvent.clientX, e.originalEvent.clientY),
        mouseout: () => { layer.resetStyle(lyr); hideTip(); },
        click: () => handleCountryClick(keyOf(f), f.properties.name)
      });
    }
  }).addTo(map);

  return {
    repaint() { layer.setStyle(style); },
    focus(f) {
      const lyr = layerOf.get(f);
      map.fitBounds(lyr.getBounds(), { padding: [30, 30], maxZoom: 7 });
      lyr.setStyle({ weight: 3, color: '#1d2433', opacity: 1 });
      setTimeout(() => layer.resetStyle(lyr), 1800);
    }
  };
}

/* ---------- Built-in SVG renderer (no API key needed) ---------- */
function initSvgMap() {
  const lm = document.getElementById('lmap'); if (lm) lm.remove();
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
