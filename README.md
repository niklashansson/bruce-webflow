# bruce-webflow

Custom JavaScript for the Bruce Studios Webflow site (brucestudios.com / bruce.app).

Webflow handles the design, the CMS and the hosting. This repo holds the behaviour Webflow can't do on its own: the studio maps, the city system, sliders, modals, tabs, live campaign pricing and a number of smaller helpers. The code is plain JavaScript with no framework. Parcel bundles it into three files, and the site loads those files from the jsDelivr CDN straight out of this GitHub repo.

## How the code reaches the site

```
src/*.js  →  pnpm build  →  dist/*.js (committed)  →  git push  →  jsDelivr  →  <script> tags in Webflow
```

There is no server and no CI. The built files in `dist/` are committed to git, and jsDelivr serves whatever is on the `main` branch.

| Bundle | Loaded on | What it contains |
|---|---|---|
| `dist/index.js` | Every page (site-wide custom code) | All shared components |
| `dist/explorer.js` | The per-city studios page | The filterable studio list and its map |
| `dist/studio.js` | The studio template page | The single-studio map and directions link |

The script tags live in Webflow custom code, not in this repo. As of November 2026 they look like this:

```html
<script defer src="https://cdn.jsdelivr.net/gh/niklashansson/bruce-webflow/dist/index.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/explorer.js"></script>
```

The GitHub username is part of the URL, which matters for the handover checklist below.

## Handover checklist

These are the things that change when the repo moves from Niklas's GitHub account to Bruce Studios.

1. Move the repo and update the script URLs. The jsDelivr URLs contain `niklashansson/bruce-webflow`. Once the repo lives under a Bruce Studios account, every script tag in Webflow has to point at the new path. We have not tested what jsDelivr does with the old URLs after a GitHub transfer, so don't count on them to keep working. The safe order is: push a copy to the new account, change the script tags in Webflow, publish, check the site, and only then retire the old repo.
2. Find every script tag. Search Webflow for `niklashansson/bruce-webflow`. Look in Site settings → Custom code, in the page settings of the studios page and the studio template, and in code embeds. Then search this repo for the same string and update the purge commands further down in this file.
3. Know where the dev switch is. The code embed on the city studios page (the one that also registers the bottom sheet) holds two script tags for `explorer.js`: a commented-out one pointing at `http://localhost:1234/explorer.js` for local development, and the production one from jsDelivr. The localhost line is inside an HTML comment and never loads for visitors. This embed is also where the `explorer.js` URL has to be updated.
4. Mapbox needs no move. The access token and map style in `src/mapbox.js` have belonged to the Bruce Studios Mapbox account since October 2026. The token is a public `pk.` token and is meant to be visible in the browser. Restrict it to your domains in the Mapbox dashboard.
5. Check the other accounts. Intercom, Finsweet and the Bruce Partner API are configured outside this repo. Nothing here holds credentials for them.

## Getting started

You need Node.js and pnpm (the repo pins pnpm 10.33.0 in `package.json`).

```bash
pnpm install
pnpm start      # dev server with rebuild on save, http://localhost:1234
pnpm test       # runs every file in tests/
pnpm build      # production build into dist/
```

`pnpm start` serves `index.js`, `explorer.js` and `studio.js` from `http://localhost:1234/`. To try a change against real Webflow markup, point a script tag at localhost instead of jsDelivr. The code embed on the city studios page already has such a line commented out: uncomment it and comment out the production line while you work, publish to the staging domain only, and switch back before you publish to production.

### Tests

The tests are plain Node scripts without a test framework. Each file in `tests/` runs on its own and exits non-zero on failure. The pure logic tests need nothing else. The files that mention `dom` in their name, plus `map-features.test.mjs`, drive a real Chrome through `puppeteer-core`. They look for an installed Chrome and skip themselves if none is found. Set `CHROME_PATH` to point at a specific browser.

Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning during the tests. It is harmless.

## Deploying a change

1. Make the change in `src/` and run `pnpm test`.
2. Build from a clean state:
   ```bash
   rm -rf .parcel-cache dist && pnpm build
   ```
   Parcel's cache can go stale and report a successful build without rewriting `dist/`. Deleting the cache first avoids that. Afterwards, search the new `dist/` file for a string from your change to confirm it is in there.
3. Commit `src/` and `dist/` together and push to `main`.
4. Purge the CDN for each bundle you changed:
   ```bash
   curl -s https://purge.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/index.js
   curl -s https://purge.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/explorer.js
   curl -s https://purge.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/studio.js
   ```
