# Travel Atlas

A personal world map of the countries you've **visited**, the ones you **know**, and the ones you've **not yet explored**. Click any country to open its page, where you can search sources, save links and write notes.

Plain HTML/CSS/JS, with no build step, so it runs on GitHub Pages as-is.

## Publish on GitHub Pages

1. Create a new repository on GitHub (e.g. `travel-atlas`).
2. Upload **the contents of this folder** (`index.html` must be at the repo root): **Add file → Upload files**, drag everything in, commit.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, then Save.
4. After about a minute your site is live at `https://<your-username>.github.io/travel-atlas/`.

## Turn on Google Maps

The map works out of the box with a built-in world map. To use Google Maps instead:

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project and attach a billing account (Google requires one even for free usage).
2. **APIs & Services → Library**: enable **Maps JavaScript API**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key (important, because it is visible in your site's code):
   - *Application restrictions*: **Websites**, and add `https://<your-username>.github.io/*`
   - *API restrictions*: **Maps JavaScript API** only
5. Open `js/config.js`, replace `YOUR_API_KEY` with your key, and commit.

If the key is missing or Google can't load, the site falls back to the built-in map. If Google rejects the key, a red message appears above the map. Check Google's pricing page for the current free allowance, and consider setting a budget alert in Cloud Console.

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
js/config.js      Your Google Maps API key goes here
js/map.js         Map rendering (Google Maps, or built-in D3 map without a key)
js/country.js     Status, facts, source search, saved sources, notes
data.json         Published data (starts empty)
.nojekyll         Tells GitHub Pages to serve files as-is
```

External services (free, no keys, apart from the optional Google Maps key): D3, topojson and world-atlas via jsDelivr; REST Countries for facts and flags; the Wikipedia and Wikivoyage APIs for summaries and search.
