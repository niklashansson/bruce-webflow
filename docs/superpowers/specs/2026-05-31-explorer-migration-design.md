# Explorer migration — design & migration plan

**Date:** 2026-05-31
**Goal:** Migrate the studios list/map experience from `src/studios.js` to a new `src/explorer.js`, built against the redesigned per-city "explorer" page. `explorer.js` replaces `studios.js` entirely when done. Migrate one piece at a time.

---

## 1. What changed vs. studios.js

The new page is a **per-city, content-first** page — a fundamentally different model from the old single-page sidebar+map.

| | Old (`studios.js`) | New (`explorer.js`) |
|---|---|---|
| City | client-side Finsweet filter | **URL path** (`/studios/city/<slug>`); CMS pre-scopes the list. City dropdown = nav links. |
| Layout | always-on sidebar+map (desktop) / bottom-sheet (mobile) | content page (header → collections → filtered grid); **map is toggled** |
| Filters | location + tier + category + search | **tier + category + search** (no client-side city) |
| Attributes | `data-studios-*`, fs-instance `studios` | `data-explorer-*`, fs-instance `explorer-results` |
| Discovery | none | curated collection sliders (Popular categories / studios / New) |

**Finsweet instance:** `fs-list-instance="explorer-results"`, `fs-list-load="pagination"`.

---

## 2. UX model (decided)

Two page states + an orthogonal map toggle:

| | Browse (default) | Searching (any filter/search active) |
|---|---|---|
| Curated collections | shown | **hidden** |
| Results grid | shown | shown (rises to top) |
| Map | manual toggle | manual toggle |

- **Map is always a manual toggle** (the "Map" button) — it never auto-opens. Filtering only collapses the collections.
- **Desktop map mode = split** — map panel beside the results grid (grid reflows narrower). No bottom-sheet.
- **Mobile map mode = full-screen overlay + bottom-sheet** — the sheet holds **only the result list** (re-parented, not cloned). Collections never appear in the sheet, which resolves the "collections vs. map" tension.

Rationale: curated collections are a city-wide *discovery* device with no meaning on a map; the map answers a *spatial* question about the filtered set. The two never need to coexist.

---

## 3. Module boundaries

The explorer page already loads **`index.js`** (global bundle), which owns: `nav`, `dropdown`, `modal` (the filter dialog), `slider` (the discovery carousels), `city` context, `city-visibility`, `variables`, `location`. The explorer page therefore needs **two script tags**: `index.js` (globals) + `explorer.js` (page).

**`explorer.js` owns only:**
- Finsweet `explorer-results` integration (filter / afterRender hooks)
- Count display (`data-explorer-count-*`)
- `loading/filtering/ready/empty` state machine on `main.explorer_wrap`
- Filter-count badges (`data-search-count` / `data-search-group`) — keyed by `fs-list-field`
- Collections-hide-when-filtered (`data-explorer-filtered` on `.explorer_wrap`)
- The entire map mode: toggle + split/overlay layout, lazy mapbox, markers, popups, clustering, locate, search-this-area, mobile bottom-sheet

**URL / deep-links:** handled by **Finsweet native query URL** (`fs-list-showquery="true"`), confirmed to restore-on-load and reflect-to-URL cleanly across the duplicate toolbar/modal filter copies. The bespoke `studios-deep-link.js` replay is NOT ported.

**Dropped from studios.js (per-city makes them dead):** `studios-city-filter.js`, `studios-city-select.js`, the hidden Finsweet `city` group, `bruce.city.urlSelection()` camera logic, `setupResponsiveContent` (content-mover), the always-on two-pane layout.

**Carried over (rename `data-studios-*` → `data-explorer-*`):** feature extraction, supercluster clustering, marker/popup rendering, fit-to-features, locate (`location.js`), search-this-area, sheet height/coverage math (mobile map mode only). Shared `mapbox.js` loader is reused as-is.

---

## 4. Markup contract (hooks confirmed present)

