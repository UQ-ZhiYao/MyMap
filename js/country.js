/* Travel Atlas — country page: status, overview, source search, notes */
const KEY = qs('c');
const MAP_NAME = qs('n') || KEY || 'Unknown';
let displayName = MAP_NAME;
let editingId = null;

const QUICK_TOPICS = ['Visa', 'Best time to visit', 'Top attractions', 'Food', 'Safety', 'Transport', 'Budget', 'Culture & etiquette'];

(async function main() {
  if (!KEY) { location.href = 'index.html'; return; }
  await Store.init();
  const c = Store.country(KEY, MAP_NAME);

  document.getElementById('cName').textContent = MAP_NAME;
  document.title = `${MAP_NAME} · Travel Atlas`;

  // Status
  const paintStatus = () => {
    const st = Store.statusOf(KEY);
    document.querySelectorAll('.status-pick button').forEach(b => b.classList.toggle('on', b.dataset.status === st));
    document.getElementById('visitedRow').hidden = st !== 'visited';
    document.body.dataset.status = st;
  };
  document.querySelectorAll('.status-pick button').forEach(b => b.onclick = () => { Store.setStatus(KEY, MAP_NAME, b.dataset.status); paintStatus(); });
  const vOn = document.getElementById('visitedOn');
  vOn.value = c.visitedOn || '';
  vOn.onchange = () => { Store.country(KEY).visitedOn = vOn.value; Store.save(); };
  paintStatus();

  renderNotes(); renderSources(); setupSearch(); setupNotes(); setupSources();
  loadOverview();
})();

/* ---------- Overview: REST Countries + Wikipedia ---------- */
async function loadOverview() {
  const facts = document.getElementById('facts');
  if (/^\d+$/.test(KEY)) {
    try {
      const r = await fetch(`https://restcountries.com/v3.1/alpha/${KEY}?fields=name,capital,population,region,subregion,languages,currencies,flags,timezones,cca2`);
      if (r.ok) {
        let d = await r.json(); if (Array.isArray(d)) d = d[0];
        displayName = d.name?.common || displayName;
        document.getElementById('cName').textContent = displayName;
        document.title = `${displayName} · Travel Atlas`;
        document.getElementById('cSub').textContent = [d.name?.official, d.subregion || d.region].filter(Boolean).join(' · ');
        if (d.flags?.svg || d.flags?.png) {
          const img = document.getElementById('flag');
          img.src = d.flags.svg || d.flags.png; img.alt = d.flags.alt || `Flag of ${displayName}`; img.hidden = false;
        }
        const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '';
        facts.innerHTML = `<dl>${[
          row('Capital', (d.capital || []).join(', ')),
          row('Population', d.population ? d.population.toLocaleString() : ''),
          row('Languages', Object.values(d.languages || {}).join(', ')),
          row('Currency', Object.values(d.currencies || {}).map(x => `${x.name}${x.symbol ? ' (' + x.symbol + ')' : ''}`).join(', ')),
          row('Time zones', (d.timezones || []).slice(0, 3).join(', ') + ((d.timezones || []).length > 3 ? '…' : ''))
        ].join('')}</dl>`;
      }
    } catch (e) { /* facts are optional */ }
  }
  renderExtLinks();

  const sum = document.getElementById('summary');
  try {
    let s = await wikiSummary(displayName);
    if (!s || s.type === 'disambiguation') {
      const hits = await wikiSearch(displayName + ' country', 1);
      if (hits[0]) s = await wikiSummary(hits[0].title);
    }
    if (!s) throw 0;
    sum.classList.remove('muted');
    sum.innerHTML = `<p>${esc(s.extract)}</p><a href="${esc(s.content_urls?.desktop?.page || '#')}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a>`;
  } catch (e) { sum.textContent = 'No summary available offline — use the search below.'; }
}

