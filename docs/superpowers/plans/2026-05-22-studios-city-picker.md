# Studios City Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the studios search "Location" filter with a single-select city picker inline in the result-count heading ("Over N studios in [City ▾]"), driven by `bruce.city` + one hidden Finsweet `city` group.

**Architecture:** Two pieces of city state stay separate — *context* (`bruce.city.current`, always concrete: map home + placeholders + persistence) and *filter* (a single hidden `fs-list-field="city"` group: list narrowing → count → "in {city}" copy). A new picker module is a thin one-way bridge: a selection calls `bruce.city.set` (context) and clicks one hidden input (narrowing); the count + map follow `studios.js`'s existing `afterRender` pipeline. Pure decision logic lives in a framework-free module with node unit tests, mirroring `studios-deep-link.js`.

**Tech Stack:** Vanilla ES modules bundled by Parcel; Finsweet List Attributes; framework-free `node:assert` tests run directly with `node`.

**Spec:** `docs/superpowers/specs/2026-05-22-studios-city-picker-design.md`

---

### Task 1: Pure decision helpers + unit tests

Framework-free helpers (no DOM, no globals) so the "which city is the initial filter selection, which hidden inputs do we click, which city is nearest" rules are unit-testable. Mirrors `src/studios-deep-link.js`.

**Files:**
- Create: `src/studios-city-select.js`
- Test: `tests/studios-city.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/studios-city.test.mjs`:

```js
// Unit tests for the studios city-picker pure helpers.
// Framework-free: run with `node tests/studios-city.test.mjs`.
// The helper module has no DOM/global deps, so importing it in Node is safe.

import assert from "node:assert/strict";
import {
  nearestCitySlug,
  resolveInitialCitySelection,
  planCityFilterClicks,
} from "../src/studios-city-select.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── nearestCitySlug ──────────────────────────────────────────
const CITIES = [
  { slug: "sto", coords: [18.07, 59.33] }, // Stockholm
  { slug: "cph", coords: [12.57, 55.68] }, // Copenhagen
  { slug: "osl", coords: [10.75, 59.91] }, // Oslo
];

check("nearest: null coords", nearestCitySlug(null, CITIES), null);
check("nearest: no city has coords", nearestCitySlug([18, 59], [{ slug: "x", coords: null }]), null);
check("nearest: near Stockholm", nearestCitySlug([18.0, 59.0], CITIES), "sto");
check("nearest: near Copenhagen", nearestCitySlug([12.6, 55.7], CITIES), "cph");
check("nearest: near Oslo", nearestCitySlug([10.8, 59.9], CITIES), "osl");

// ── resolveInitialCitySelection (strong-signal rule) ─────────
check(
  "initial: url wins over geo",
  resolveInitialCitySelection({ urlCitySlug: "cph", geoNearestSlug: "sto" }),
  "cph",
);
check(
  "initial: geo when no url",
  resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: "sto" }),
  "sto",
);
check(
  "initial: all when no signal",
  resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: null }),
  "all",
);

// ── planCityFilterClicks ─────────────────────────────────────
// Single-select hidden group. Works in fs-list-value (city name) terms.
check("plan: no-op both null", planCityFilterClicks({ targetValue: null, currentValue: null }), []);
check("plan: no-op same value", planCityFilterClicks({ targetValue: "Stockholm", currentValue: "Stockholm" }), []);
check("plan: engage from none", planCityFilterClicks({ targetValue: "Stockholm", currentValue: null }), ["Stockholm"]);
check("plan: clear to all", planCityFilterClicks({ targetValue: null, currentValue: "Stockholm" }), ["Stockholm"]);
check(
  "plan: switch cities (uncheck old, check new)",
  planCityFilterClicks({ targetValue: "Copenhagen", currentValue: "Stockholm" }),
  ["Stockholm", "Copenhagen"],
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/studios-city.test.mjs`
Expected: FAIL — `Cannot find module '.../src/studios-city-select.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/studios-city-select.js`:

```js
/**
 * Pure decision helpers for the studios heading city picker
 * (studios-city-filter.js). Framework-free (no DOM, no globals) so the
 * "which city is the initial filter selection, which hidden inputs do we
 * click, and which city is nearest" rules live in one unit-testable place —
 * mirroring studios-deep-link.js.
 */

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance (km) between two [lng, lat] points.
 * @param {[number, number]} a
 * @param {[number, number]} b
 */
function haversineKm(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(s));
}

/**
 * Nearest city slug to a [lng, lat] coord, or null when coords is null or no
 * city has coords.
 * @param {[number, number] | null} coords
 * @param {{ slug: string, coords: [number, number] | null }[]} cities
 * @returns {string | null}
 */
export function nearestCitySlug(coords, cities) {
  if (!coords) return null;
  let best = null;
  let bestDist = Infinity;
  for (const c of cities) {
    if (!c.coords) continue;
    const d = haversineKm(coords, c.coords);
    if (d < bestDist) {
      bestDist = d;
      best = c.slug;
    }
  }
  return best;
}

/**
 * The initial FILTER selection at page load (strong-signal rule): a ?city=
 * deep-link or geo-if-granted engages the filter; everything else (saved
 * choice, CMS default) leaves it OFF ("all").
 *
 * @param {{ urlCitySlug: string | null, geoNearestSlug: string | null }} input
 * @returns {string} a city slug, or "all"
 */
export function resolveInitialCitySelection({ urlCitySlug, geoNearestSlug }) {
  if (urlCitySlug) return urlCitySlug;
  if (geoNearestSlug) return geoNearestSlug;
  return "all";
}

/**
 * The hidden city inputs to .click(), in order, to move the single-select
 * Finsweet city group from its current checked value to the target. Works in
 * fs-list-value terms (the city name); the DOM layer maps slug -> value.
 * Mirrors the "one genuine click per change" rule so we never leave two copies
 * checked, and is idempotent when already on the target.
 *
 * @param {{ targetValue: string | null, currentValue: string | null }} input
 *   targetValue  value to end up checked, or null for "all" (none checked)
 *   currentValue value currently checked, or null when none is
 * @returns {string[]} values to click, in order
 */
export function planCityFilterClicks({ targetValue, currentValue }) {
  if (targetValue === currentValue) return [];
  const clicks = [];
  if (currentValue !== null) clicks.push(currentValue); // uncheck old
  if (targetValue !== null) clicks.push(targetValue); // check new
  return clicks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/studios-city.test.mjs`
Expected: PASS — `✓ all 13 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/studios-city-select.js tests/studios-city.test.mjs
git commit -m "Add pure helpers for studios city picker (nearest/initial/clicks)"
```

---

### Task 2: City picker DOM module (the bridge)

The browser-side module: wires the heading dropdown, drives `bruce.city` + the single hidden Finsweet `city` group, and runs the strong-signal initial engagement inside the Finsweet list callback. No `bruce.city.onChange` subscription — the heading reflects the *filter*, so a context change from elsewhere must never engage it.

**Files:**
- Create: `src/studios-city-filter.js`

- [ ] **Step 1: Write the module**

Create `src/studios-city-filter.js`:

```js
/**
 * Studios Heading City Picker (search page only)
 *
 * Replaces the old toolbar "Location" filter with a single-select city picker
 * inline in the result-count heading ("Over N studios in [City ▾]"). The
 * picker is the ONLY city control on the page and drives a single hidden
 * Finsweet `city` group, so the never-synced duplicate filter copies are gone.
 *
 * bruce.city is the source of truth for CONTEXT (map home + placeholders +
 * persistence). This module is a thin one-way bridge: a picker selection ->
 * bruce.city.set (context) + a hidden Finsweet input click (narrowing) -> the
 * count + map follow studios.js's afterRender pipeline. The heading reflects
 * the FILTER selection only and never reacts to context changes elsewhere.
 *
 * Auto-boot is guarded against a missing `document` so the module stays
 * importable in Node.
 */

import {
  nearestCitySlug,
  resolveInitialCitySelection,
  planCityFilterClicks,
} from "./studios-city-select.js";
import { shouldApplyDeepLinkFilters } from "./studios-deep-link.js";
import { requestUserLocation } from "./location.js";

const FS_LIST_INSTANCE_KEY = "studios";
const FILTERS_FORM = 'form[fs-list-element="filters"]';
const PICKER = "[data-studios-city-picker]";
const LABEL = "[data-studios-city-label]";
const OPTION = "[data-studios-city-option]";
const ALL_OPTION = '[data-studios-city-option="all"]';
const CITY_INPUT = 'input[fs-list-field="city"]';
const ACTIVE_ATTR = "data-studios-city-active";
const ALL = "all";

// PerformanceNavigationTiming.type for this load, or "navigate" where the API
// is unavailable (treated as a fresh inbound visit -> safe to engage).
function getNavigationType() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return /** @type {any} */ (nav)?.type ?? "navigate";
}

const cityApi = () => /** @type {any} */ (window).bruce?.city;

// slug -> the fs-list-value of the hidden inputs (the CMS city name).
function cityName(slug) {
  return cityApi()?.all?.().find((c) => c.slug === slug)?.name ?? null;
}

// fs-list-value of the currently-checked hidden city input, or null.
function checkedCityValue(form) {
  const checked = form.querySelector(`${CITY_INPUT}:checked`);
  return checked ? checked.getAttribute("fs-list-value") : null;
}

// Move the hidden single-select city group to `slug` (or null = all). One
// genuine click per change so we never leave two copies checked.
function syncHiddenFilter(form, slug) {
  const targetValue = slug ? cityName(slug) : null;
  const currentValue = checkedCityValue(form);
  for (const value of planCityFilterClicks({ targetValue, currentValue })) {
    const input = form.querySelector(
      `${CITY_INPUT}[fs-list-value="${CSS.escape(value)}"]`,
    );
    if (input) /** @type {HTMLElement} */ (input).click();
  }
}

function allLabel(picker) {
  return picker.querySelector(ALL_OPTION)?.textContent?.trim() || "All cities";
}

function updateLabel(picker, text) {
  const label = picker.querySelector(LABEL);
  if (label) label.textContent = text;
}

// `selection` is a city slug or "all".
function markActive(picker, selection) {
  picker.querySelectorAll(OPTION).forEach((el) => {
    const value = el.getAttribute("data-studios-city-option");
    el.setAttribute(ACTIVE_ATTR, value === selection ? "true" : "false");
  });
}

// Set the heading's label + active state without touching the hidden inputs.
function reflectSelection(picker, selection) {
  updateLabel(picker, selection === ALL ? allLabel(picker) : cityName(selection) ?? "");
  markActive(picker, selection);
}

// Full selection: drive context (bruce.city) + the hidden filter + the heading.
function applyCitySelection(picker, form, selection) {
  if (selection !== ALL) cityApi()?.set?.(selection); // context: map + placeholders
  syncHiddenFilter(form, selection === ALL ? null : selection);
  reflectSelection(picker, selection);
}

// Nearest city from geolocation, but ONLY if permission is already granted --
// never triggers a cold prompt. null on no permission / no fix / no coords.
async function resolveGrantedGeoCity() {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    if (status?.state !== "granted") return null;
  } catch {
    return null; // Permissions API unsupported -> never prompt.
  }
  const coords = await requestUserLocation();
  return nearestCitySlug(coords, cityApi()?.all?.() ?? []);
}

// Strong-signal initial engagement. Runs after Finsweet has bound the list.
async function engageInitial(picker, form) {
  const urlCitySlug = cityApi()?.urlSelection?.()[0]?.slug ?? null;
  const replay = shouldApplyDeepLinkFilters(getNavigationType());

  if (urlCitySlug) {
    if (replay) {
      applyCitySelection(picker, form, urlCitySlug);
    } else {
      // Back/forward: Finsweet restores the hidden city input itself from the
      // URL it owns. Don't re-click (would double-check + desync). Mirror the
      // URL city into context + heading only.
      cityApi()?.set?.(urlCitySlug);
      reflectSelection(picker, urlCitySlug);
    }
    return;
  }

  // No ?city= -> default to "all"; a granted-geo fix may upgrade it.
  applyCitySelection(picker, form, ALL);
  if (!replay) return; // back/forward with no city -> leave at all
  const geoSlug = await resolveGrantedGeoCity();
  if (geoSlug) {
    applyCitySelection(
      picker,
      form,
      resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: geoSlug }),
    );
  }
}

function setupPicker(picker, form) {
  picker.addEventListener("click", (e) => {
    const opt = /** @type {Element} */ (e.target)?.closest?.(OPTION);
    if (!opt || !picker.contains(opt)) return;
    const selection = opt.getAttribute("data-studios-city-option");
    if (selection) applyCitySelection(picker, form, selection);
  });
}

// Defer to Finsweet's list callback so the initial hidden-input clicks land
// AFTER FS has bound the form (clicking earlier no-ops). studios.js registers
// its own "list" callback at module top-level (import time); ours registers on
// DOMContentLoaded, so its hooks are wired before our engagement runs.
function boot() {
  const picker = document.querySelector(PICKER);
  const form = document.querySelector(FILTERS_FORM);
  if (!(picker instanceof HTMLElement) || !(form instanceof HTMLElement)) return;

  /** @type {any} */ (window).FinsweetAttributes ||= [];
  /** @type {any} */ (window).FinsweetAttributes.push([
    "list",
    (listInstances) => {
      const hasStudios = listInstances.some(
        (i) => i.instance === FS_LIST_INSTANCE_KEY,
      );
      if (!hasStudios || picker.dataset.cityPickerInit) return;
      picker.dataset.cityPickerInit = "true";
      setupPicker(picker, form);
      engageInitial(picker, form);
    },
  ]);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
```