- **List:** `[fs-list-instance="explorer-results"]`; items `.explorer_results_item`
- **Per-item data:** `[data-explorer-field="studio-id|studio-lat|studio-lng"]`; FS fields `tier` (base/black/epic), `tiers`, `category`, `name`, `city`, `new`, `popular`
- **Marker template:** `<button data-explorer-element="studio-marker">` (img + sr-only name)
- **Popup template:** `[data-explorer-element="studio-popup"]`
- **Cluster template:** `[data-explorer-element="cluster-template"]` with inner `[data-explorer-field="count"]`; sizes via `data-size="md|lg|xl"`
- **User-location template:** `[data-explorer-element="user-location-template"]`
- **Map target / region:** `[data-explorer-element="map-target"]` inside `.explorer_map_wrap[role="region"]`
- **Map controls:** `[data-explorer-element="search-area"]` (CSS-hidden unless `.is-active`), `[data-explorer-element="locate"]` (filter bar + map panel)
- **Count:** `.explorer_count` (`aria-live`) → `.explorer_count_text` with `[data-explorer-count-mode="singular|plural|over"]` (`.is-active` reveals one) + `[data-explorer-count-slot]`; `.explorer_count_skeleton`
- **State:** JS sets `data-state` on `main.explorer_wrap` → (default `loading`) / `ready` / `filtering` / `empty`
- **Map toggle:** the "Map" `button[aria-label="Map"]` — JS adds/flips `aria-pressed`
- **City coords:** read active city from `[data-city-list]` matched to `<html data-wf-item-slug>` / URL slug
- **Filter chrome:** `data-search-group` = `tier` / `category`; clear `fs-list-element="clear"` + `fs-list-field`; count `[data-search-count="<group>"]` and a global `[data-search-count]` total
- **Collections section:** `.explorer_discovery_wrap` (toggle hidden when filtered)

---

## 5. Migration order (one shippable piece at a time)

1. **Scaffold** — add `explorer.js` as a Parcel entry (build/start scripts); add the page `<script>` (dev `localhost:1234/explorer.js`, prod `dist/explorer.js`). Bind to `explorer-results`; verify attach. No behavior yet.
2. **List foundation** — count display + the `loading/filtering/ready/empty` state machine. *Page works as a live filterable grid; no mapbox.*
3. **Filter chrome** — filter-count badges (keyed by `fs-list-field`, deduped across the toolbar/modal copies) + collections-hide-when-filtered. URL handled natively by Finsweet (`fs-list-showquery`), no replay. *All filter UX done, still no map.*
4. **Map shell** — Map-button toggle (desktop split / mobile overlay), `aria-pressed`, lazy mapbox on first open, center on page city, point markers + popups + fit-to-features. *Core spatial view.*
5. **Clustering** — port supercluster + cluster markers + render-bbox.
6. **Mobile bottom-sheet** — register the web component in `<head>`; add the sheet host + list mount inside `explorer_map_layout`; re-parent the FS list in/out; sheet height/coverage math so markers/popups clear the sheet.
7. **Interactions + cutover** — locate + search-this-area; switch the page script to `explorer.js`; retire `studios.js`, `studios-city-filter.js`, `studios-city-select.js` and drop them from the build.

Steps 1–3 ship a fully working filterable page before any mapbox bytes load. The map is built bottom-up (markers → clusters → sheet → interactions).

---

## 6. Known follow-ups (non-blocking)

- **Map button `aria-pressed`** — set from JS (step 4).
- **Duplicate "Spa"** category appears twice in the CMS — dedupe.
- **Data quirk:** some studios carry coordinates from another city (e.g. a "Malmö" studio with Stockholm lat/lng) — surfaces as a stray marker; CMS data, not code.
- **Bottom-sheet gotchas:** never put layout-affecting Webflow classes on the `<bottom-sheet>` host (`:host` loses to external CSS); list in the sheet is the same FS-bound list re-parented, not cloned.
- **Build hygiene:** `rm -rf .parcel-cache dist` before release builds (stale-cache gotcha); jsDelivr caches `@main` up to 7 days.