5. Verify on the live site.

### Caching after a deploy

jsDelivr sends `cache-control: public, max-age=604800, s-maxage=43200` for these files, which means a pushed change is not live right away:

- The CDN can serve the previous build for up to 12 hours after a push. The purge usually fixes that, but not always: jsDelivr caches which commit `main` points to separately from the file itself, and a purge does not reliably reset that. It also throttles repeated purges of the same path, so purge once and wait.
- A visitor's browser can keep its copy for up to 7 days. You cannot purge that.
- Clearing your own browser cache or using a private window does not get around the CDN cache.

If a release has to be live immediately, pin the script tag in Webflow to a commit instead of a branch, for example `.../bruce-webflow@473460a/dist/index.js`. A pinned URL never serves stale content. In return you have to update the script tag in Webflow on every deploy.

## How the code is organised

Every module follows the same pattern. It runs by itself when the page is ready, looks for its own markup, and does nothing on pages that don't have it. That is why one `index.js` can be loaded on every page. Components are wired up through `data-` attributes set in the Webflow Designer, with a few older ones using class names.

Each file starts with a comment describing what it does and the exact markup and attributes it expects. That header is the reference for the component, so read it before changing either the code or the Webflow markup.

### Entry points

- `src/index.js` imports every site-wide module. Adding a site-wide component means adding one import line here.
- `src/explorer.js` is the per-city studios page.
- `src/studio.js` is the studio template page.

### Site-wide components (bundled into `index.js`)

| File | What it does |
|---|---|
| `nav.js` | Skip-to-content link and scroll-direction classes on the nav |
| `announcements.js` | Dismissible CMS announcements, remembered for the browser session |
| `modal.js` | `<dialog>` modals with open/close animation, openable by attribute, anchor or `?modal-id=` |
| `accordion.js` | Animated accordion lists |
| `faq.js` | Builds the two-level FAQ from two separate CMS lists, then hands over to the accordion |
| `collapsible.js` | A single expand/collapse region without group logic |
| `dropdown.js`, `dropdown-place.js` | Dropdown with keyboard support and viewport-aware placement |
| `tab.js` | Tabs with optional autoplay, accordion variant and `?tab-id=` deep links |
| `slider.js` | Swiper sliders fed from CMS lists |
| `visual-video.js` | Lazy-loaded Plyr video player |
| `variables.js` | Replaces `{{placeholders}}` in text and attributes |
| `price-format.js` | Formats raw numbers per locale (129000 → 129 000) |
| `membership-pricing.js`, `membership-pricing-format.js` | Fetches campaign prices from the Bruce API and writes them into pricing cards |
| `directions.js`, `directions-url.js` | Turns "Directions" links into Apple Maps, Google Maps or Waze links |
| `intercom.js` | Lets any button open the Intercom Messenger |
| `alert-window.js`, `alert-window-decide.js` | Hides studio alert banners outside their date window |
| `clean-link-params.js`, `clean-link-params-plan.js` | Strips empty query parameters from links built in code embeds |
| `location.js` | Shared wrapper around browser geolocation |
| `explore-map.js` | Standalone "studios near you" map section |

### The city system

The site shows different content per city, or stays neutral when no city is chosen. Six files handle this together:

| File | Role |
|---|---|
| `city-registry.js` | Reads the list of cities from a hidden CMS Collection List |
| `city-resolve.js` | Decides the active city: page lock first, then the `?city=` parameter, then the saved choice, otherwise neutral |
| `city-context.js` | Holds the active city, saves it in `localStorage` (`bruce-city`), exposes `window.bruce.city` |
| `city-visibility.js`, `city-visibility-decide.js` | Shows or hides elements per city |
| `city-switcher.js` | Buttons that change city |
| `city-links.js`, `city-links-plan.js` | Rewrites links such as `/studios` and `/memberships` to the active city's page |

The editor-facing guide for all of this is [docs/editors/city-system.md](docs/editors/city-system.md). Whoever edits content in Webflow should read it.

### Maps

| File | Role |
|---|---|
| `mapbox.js` | Access token, map style and the lazy loader for Mapbox GL |
| `map-render.js` | Shared engine for markers, popups, clusters and camera |
| `explorer.js` | Studio list with filters, counts, map mode, mobile bottom sheet, locate and "search this area" |
| `nearby-plan.js` | Logic for the explorer's "show studios in nearby areas" switch |
| `explore-map.js` | Standalone map section, uses `map-render.js` |
| `studio.js` | Single map on the studio template page |

