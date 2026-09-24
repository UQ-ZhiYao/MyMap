/* Travel Atlas — world map page */
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

const keyOf = f => f.id ? String(f.id) : 'n:' + f.properties.name;
const pageUrl = f => `country.html?c=${encodeURIComponent(keyOf(f))}&n=${encodeURIComponent(f.properties.name)}`;

let features = [];
let listTab = 'visited';

(async function main() {
  await Store.init();

  const svg = d3.select('#map');
  const g = svg.append('g');
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [952, 492]], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  g.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  g.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));

  let world;
  try { world = await d3.json(WORLD_URL); }
  catch (e) { document.getElementById('mapStatus').textContent = 'Could not load the map. Check your connection.'; return; }
  document.getElementById('mapStatus').remove();

  features = topojson.feature(world, world.objects.countries).features
    .filter(f => f.properties.name !== 'Antarctica');

  const tip = document.getElementById('tooltip');
  const wrap = document.querySelector('.map-wrap');

  const countries = g.selectAll('path.country')
    .data(features)
    .join('path')
    .attr('class', f => 'country ' + Store.statusOf(keyOf(f)))
    .attr('d', path)
    .on('mousemove', (e, f) => {
      const r = wrap.getBoundingClientRect();
      const c = Store.peek(keyOf(f));
      const st = STATUS[Store.statusOf(keyOf(f))].label;
      const n = c && c.notes ? c.notes.length : 0;
      tip.innerHTML = `<b>${esc(f.properties.name)}</b><span class="tip-st ${Store.statusOf(keyOf(f))}">${st}</span>${n ? `<span class="muted"> · ${n} note${n > 1 ? 's' : ''}</span>` : ''}`;
      tip.hidden = false;
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + tip.offsetWidth > r.width) x -= tip.offsetWidth + 28;
      tip.style.transform = `translate(${x}px, ${y}px)`;
    })
    .on('mouseleave', () => { tip.hidden = true; })
    .on('click', (e, f) => {
      const mode = document.getElementById('clickMode').value;
      if (mode === 'open') { location.href = pageUrl(f); return; }
      Store.setStatus(keyOf(f), f.properties.name, mode);
      countries.filter(d => keyOf(d) === keyOf(f)).attr('class', 'country ' + mode);
      refreshSide();
    });

  // Zoom & pan
  const zoom = d3.zoom().scaleExtent([1, 14])
    .translateExtent([[0, 0], [960, 500]])
    .on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom);
  document.getElementById('zoomIn').onclick = () => svg.transition().call(zoom.scaleBy, 1.6);
  document.getElementById('zoomOut').onclick = () => svg.transition().call(zoom.scaleBy, 1 / 1.6);
  document.getElementById('zoomReset').onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);

  // Search: jump to a country's page
  const names = [...new Set(features.map(f => f.properties.name))].sort((a, b) => a.localeCompare(b));
  document.getElementById('countryList').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
  const search = document.getElementById('countrySearch');
  const go = () => {
    const v = search.value.trim().toLowerCase();
    const f = features.find(f => f.properties.name.toLowerCase() === v)
          || features.find(f => f.properties.name.toLowerCase().startsWith(v));
    if (!f) return;
    // Zoom to it on the map
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const k = Math.min(10, 0.8 / Math.max((x1 - x0) / 960, (y1 - y0) / 500));
    svg.transition().duration(750).call(zoom.transform,
      d3.zoomIdentity.translate(480, 250).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
    countries.classed('flash', d => d === f);
    setTimeout(() => countries.classed('flash', false), 1800);
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