- [ ] **Step 2: Wire it into the studios bundle**

Add the side-effect import at the top of `src/studios.js`, just after the existing imports (after the `./mapbox.js` import block, around line 26):

```js
import "./studios-city-filter.js";
```

- [ ] **Step 3: Verify the bundle builds**

Run: `rm -rf .parcel-cache dist && pnpm build`
Expected: build succeeds; `dist/studios.js` is produced with no errors. (The `rm -rf` avoids the known stale-cache trap.)

- [ ] **Step 4: Verify the existing tests still pass**

Run: `node tests/studios-city.test.mjs && node tests/studios-search-query.test.mjs`
Expected: both print their `✓ all N assertions passed` lines.

- [ ] **Step 5: Commit**

```bash
git add src/studios-city-filter.js src/studios.js
git commit -m "Add studios heading city picker bridge to hidden Finsweet city filter"
```

---

### Task 3: Update studios.js — own city via the picker, fit-all on "all cities"

Two changes in `src/studios.js`: stop the generic deep-link replay from touching `city` (the picker owns it), and make a fully-cleared filter state fit all features instead of flying to the context city (the new explicit "all cities" intent).

**Files:**
- Modify: `src/studios.js` (deep-link loop ~line 1156; `render()` clear branch ~line 882; `hasActiveFilters` ~line 1077)

- [ ] **Step 1: Skip the `city` field in the deep-link replay**

In `applyUrlDeepLinkFilters`, the loop that buckets params by field currently skips only `q`:

```js
  for (const [key, value] of params) {
    if (key === "q") continue;
    const set = byField.get(key) ?? new Set();
    set.add(value);
    byField.set(key, set);
  }
```

Change the skip condition so `city` is left to the picker:

