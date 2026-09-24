/* Travel Atlas — shared data layer (localStorage + JSON export/import) */
const STORE_KEY = 'travel-atlas-v1';

const STATUS = {
  visited: { label: 'Visited', short: 'Been there' },
  known:   { label: 'Known',   short: 'Know about it' },
  none:    { label: 'Not yet explored', short: 'Not explored' }
};

const Store = {
  _data: null,

  get() {
    if (this._data) return this._data;
    try { this._data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { this._data = null; }
    if (!this._data || typeof this._data !== 'object') this._data = { countries: {} };
    if (!this._data.countries) this._data.countries = {};
    return this._data;
  },

  save() {
    this._data.updated = new Date().toISOString();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this._data)); }
    catch (e) { alert('Could not save — browser storage is unavailable or full. Use Export to back up.'); }
  },

  /* First visit: seed from data.json in the repo (your published data) */
  async init() {
    let hasLocal = false;
    try { hasLocal = !!localStorage.getItem(STORE_KEY); } catch (e) {}
    if (!hasLocal) {
      try {
        const res = await fetch('data.json', { cache: 'no-store' });
        if (res.ok) {
          const seed = await res.json();
          if (seed && seed.countries) { this._data = seed; this.save(); }
        }
      } catch (e) { /* no seed file — start empty */ }
    }
    return this.get();
  },

  country(key, name) {
    const d = this.get();
    if (!d.countries[key]) d.countries[key] = { name: name || key, status: 'none', notes: [], sources: [] };
    const c = d.countries[key];
    if (name && !c.name) c.name = name;
    c.notes = c.notes || []; c.sources = c.sources || [];
    return c;
  },

  peek(key) { return this.get().countries[key] || null; },

  statusOf(key) { const c = this.peek(key); return (c && c.status) || 'none'; },

  setStatus(key, name, status) {
    const c = this.country(key, name);
    c.status = status;
    if (status === 'visited' && !c.visitedOn) c.visitedOn = '';
    this.save();
  },

  export() {
    const blob = new Blob([JSON.stringify(this.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  import(file) {
    return file.text().then(txt => {
      const d = JSON.parse(txt);
      if (!d || !d.countries) throw new Error('Not a Travel Atlas file');
      this._data = d; this.save();
    });
  },

  reset() { this._data = { countries: {} }; this.save(); }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = (k) => new URLSearchParams(location.search).get(k);