async function wikiSummary(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  return r.ok ? r.json() : null;
}
async function wikiSearch(q, limit = 8) {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  const d = await r.json();
  return d.query?.search || [];
}

/* ---------- Source search ---------- */
function extSites(q) {
  const full = encodeURIComponent(`${displayName} ${q}`.trim());
  return [
    ['Google', `https://www.google.com/search?q=${full}`],
    ['Wikipedia', `https://en.wikipedia.org/w/index.php?search=${full}`],
    ['Wikivoyage', `https://en.wikivoyage.org/w/index.php?search=${full}`],
    ['Google Maps', `https://www.google.com/maps/search/${full}`],
    ['YouTube', `https://www.youtube.com/results?search_query=${full}`],
    ['Reddit', `https://www.reddit.com/search/?q=${full}`],
    ['Smartraveller', `https://www.smartraveller.gov.au/destinations`],
  ];
}
function renderExtLinks(q = '') {
  document.getElementById('extLinks').innerHTML =
    `<span class="muted small">Open in:</span> ` +
    extSites(q).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('');
}

function setupSearch() {
  const form = document.getElementById('searchForm');
  const q = document.getElementById('q');
  document.getElementById('quickTopics').innerHTML = QUICK_TOPICS.map(t => `<button type="button" class="chip">${t}</button>`).join('');
  document.querySelectorAll('#quickTopics .chip').forEach(b => b.onclick = () => { q.value = b.textContent; form.requestSubmit(); });
  q.addEventListener('input', () => renderExtLinks(q.value));

  form.onsubmit = async e => {
    e.preventDefault();
    const query = q.value.trim();
    renderExtLinks(query);
    const ul = document.getElementById('results');
    ul.innerHTML = '<li class="muted">Searching Wikipedia & Wikivoyage…</li>';
    const term = `${displayName} ${query}`.trim();
    try {
      const [wp, wv] = await Promise.all([
        wikiSearch(term, 6),
        fetch(`https://en.wikivoyage.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=4&srsearch=${encodeURIComponent(term)}`)
          .then(r => r.json()).then(d => d.query?.search || []).catch(() => [])
      ]);
      const items = [
        ...wv.map(h => ({ site: 'Wikivoyage', title: h.title, snippet: h.snippet, url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}` })),
        ...wp.map(h => ({ site: 'Wikipedia', title: h.title, snippet: h.snippet, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}` }))
      ];
      if (!items.length) { ul.innerHTML = '<li class="muted">No results — try the links above.</li>'; return; }
      ul.innerHTML = items.map((it, i) => `
        <li>
          <div class="r-head"><span class="site">${it.site}</span><a href="${it.url}" target="_blank" rel="noopener">${esc(it.title)}</a></div>
          <p>${it.snippet.replace(/<(?!\/?span[ >])[^>]*>/g, '')}…</p>
          <button class="btn tiny" data-i="${i}">＋ Save source</button>
        </li>`).join('');
      ul.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => {
        const it = items[+b.dataset.i];
        addSource(`${it.title} (${it.site})`, it.url);
        b.textContent = '✓ Saved'; b.disabled = true;
      });
    } catch (err) {
      ul.innerHTML = '<li class="muted">Search failed — use the links above.</li>';
    }
  };
}