```js
  for (const [key, value] of params) {
    // `q` has its own handling below; `city` is owned by the heading picker
    // (studios-city-filter.js), which applies it to the hidden city filter.
    if (key === "q" || key === "city") continue;
    const set = byField.get(key) ?? new Set();
    set.add(value);
    byField.set(key, set);
  }
```

- [ ] **Step 2: Fit all features when the filter state is fully cleared**

In `render()`, the current block flies back to the context city when all filters are cleared:

```js
      const returnedToCity =
        fit &&
        initialRenderDone &&
        !hasActiveFilters() &&
        flyToCity();
      if (!returnedToCity && (fit || !initialRenderDone)) {
        fitToFeatures(map, features, sheetCoverage());
      }
```

Replace it so a cleared state ("All cities") fits the whole set; a concrete city stays framed by `fitToFeatures(filtered set)` / the `onChange -> flyToCity` path:

```js
      // Clearing every filter now means an explicit "All cities" view (the
      // heading city picker owns city), so fit the whole set rather than
      // flying back to the context city. A concrete city selection arrives as
      // a narrowed `features` set and is framed by fitToFeatures below.
      if (fit || !initialRenderDone) {
        fitToFeatures(map, features, sheetCoverage());
      }
```

- [ ] **Step 3: Remove the now-unused `hasActiveFilters`**

`hasActiveFilters` was only used by the branch removed in Step 2. Delete the whole function and its doc comment (the block starting `// True when any filter is currently engaged:` through the closing `}` of `function hasActiveFilters()`, ~lines 1072–1090).

- [ ] **Step 4: Verify build + tests**

Run: `rm -rf .parcel-cache dist && pnpm build && node tests/studios-city.test.mjs && node tests/studios-search-query.test.mjs`
Expected: build succeeds with no "hasActiveFilters is not defined" reference error; both test files pass.

- [ ] **Step 5: Verify no dangling references**

Run: `grep -n "hasActiveFilters" src/studios.js`
Expected: no output (zero matches).

- [ ] **Step 6: Commit**

```bash
git add src/studios.js
git commit -m "Hand city ownership to the heading picker; fit-all on cleared filters"
```

---

### Task 4: Webflow markup + manual verification

The heading dropdown and the hidden city group are authored in Webflow Designer (not in the repo). This task is the authoring contract and the manual verification checklist; there is no code commit.

**Authoring contract** (Designer, on the `/s` page, inside the studios component):

1. **Heading picker** — inside the result-count heading, after the existing `[data-studios-element="count-display"]` block and the static word "in":

```html
<span data-dropdown-element="wrap" data-studios-city-picker>
  <button data-dropdown-element="toggle">
    <span data-studios-city-label>All cities</span>
  </button>
  <div data-dropdown-element="content">
    <button data-studios-city-option="all">All cities</button>
    <!-- Collection List of cities -> one button per item: -->
    <button data-studios-city-option="{{city-slug}}">{{city-name}}</button>
  </div>
</span>
```
- `data-studios-city-option` is `all` on the all-cities button, and the city **slug** on each concrete button (must match `bruce.city` slugs / `data-city-slug`).
- The concrete button's visible text is the city name.
- Style the active option off `[data-studios-city-active="true"]` (the module sets it). Do NOT rely on `data-city-active` here (that tracks context, not the filter).

2. **Hidden city filter group** — inside `form[fs-list-element="filters"]`, one input per city:

```html
<div data-studios-city-filter hidden>
  <label><input type="checkbox" fs-list-field="city" fs-list-value="{{city-name}}"></label>
  <!-- one per city -->
</div>
```
- `fs-list-value` must exactly match the studio item's city field text (the value the redirect emits, e.g. `Stockholm`).
- Field key is `city` (confirmed) — `fs-list-field="city"`.

3. **Remove** the city option from the toolbar "Location" dropdown, the filter modal, and the nav searchbar — the picker is now the only city control on `/s`.

- [ ] **Step 1: Author the markup above in Webflow and publish to a staging/preview where the built `dist/studios.js` is loaded.**

