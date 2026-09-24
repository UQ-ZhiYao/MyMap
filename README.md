# Travel Atlas

A personal world map of the countries you've **visited**, the ones you **know**, and the ones you've **not yet explored**. Click any country to open its page, where you can search sources, save links and write notes.

Plain HTML/CSS/JS, with no build step, so it runs on GitHub Pages as-is.

## Publish on GitHub Pages

1. Create a new repository on GitHub (e.g. `travel-atlas`).
2. Upload **the contents of this folder** (`index.html` must be at the repo root): **Add file → Upload files**, drag everything in, commit.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, then Save.
4. After about a minute your site is live at `https://<your-username>.github.io/travel-atlas/`.

## How to use

- **Map (index.html)**: countries are coloured by status. Drag to pan, scroll or use +/− to zoom, and search to jump to a country.
  - *Click a country to…* dropdown: choose **open its page** (default), or switch to **mark Visited / Known / Not yet explored** to colour many countries quickly.
- **Country page**: set the status, see quick facts and a Wikipedia summary, search Wikipedia and Wikivoyage in-page (save any result as a source), open the same search on Google, Maps, YouTube or Reddit, and write dated, tagged notes.

## Where your data lives

Everything you enter is saved in **your browser** (localStorage). That means:

- It persists between visits on the same browser and device.
- Visitors to your site **won't** see your notes unless you publish them:
  1. On the map page, click **Export**. This downloads `data.json`.
  2. Replace `data.json` in your repo with it and commit.
  3. New visitors (and your other devices) will load that data on their first visit.
- Use **Import** to load a `data.json` into another browser, and export regularly as a backup.

## Files

```
index.html        World map
country.html      Country page (country.html?c=<ISO numeric>&n=<name>)
css/style.css     Styles (light and dark mode)
js/storage.js     Data layer: localStorage, export/import, seed from data.json
js/map.js         Map rendering (D3 + world-atlas)
js/country.js     Status, facts, source search, saved sources, notes
data.json         Published data (starts empty)
.nojekyll         Tells GitHub Pages to serve files as-is
```

External services (all free, no keys): D3, topojson and world-atlas via jsDelivr; REST Countries for facts and flags; the Wikipedia and Wikivoyage APIs for summaries and search.