Mapbox GL is about 460 kB, so it is only fetched when a map is about to scroll into view. Never add it as a normal script tag in the Webflow head.

### JavaScript API

A few modules expose functions on `window.bruce` for use from Webflow embeds or the browser console:

- `window.bruce.city`: read, set and subscribe to the active city
- `window.bruce.modal`: `open(id)`, `closeAll()`
- `window.bruce.location`: geolocation helpers

## What the code depends on outside this repo

### Third-party scripts

| Dependency | Loaded from | Used by |
|---|---|---|
| Swiper 12 | Script tag in Webflow site settings | `slider.js` |
| Plyr 3.8.4 | Script tag in Webflow site settings | `visual-video.js` |
| Finsweet Attributes (`fs-list`) | Webflow | `explorer.js` filtering, search and URL state |
| pure-web-bottom-sheet 0.6.0 | Code embed on the studios page | `explorer.js` mobile sheet |
| Mapbox GL JS 3.21.0 | Loaded by `mapbox.js` on demand | All maps |
| Supercluster 8 | Loaded by `map-render.js` from unpkg on demand | Map clustering |
| Intercom | Snippet in Webflow | `intercom.js` |
| Lenis | Optional, detected if present | `modal.js` scroll lock |

Swiper and Plyr are not bundled. If their script tags are removed from Webflow, sliders and videos stop working.

### Bruce API

`membership-pricing.js` calls `https://api.bruce.app/partner/membership/info` from the visitor's browser to get campaign prices. If the request fails, the prices rendered by Webflow stay as they are.

### Things that must exist in Webflow

- The hidden cities Collection List, inside a global component, so it is present on every page. The whole city system reads from it.
- The hidden city link lists (`data-city-link-list`) and gateway anchors (`data-city-gateway`) in the same global component. `city-links.js` copies the real, localised URLs from these.
- This CSS in site-wide custom code, required by `city-visibility.js`:
  ```css
  .is-city-hidden { display: none !important; }
  html:not(.wf-design-mode) body:not(.is-city-ready)
    :is([data-city-show],[data-city-hide],[data-city-none],[data-city-any]) {
    display: none;
  }
  ```
- `data-city-lock` on the body of city template pages, bound to the city's slug.

## Rules to follow

Each rule below comes from a bug we hit on this site.

- Don't use dynamic `import()`. Parcel gives lazy chunks a hashed filename. Combined with the 7-day browser cache, a visitor with an old `index.js` would request a chunk that no longer exists, and the feature would fail without any error. If a page needs its own heavy code, add a new entry file to the `build` and `start` scripts in `package.json` and load it with its own script tag.
- Never delete or move the nodes of a Finsweet-managed list. Finsweet reads the collection from the live DOM. Removing nodes breaks filtering and pagination, also for other lists on the same page. `slider.js` clones CMS items for this reason, and the helpers in `utils.js` skip Finsweet lists.
- Never set `input.checked` directly on a Finsweet filter input. Finsweet's internal state gets out of sync. Trigger a click instead.
- Never build localised URLs in JavaScript. Webflow knows the correct URL for every locale. Read it from the hidden link lists, as `city-links.js` does.
- Keep layout classes off the `<bottom-sheet>` element. The library's own `:host` styles lose against external CSS, and the sheet breaks.
- Animations that use `fill: "forwards"` lock the final value. Later inline styles won't override it. Commit the style and cancel the animation in `onfinish`. `accordion.js` shows the pattern.
- Store URL variables in Webflow without `https://`. Webflow link fields add the scheme themselves, which gives `https://https://…` otherwise.
- `dist/` is committed minified. Review changes in `src/`, not in the `dist/` diff.
- Run `node tests/dropdown-dom.test.mjs` before changing `dropdown.js`. The dropdown's placement logic has many edge cases and the test covers them.

### Pure logic is kept separate from DOM code

Files named `*-plan.js`, `*-decide.js`, `*-format.js`, `*-resolve.js` and `*-url.js` contain logic with no DOM access, and each has a test in `tests/`. The file without the suffix is the thin layer that reads the page and applies the result. New logic that can be tested without a browser should follow the same split.

## Further reading

- [docs/editors/city-system.md](docs/editors/city-system.md): the city system explained for Webflow editors.
- `docs/superpowers/specs/` and `docs/superpowers/plans/`: design documents and implementation plans for the larger features, dated. They describe why things were built the way they were. Some describe an earlier state, so trust the code and the file headers when they disagree.
- The comment at the top of each file in `src/`.