/* ---------- Saved sources ---------- */
function addSource(title, url) {
  const c = Store.country(KEY, MAP_NAME);
  if (c.sources.some(s => s.url === url)) return;
  c.sources.unshift({ id: uid(), title, url, added: new Date().toISOString() });
  Store.save(); renderSources();
}
function setupSources() {
  document.getElementById('srcForm').onsubmit = e => {
    e.preventDefault();
    addSource(document.getElementById('srcTitle').value.trim(), document.getElementById('srcUrl').value.trim());
    e.target.reset();
  };
}
function renderSources() {
  const c = Store.country(KEY, MAP_NAME);
  document.getElementById('srcCount').textContent = c.sources.length || '';
  const ul = document.getElementById('sources');
  ul.innerHTML = c.sources.length
    ? c.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><button class="x" data-id="${s.id}" title="Remove">×</button></li>`).join('')
    : '<li class="empty">Save links from your searches here.</li>';
  ul.querySelectorAll('.x').forEach(b => b.onclick = () => {
    c.sources = c.sources.filter(s => s.id !== b.dataset.id); Store.save(); renderSources();
  });
}

/* ---------- Notes ---------- */
function setupNotes() {
  const f = document.getElementById('noteForm');
  const [t, body, tags, date] = ['noteTitle', 'noteBody', 'noteTags', 'noteDate'].map(id => document.getElementById(id));
  date.value = new Date().toISOString().slice(0, 10);
  const cancel = document.getElementById('noteCancel');
  const resetForm = () => { editingId = null; f.reset(); date.value = new Date().toISOString().slice(0, 10); cancel.hidden = true; document.getElementById('noteSave').textContent = 'Save note'; };
  cancel.onclick = resetForm;

  f.onsubmit = e => {
    e.preventDefault();
    const c = Store.country(KEY, MAP_NAME);
    const data = {
      title: t.value.trim(), body: body.value.trim(), date: date.value,
      tags: tags.value.split(',').map(s => s.trim()).filter(Boolean)
    };
    if (editingId) Object.assign(c.notes.find(n => n.id === editingId), data, { edited: new Date().toISOString() });
    else c.notes.unshift({ id: uid(), created: new Date().toISOString(), ...data });
    Store.save(); resetForm(); renderNotes();
  };

  document.getElementById('noteFilter').oninput = renderNotes;

  document.getElementById('notes').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const c = Store.country(KEY, MAP_NAME);
    const n = c.notes.find(n => n.id === b.dataset.id);
    if (b.dataset.act === 'del') {
      if (confirm(`Delete note “${n.title}”?`)) { c.notes = c.notes.filter(x => x !== n); Store.save(); renderNotes(); }
    } else if (b.dataset.act === 'edit') {
      editingId = n.id; t.value = n.title; body.value = n.body; tags.value = (n.tags || []).join(', '); date.value = n.date || '';
      cancel.hidden = false; document.getElementById('noteSave').textContent = 'Update note';
      f.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.focus();
    } else if (b.dataset.act === 'tag') {
      document.getElementById('noteFilter').value = b.dataset.tag; renderNotes();
    }
  });
}

function renderNotes() {
  const c = Store.country(KEY, MAP_NAME);
  const filter = document.getElementById('noteFilter').value.trim().toLowerCase();
  const list = [...c.notes]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created.localeCompare(a.created))
    .filter(n => !filter || [n.title, n.body, ...(n.tags || [])].join(' ').toLowerCase().includes(filter));
  document.getElementById('noteCount').textContent = c.notes.length || '';
  const box = document.getElementById('notes');
  box.innerHTML = list.length ? list.map(n => `
    <article class="note">
      <header>
        <h3>${esc(n.title)}</h3>
        <div class="note-actions">
          <button data-act="edit" data-id="${n.id}" title="Edit">✎</button>
          <button data-act="del" data-id="${n.id}" title="Delete">🗑</button>
        </div>
      </header>
      ${n.date ? `<time class="muted small">${new Date(n.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>` : ''}
      ${n.body ? `<p>${linkify(esc(n.body)).replace(/\n/g, '<br>')}</p>` : ''}
      ${(n.tags || []).length ? `<div class="tags">${n.tags.map(tg => `<button class="tag" data-act="tag" data-id="${n.id}" data-tag="${esc(tg)}">#${esc(tg)}</button>`).join('')}</div>` : ''}
    </article>`).join('')
    : `<p class="empty">${filter ? 'No notes match.' : 'No notes yet — plans, memories, tips, anything.'}</p>`;
}

const linkify = s => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