- [ ] **Step 2: Manual verification — selection**

  - [ ] Land on `/s` with no `?city=`, geolocation not granted → heading reads "Over N studios" with the picker showing "All cities"; the full list shows; map fits all.
  - [ ] Open the picker, choose a city → list narrows to that city, count + "in {city}" update, map recenters on the city, page phone/`{{city-name}}` placeholders update.
  - [ ] Choose "All cities" → list returns to the full set, count back to the total, map fits all.
  - [ ] The active option carries `data-studios-city-active="true"` (inspect) and styles correctly.

- [ ] **Step 3: Manual verification — deep-link + geo**

  - [ ] Visit `/s?city=Stockholm` directly → lands engaged on Stockholm (list narrowed, label "Stockholm", map on Stockholm).
  - [ ] Visit `/s?city=Bergen&city=Oslo` → engages the first (Bergen); a single `console.warn` notes the dropped extra (confirm warn text references the dropped city).
  - [ ] With location permission already granted for the site, land on `/s` with no `?city=` → picker auto-selects the nearest city.
  - [ ] With location permission NOT granted, land on `/s` → no permission prompt appears; picker stays "All cities".

- [ ] **Step 4: Manual verification — interplay**

  - [ ] Select a city, then a Category → both apply (list = city ∩ category); clear Category → still narrowed to the city (map stays on the city).
  - [ ] Finsweet "Reset all" → city clears too (back to "All cities" + full set).
  - [ ] Navigate away from a `/s?city=X` state and use the browser Back button → list is still narrowed to X (Finsweet restore), with no duplicate/desync (toggling a filter afterward still works correctly).

- [ ] **Step 5: Known limitation to confirm acceptable**

  - [ ] After picking an option, the dropdown menu stays open until a click-outside/Escape (dropdown.js owns open/close; in-menu option clicks don't auto-close). Confirm this is acceptable, or file a separate follow-up to add a `data-dropdown-close` convention to `dropdown.js`. Out of scope here.

---

## Self-Review

**Spec coverage:**
- State model (context vs filter) → Tasks 2 (`applyCitySelection` splits `bruce.city.set` from `syncHiddenFilter`) + 4 (markup).
- Markup contract (heading picker, hidden group, removals) → Task 4.
- New module + bridge + desync handling → Task 2 (`syncHiddenFilter` + `planCityFilterClicks`).
- Strong-signal initial engagement (url / geo-if-granted / all) + back/forward → Task 2 (`engageInitial`) + Task 1 (`resolveInitialCitySelection`).
- Geo if already granted (Permissions API, nearest city) → Task 2 (`resolveGrantedGeoCity`) + Task 1 (`nearestCitySlug`).
- studios.js camera fit-all on clear → Task 3 Step 2.
- studios.js deep-link skips city → Task 3 Step 1.
- "All cities" behavior + placeholders → Tasks 2 (`reflectSelection`/context untouched) + 4 (verify).
- Inbound multi-city edge case → Task 4 Step 3 (verify the warn). NOTE: the single `console.warn` for dropped extra cities is already emitted by `city.js` `citiesFromUrl()`; no new code needed — Task 4 only verifies it.
- Testing → Task 1 (units) + Task 4 (manual).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output.

**Type/name consistency:** `applyCitySelection`, `syncHiddenFilter`, `reflectSelection`, `resolveGrantedGeoCity`, `engageInitial`, `nearestCitySlug`, `resolveInitialCitySelection`, `planCityFilterClicks` are used identically across Tasks 1–3. Constants (`CITY_INPUT`, `ALL`, `ACTIVE_ATTR`, attribute names) match the Task 4 markup contract (`fs-list-field="city"`, `data-studios-city-option`, `data-studios-city-active`, `data-studios-city-picker`, `data-studios-city-label`, `data-studios-city-filter`).

**Adjustment from self-review:** The inbound multi-city `console.warn` is provided by existing `city.js` code, so Task 4 verifies rather than implements it — corrected the wording in Step 3 / coverage above.
