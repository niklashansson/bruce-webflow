# City System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing city module with a from-scratch system: two-tier authority (URL lock vs. ambient preference), neutral-by-default static pages, and four attribute-driven visibility controls — plus a marketing-editor guide.

**Architecture:** Five focused modules. Pure helpers (`cityFromAttrs`, `resolveActiveCity`, `buildPlaceholders`, `decideVisibility`) hold all the logic and are unit-tested with Node; thin DOM shells wire them to the page and are verified manually on staging. One hidden CMS Collection List is the city registry; `window.bruce.city` exposes the active city to subscribers.

**Tech Stack:** Vanilla ES modules bundled with Parcel. Tests are framework-free `.mjs` files run with `node` (see `tests/city-visibility-decide.test.mjs` for the existing convention: a `check(label, actual, expected)` helper over `node:assert/strict`). No DOM in tests — pure helpers only.

**Spec:** `docs/superpowers/specs/2026-06-02-city-system-design.md`

---

## File structure

| File | Responsibility | Tested |
|---|---|---|
| `src/city-registry.js` | `cityFromAttrs(attrs)` (pure) + `readCityList()` (DOM). Parse the hidden `[data-city-list]` into city objects. | pure: yes |
| `src/city-resolve.js` | `resolveActiveCity()` + `buildPlaceholders()` — pure, **no imports** (so it is Node-testable; mirrors how `city-visibility-decide.js` is split from `city-visibility.js`). | yes |
| `src/city-context.js` | DOM/localStorage shell, `window.bruce.city` API, boot. Imports the pure helpers from `city-resolve.js`. | manual |
| `src/city-visibility-decide.js` | `decideVisibility(attrs, activeSlug, cities)` (pure). Four-attribute visibility matrix. | yes |
| `src/city-visibility.js` | DOM sweep, `is-city-hidden`/`is-city-ready`, observer + safety passes. | manual |
| `src/city-switcher.js` | `data-set-city` in-place switching + `data-city-active` sync. | manual |
| `docs/editors/city-system.md` | Plain-language editor guide. | — |

**City object shape (used everywhere):** `{ slug: string, name: string, vars: Record<string,string>, coords: [number,number] | null }`.

**Deleted:** `src/city.js`. **Rewritten:** `src/city-visibility.js`, `src/city-visibility-decide.js`, `tests/city-visibility-decide.test.mjs`. **Modified:** `src/index.js`.

---

## Task 1: Registry parsing (`cityFromAttrs`)

**Files:**
- Create: `src/city-registry.js`
- Test: `tests/city-registry.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/city-registry.test.mjs`:

```js
// Unit tests for the city-registry pure parser.
// Framework-free: run with `node tests/city-registry.test.mjs`.
import assert from "node:assert/strict";
import { cityFromAttrs } from "../src/city-registry.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

check(
  "full item → slug, name, vars, coords",
  cityFromAttrs({
    "data-city-slug": "sto",
    "data-city-name": "Stockholm",
    "data-city-var-phone": "+46 8 123",
    "data-city-var-lat": "59.33",
    "data-city-var-lng": "18.07",
  }),
  {
    slug: "sto",
    name: "Stockholm",
    vars: { phone: "+46 8 123", lat: "59.33", lng: "18.07" },
    coords: [18.07, 59.33],
  },
);

check(
  "missing slug → null",
  cityFromAttrs({ "data-city-name": "Nowhere" }),
  null,
);

check(
  "blank slug → null",
  cityFromAttrs({ "data-city-slug": "   ", "data-city-name": "X" }),
  null,
);

check(
  "missing name → empty string name",
  cityFromAttrs({ "data-city-slug": "cph" }),
  { slug: "cph", name: "", vars: {}, coords: null },
);

check(
  "invalid lat/lng → coords null",
  cityFromAttrs({
    "data-city-slug": "osl",
    "data-city-name": "Oslo",
    "data-city-var-lat": "abc",
    "data-city-var-lng": "10.7",
  }),
  { slug: "osl", name: "Oslo", vars: { lat: "abc", lng: "10.7" }, coords: null },
);

check(
  "slug/name trimmed",
  cityFromAttrs({ "data-city-slug": "  sto  ", "data-city-name": "  Stockholm  " }),
  { slug: "sto", name: "Stockholm", vars: {}, coords: null },
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/city-registry.test.mjs`
Expected: FAIL — `Cannot find module '../src/city-registry.js'` (or `cityFromAttrs is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `src/city-registry.js`:

```js
/**
 * City Registry
 *
 * Reads the hidden CMS Collection List (`[data-city-list]`) into typed city
 * objects. `cityFromAttrs` is a pure parser (one attribute map → one city)
 * so it is unit-testable without a DOM; `readCityList` is the thin DOM shell.
 *
 * Each city: { slug, name, vars, coords }. `vars` are the `data-city-var-*`
 * values keyed by the suffix; `coords` is [lng, lat] (Mapbox order) parsed
 * from `data-city-var-lat` / `-lng`, or null when either is missing/invalid.
 */

const VAR_PREFIX = "data-city-var-";

/**
 * @param {Record<string, string>} attrs  element attribute name→value map
 * @returns {{slug: string, name: string, vars: Record<string,string>, coords: [number,number]|null} | null}
 */
export function cityFromAttrs(attrs) {
  const slug = (attrs["data-city-slug"] ?? "").trim();
  if (!slug) return null;

  const name = (attrs["data-city-name"] ?? "").trim();

  /** @type {Record<string,string>} */
  const vars = {};
  for (const key of Object.keys(attrs)) {
    if (!key.startsWith(VAR_PREFIX)) continue;
    vars[key.slice(VAR_PREFIX.length)] = attrs[key];
  }

  const lat = parseFloat(vars.lat);
  const lng = parseFloat(vars.lng);
  const coords = Number.isNaN(lat) || Number.isNaN(lng) ? null : [lng, lat];

  return { slug, name, vars, coords };
}

/**
 * Read every `[data-city-list] [data-city-slug]` element into city objects.
 * @returns {Array<ReturnType<typeof cityFromAttrs>>}
 */
export function readCityList() {
  const out = [];
  document
    .querySelectorAll("[data-city-list] [data-city-slug]")
    .forEach((el) => {
      /** @type {Record<string,string>} */
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value;
      const city = cityFromAttrs(attrs);
      if (city) out.push(city);
    });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/city-registry.test.mjs`
Expected: PASS — `✓ all 6 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/city-registry.js tests/city-registry.test.mjs
git commit -m "feat(city): add city-registry pure parser + DOM reader"
```

---

## Task 2: Resolution chain (`resolveActiveCity`)

**Files:**
- Create: `src/city-resolve.js` (pure helpers, **no imports**)
- Test: `tests/city-resolve.test.mjs`

> **Why a separate file:** `city-context.js` (Task 3) imports `variables.js`,
> which instantiates a `MutationObserver` and reads `document.readyState` at
> module top-level — so importing it in Node throws. The pure resolver logic
> therefore lives in its own import-free module, exactly mirroring how
> `city-visibility-decide.js` is split from `city-visibility.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/city-resolve.test.mjs`:

```js
// Unit tests for the city-resolve pure helpers.
// Framework-free: run with `node tests/city-resolve.test.mjs`.
import assert from "node:assert/strict";
import { resolveActiveCity, buildPlaceholders } from "../src/city-resolve.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

const CITIES = [
  { slug: "sto", name: "Stockholm", vars: { phone: "8-1" }, coords: null },
  { slug: "cph", name: "Copenhagen", vars: { phone: "45-2" }, coords: null },
];

// ── resolveActiveCity ────────────────────────────────────────
check(
  "lock wins over saved; seeds nothing when saved exists",
  resolveActiveCity({ lock: "sto", param: null, saved: "cph" }, CITIES),
  { active: "sto", seedPreference: null },
);
check(
  "lock with no saved pref → seeds the lock",
  resolveActiveCity({ lock: "sto", param: null, saved: null }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "lock with stale (invalid) saved pref → seeds the lock",
  resolveActiveCity({ lock: "sto", param: null, saved: "gone" }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "param overrides saved on non-locked page; never seeds",
  resolveActiveCity({ lock: null, param: "cph", saved: "sto" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "lock + param both present → lock wins",
  resolveActiveCity({ lock: "sto", param: "cph", saved: null }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "saved preference used when no lock/param",
  resolveActiveCity({ lock: null, param: null, saved: "cph" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "invalid lock falls through to saved",
  resolveActiveCity({ lock: "gone", param: null, saved: "cph" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "nothing valid → neutral",
  resolveActiveCity({ lock: null, param: null, saved: "gone" }, CITIES),
  { active: null, seedPreference: null },
);
check(
  "all empty → neutral",
  resolveActiveCity({ lock: null, param: null, saved: null }, CITIES),
  { active: null, seedPreference: null },
);

// ── buildPlaceholders ────────────────────────────────────────
check(
  "active city → city, city-name, city-path, vars",
  buildPlaceholders(CITIES[0], ["phone"]),
  { city: "sto", "city-name": "Stockholm", "city-path": "/sto", phone: "8-1" },
);
check(
  "neutral → all empty strings (incl. known var keys)",
  buildPlaceholders(null, ["phone"]),
  { city: "", "city-name": "", "city-path": "", phone: "" },
);
check(
  "var key missing on active city → empty string",
  buildPlaceholders(CITIES[0], ["phone", "hours"]),
  { city: "sto", "city-name": "Stockholm", "city-path": "/sto", phone: "8-1", hours: "" },
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/city-resolve.test.mjs`
Expected: FAIL — `Cannot find module '../src/city-resolve.js'`.

- [ ] **Step 3: Write minimal implementation (pure helpers only)**

Create `src/city-resolve.js` with the two pure helpers and **no imports**:

```js
/**
 * City Resolve — pure helpers for city-context.js
 *
 * Framework-free (no DOM, no imports) so the resolution chain and placeholder
 * mapping are unit-testable in Node. The DOM/localStorage shell and public API
 * live in city-context.js, which imports these. (Same split pattern as
 * city-visibility-decide.js ↔ city-visibility.js.)
 *
 * Active-city authority, highest first: URL lock → ?city= param → saved
 * preference → neutral. There is no implicit default — neutral is a real,
 * resolved state.
 */

/**
 * Decide the active city and whether to seed the saved preference.
 *
 * Seeding happens only when a valid lock is present AND there is no *valid*
 * saved preference (a stale/removed slug counts as none, so it gets replaced).
 *
 * @param {{lock: string|null, param: string|null, saved: string|null}} inputs
 * @param {Array<{slug: string}>} cities
 * @returns {{active: string|null, seedPreference: string|null}}
 */
export function resolveActiveCity({ lock, param, saved }, cities) {
  const has = (s) => !!s && cities.some((c) => c.slug === s);

  if (has(lock)) {
    return { active: lock, seedPreference: has(saved) ? null : lock };
  }
  if (has(param)) return { active: param, seedPreference: null };
  if (has(saved)) return { active: saved, seedPreference: null };
  return { active: null, seedPreference: null };
}

/**
 * Build the placeholder map pushed into variables.js for the active city.
 * Neutral (null) yields empty strings for every key so a switch never leaves
 * a stale value on the page.
 *
 * @param {{slug: string, name: string, vars: Record<string,string>} | null} activeCity
 * @param {Iterable<string>} knownVarKeys  union of var keys across all cities
 * @returns {Record<string,string>}
 */
export function buildPlaceholders(activeCity, knownVarKeys) {
  /** @type {Record<string,string>} */
  const out = {
    city: activeCity ? activeCity.slug : "",
    "city-name": activeCity ? activeCity.name : "",
    "city-path": activeCity ? `/${activeCity.slug}` : "",
  };
  for (const key of knownVarKeys) {
    out[key] = activeCity ? (activeCity.vars[key] ?? "") : "";
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/city-resolve.test.mjs`
Expected: PASS — `✓ all 12 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/city-resolve.js tests/city-resolve.test.mjs
git commit -m "feat(city): add city-resolve pure resolver + placeholder builder"
```

---

## Task 3: Context DOM shell, API & boot

**Files:**
- Create: `src/city-context.js`

No automated test (DOM/global/localStorage). Verified by build + manual staging checks.

- [ ] **Step 1: Create `src/city-context.js`**

Start with the module header, imports, and constants:

```js
/**
 * City Context
 *
 * Resolves and holds the single active city (or neutral / null), pushes the
 * active city's placeholders into variables.js, and exposes window.bruce.city.
 * The pure resolution + placeholder logic lives in city-resolve.js; this file
 * is the DOM/localStorage/boot shell around it.
 */

import { readCityList } from "./city-registry.js";
import { setGlobal } from "./variables.js";
import { resolveActiveCity, buildPlaceholders } from "./city-resolve.js";

const STORAGE_KEY = "bruce-city";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];
```

Then the state, inputs, apply/resolve, API, and boot:

```js
// ── State ────────────────────────────────────────────────────

/** @type {Array<ReturnType<import("./city-registry.js").cityFromAttrs>>} */
let cities = [];
/** @type {Set<string>} */
let knownVarKeys = new Set();
/** @type {string | null} */
let current = null;
/** @type {boolean} — true once the chain has run at least once */
let resolved = false;
/** @type {Set<(slug: string|null) => void>} */
const listeners = new Set();

const cityBySlug = (slug) => cities.find((c) => c.slug === slug) ?? null;

// ── Inputs (DOM / URL / storage) ─────────────────────────────

function readLock() {
  const v = document.body?.dataset.cityLock?.trim();
  return v || null;
}

function readParam() {
  const sp = new URLSearchParams(location.search);
  const v = (sp.get("city") ?? "").trim();
  return v || null;
}

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode / strict cookie policy
  }
}

function writeSaved(slug) {
  try {
    if (slug === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // best-effort
  }
}

// ── Apply ────────────────────────────────────────────────────
// Push placeholders into variables.js and notify subscribers. `force` makes
// the initial resolution notify even when the slug did not change (neutral
// page: null → null) so the visibility module can reveal data-city-none.

function apply(active, { force = false } = {}) {
  const changed = active !== current;
  current = active;

  const placeholders = buildPlaceholders(cityBySlug(active), knownVarKeys);
  for (const key of Object.keys(placeholders)) setGlobal(key, placeholders[key]);

  if (changed || force) {
    listeners.forEach((fn) => {
      try {
        fn(active);
      } catch (err) {
        console.error("[bruce.city] onChange listener threw", err);
      }
    });
  }
}

// ── Resolve ──────────────────────────────────────────────────
// Idempotent. Re-reads the registry (CMS may render late), recomputes the
// var-key union, runs the chain, seeds the preference if applicable, applies.

function resolve({ force = false } = {}) {
  cities = readCityList();
  knownVarKeys = new Set();
  for (const c of cities) for (const k of Object.keys(c.vars)) knownVarKeys.add(k);

  if (cities.length === 0) return; // nothing to resolve yet; safety pass retries

  const lock = readLock();
  const saved = readSaved();
  const { active, seedPreference } = resolveActiveCity(
    { lock, param: readParam(), saved },
    cities,
  );
  if (seedPreference) writeSaved(seedPreference);

  const firstResolve = !resolved;
  resolved = true;
  apply(active, { force: force || firstResolve });
}

// ── Public API ───────────────────────────────────────────────

const api = {
  get() {
    return current;
  },
  isNeutral() {
    return current === null;
  },
  /** @param {string} slug  "" resets to neutral */
  set(slug) {
    const next = slug === "" ? null : slug;
    if (next !== null && !cityBySlug(next)) {
      console.warn(`[bruce.city] unknown city "${slug}" — ignoring`);
      return;
    }
    writeSaved(next);
    apply(next);
  },
  all() {
    return cities.map((c) => ({ ...c, vars: { ...c.vars } }));
  },
  /**
   * Subscribe to active-city changes. If the chain has already resolved, the
   * callback fires immediately with the current value so late subscribers
   * (import order) never miss the initial resolution.
   * @param {(slug: string|null) => void} fn
   */
  onChange(fn) {
    listeners.add(fn);
    if (resolved) {
      try {
        fn(current);
      } catch (err) {
        console.error("[bruce.city] onChange listener threw", err);
      }
    }
    return () => listeners.delete(fn);
  },
};

/** @type {any} */ (window).bruce ||= {};
/** @type {any} */ (window).bruce.city = api;

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  resolve();
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      // Re-resolve until the registry has loaded; once resolved, a later pass
      // is a cheap no-op unless cities/inputs changed.
      resolve();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
```

- [ ] **Step 2: Confirm the pure resolver test still passes**

Run: `node tests/city-resolve.test.mjs`
Expected: PASS — `✓ all 12 assertions passed` (city-context.js must not be imported by this test; it imports city-resolve.js directly).

- [ ] **Step 3: Verify it compiles**

Run: `pnpm build`
Expected: Parcel completes with no errors (it bundles `src/index.js` — which still imports the old `./city.js` at this point; that's fine, this task only adds a new file). Note: `city-context.js` cannot be run under bare `node` because it imports `variables.js` (top-level DOM side effects); Parcel bundling for the browser is the correct verification here.

- [ ] **Step 4: Commit**

```bash
git add src/city-context.js
git commit -m "feat(city): add city-context DOM shell, bruce.city API, boot"
```

---

## Task 4: Visibility decision helper (`decideVisibility`)

**Files:**
- Rewrite: `src/city-visibility-decide.js`
- Rewrite: `tests/city-visibility-decide.test.mjs`

- [ ] **Step 1: Replace the test with the four-attribute matrix**

Overwrite `tests/city-visibility-decide.test.mjs`:

```js
// Unit tests for the city-visibility pure decision helper.
// Framework-free: run with `node tests/city-visibility-decide.test.mjs`.
import assert from "node:assert/strict";
import { decideVisibility } from "../src/city-visibility-decide.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

const CITIES = [
  { slug: "sto", name: "Stockholm" },
  { slug: "cph", name: "Copenhagen" },
  { slug: "osl", name: "Oslo" },
];
const A = (over) => Object.assign({ show: null, hide: null, none: false, any: false }, over);

// ── no constraints → visible ─────────────────────────────────
check("no attributes → visible", decideVisibility(A({}), "sto", CITIES), { visible: true, unknownValues: [] });

// ── show ─────────────────────────────────────────────────────
check("show match → visible", decideVisibility(A({ show: "sto" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show mismatch → hidden", decideVisibility(A({ show: "cph" }), "sto", CITIES), { visible: false, unknownValues: [] });
check("show list, one matches → visible", decideVisibility(A({ show: "cph, sto" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show by name, case-insensitive → visible", decideVisibility(A({ show: "Stockholm" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show, neutral active → hidden", decideVisibility(A({ show: "sto" }), null, CITIES), { visible: false, unknownValues: [] });
check("show empty value → visible (no-op)", decideVisibility(A({ show: "" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show unknown token → hidden + reported", decideVisibility(A({ show: "malmo" }), "sto", CITIES), { visible: false, unknownValues: ["malmo"] });

// ── hide ─────────────────────────────────────────────────────
check("hide match → hidden", decideVisibility(A({ hide: "sto" }), "sto", CITIES), { visible: false, unknownValues: [] });
check("hide non-match → visible", decideVisibility(A({ hide: "cph" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("hide, neutral active → visible", decideVisibility(A({ hide: "sto" }), null, CITIES), { visible: true, unknownValues: [] });

// ── none ─────────────────────────────────────────────────────
check("none, neutral active → visible", decideVisibility(A({ none: true }), null, CITIES), { visible: true, unknownValues: [] });
check("none, city active → hidden", decideVisibility(A({ none: true }), "sto", CITIES), { visible: false, unknownValues: [] });

// ── any ──────────────────────────────────────────────────────
check("any, city active → visible", decideVisibility(A({ any: true }), "sto", CITIES), { visible: true, unknownValues: [] });
check("any, neutral active → hidden", decideVisibility(A({ any: true }), null, CITIES), { visible: false, unknownValues: [] });

// ── combined constraints (AND) ───────────────────────────────
check("show+any, match & active → visible", decideVisibility(A({ show: "sto", any: true }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show+hide same city → hidden", decideVisibility(A({ show: "sto", hide: "sto" }), "sto", CITIES), { visible: false, unknownValues: [] });

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/city-visibility-decide.test.mjs`
Expected: FAIL — `decideVisibility is not a function` (old file still exports `shouldShow`).

- [ ] **Step 3: Rewrite the implementation**

Overwrite `src/city-visibility-decide.js`:

```js
/**
 * Pure decision helper for city-visibility.js. Framework-free (no DOM, no
 * globals) so the "is this element visible in the active city" rules live in
 * one unit-testable place.
 *
 * Four independent attributes, AND-combined (an element typically carries
 * exactly one):
 *   show="a,b"  visible when active ∈ {a,b}
 *   hide="a,b"  hidden when active ∈ {a,b}  (so: visible otherwise, incl. neutral)
 *   none        visible only when active is null (neutral)
 *   any         visible only when active is non-null
 *
 * `activeSlug === null` means NEUTRAL — a real resolved state, not pre-boot.
 * (Pre-boot hiding is the CSS pre-hide rule's job, gated on is-city-ready.)
 *
 * show/hide values: comma-separated, trimmed, case-insensitive against both
 * city.slug and city.name. Empty/whitespace value is a no-op (no constraint).
 * Tokens matching no city are collected in `unknownValues` so the caller can
 * warn once per value; an unknown token never satisfies a `show`.
 *
 * @param {{show: string|null, hide: string|null, none: boolean, any: boolean}} attrs
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 * @returns {{ visible: boolean, unknownValues: string[] }}
 */
export function decideVisibility(attrs, activeSlug, cities) {
  const unknownValues = [];
  const active = activeSlug ? activeSlug.toLowerCase() : null;

  // Returns { count, matched } for a comma list, pushing unknown tokens.
  function evalList(raw) {
    const tokens = (raw ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    let matched = false;
    for (const t of tokens) {
      const city = cities.find(
        (c) => c.slug.toLowerCase() === t || c.name.toLowerCase() === t,
      );
      if (!city) {
        unknownValues.push(t);
        continue;
      }
      if (active && city.slug.toLowerCase() === active) matched = true;
    }
    return { count: tokens.length, matched };
  }

  let visible = true;

  if (attrs.show != null) {
    const { count, matched } = evalList(attrs.show);
    if (count > 0 && !matched) visible = false;
  }
  if (attrs.hide != null) {
    const { count, matched } = evalList(attrs.hide);
    if (count > 0 && matched) visible = false;
  }
  if (attrs.none && active !== null) visible = false;
  if (attrs.any && active === null) visible = false;

  return { visible, unknownValues };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/city-visibility-decide.test.mjs`
Expected: PASS — `✓ all 17 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/city-visibility-decide.js tests/city-visibility-decide.test.mjs
git commit -m "feat(city): rewrite visibility decision helper for show/hide/none/any"
```

---

## Task 5: Visibility DOM module

**Files:**
- Rewrite: `src/city-visibility.js`

No automated test (DOM). Verified by build + manual staging checks.

- [ ] **Step 1: Rewrite the module**

Overwrite `src/city-visibility.js`:

```js
/**
 * City Visibility
 *
 * Toggles elements marked with one of four attributes based on the active
 * city resolved by src/city-context.js:
 *   data-city-show="<slug-or-name>[,...]"   visible only for those cities
 *   data-city-hide="<slug-or-name>[,...]"   hidden for those cities
 *   data-city-none                          visible only when neutral
 *   data-city-any                           visible only when a city is active
 *
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   html:not(.wf-design-mode) body:not(.is-city-ready)
 *     :is([data-city-show],[data-city-hide],[data-city-none],[data-city-any]) {
 *     display: none;
 *   }
 *
 * The !important defeats Webflow class-driven display:flex/grid/block (same
 * external-CSS precedence lesson as the bottom-sheet component). Pre-hide uses
 * display:none to avoid empty flex/grid slots during the boot window.
 *
 * ── Ready flag ────────────────────────────────────────────────────
 * is-city-ready is set after the first sweep that runs from a *resolved*
 * context. city-context fires onChange once on initial resolution — even for a
 * neutral (null) result — and replays it to late subscribers, so a neutral
 * page still reveals its data-city-none content. If the context never resolves
 * (registry missing) the flag stays unset and only generic content shows
 * (fail-closed neutral baseline).
 *
 * Late inserts (dynamic CMS) are caught by a narrow MutationObserver and
 * safety-pass timers at [500, 1500, 3500] ms.
 */

import { decideVisibility } from "./city-visibility-decide.js";

const SELECTOR =
  "[data-city-show],[data-city-hide],[data-city-none],[data-city-any]";
const HIDE_CLASS = "is-city-hidden";
const READY_CLASS = "is-city-ready";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** Dedupe warnings: one per (attr value, unknown token). */
const warnedValues = new Set();

function readAttrs(el) {
  return {
    show: el.getAttribute("data-city-show"),
    hide: el.getAttribute("data-city-hide"),
    none: el.hasAttribute("data-city-none"),
    any: el.hasAttribute("data-city-any"),
  };
}

function applyVisibility(el, activeSlug, cities) {
  const attrs = readAttrs(el);
  const { visible, unknownValues } = decideVisibility(attrs, activeSlug, cities);
  el.classList.toggle(HIDE_CLASS, !visible);

  for (const v of unknownValues) {
    const key = `${attrs.show ?? ""}|${attrs.hide ?? ""}|${v}`;
    if (warnedValues.has(key)) continue;
    warnedValues.add(key);
    console.warn(
      `[bruce.city-visibility] value "${v}" matched no known city.`,
      "Known cities:",
      cities.map((c) => ({ slug: c.slug, name: c.name })),
    );
  }
}

let lastResolved = false;

function sweep() {
  const cityApi = /** @type {any} */ (window).bruce?.city;
  if (!cityApi) return;
  const activeSlug = cityApi.get();
  const cities = cityApi.all();

  document
    .querySelectorAll(SELECTOR)
    .forEach((el) => applyVisibility(el, activeSlug, cities));

  // Only flag ready once the context has actually resolved. We learn that via
  // the onChange callback (set lastResolved there); a MutationObserver-driven
  // sweep before resolution must not reveal content.
  if (lastResolved) document.body.classList.add(READY_CLASS);
}

let pendingRafId = 0;
const scheduleSweep = () => {
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    sweep();
  });
};

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches?.(SELECTOR) || el.querySelector?.(SELECTOR)) {
        scheduleSweep();
        return;
      }
    }
  }
});

const boot = () => {
  const cityApi = /** @type {any} */ (window).bruce?.city;
  // onChange replays the current state immediately if already resolved, so this
  // both handles "resolved before us" and "resolves after us".
  cityApi?.onChange?.(() => {
    lastResolved = true;
    sweep();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      if (!document.body.classList.contains(READY_CLASS)) sweep();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build`
Expected: Parcel completes with no errors. (`index.js` still imports old `./city.js`; rewired in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/city-visibility.js
git commit -m "feat(city): rewrite visibility DOM module for four attributes"
```

---

## Task 6: Switcher module

**Files:**
- Create: `src/city-switcher.js`

No automated test (DOM). Verified by build + manual staging checks.

- [ ] **Step 1: Create the module**

Create `src/city-switcher.js`:

```js
/**
 * City Switcher
 *
 * In-place ambient switching on pages without a city URL variant. Any element
 * with `data-set-city="<slug>"` becomes a switcher; `data-set-city=""` resets
 * to neutral. Active switchers are flagged `data-city-active="true"` for
 * styling, kept in sync with the live active city.
 *
 * Switching BETWEEN city pages (e.g. /studios/city/sto → …/cph) does not use
 * this module — those are plain CMS anchor links to each city's page, and the
 * destination page's data-city-lock resolves everything.
 *
 * Delegated listeners cover static + CMS-injected switchers. Keyboard
 * activation is added for non-native triggers (role="button"); native
 * <button>/<a> already fire click on Enter/Space.
 */

function syncActive(active) {
  document.querySelectorAll("[data-set-city]").forEach((el) => {
    /** @type {HTMLElement} */ (el).dataset.cityActive =
      el.getAttribute("data-set-city") === (active ?? "") ? "true" : "false";
  });
}

function handle(e) {
  const trigger = /** @type {Element|null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger) return;
  e.preventDefault();
  /** @type {any} */ (window).bruce?.city?.set(
    trigger.getAttribute("data-set-city") ?? "",
  );
}

document.addEventListener("click", handle);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const trigger = /** @type {Element|null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger || trigger.tagName === "BUTTON" || trigger.tagName === "A") return;
  handle(e);
});

const boot = () => {
  /** @type {any} */ (window).bruce?.city?.onChange?.(syncActive);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build`
Expected: Parcel completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/city-switcher.js
git commit -m "feat(city): add city-switcher in-place ambient switching"
```

---

## Task 7: Wire into index.js, delete old module

**Files:**
- Modify: `src/index.js`
- Delete: `src/city.js`

- [ ] **Step 1: Update imports in `src/index.js`**

Replace these two lines:

```js
import "./city.js";
import "./city-visibility.js";
```

with:

```js
import "./city-context.js";
import "./city-visibility.js";
import "./city-switcher.js";
```

(`city-registry.js` has no side effects — it is imported by `city-context.js`, so it needs no entry here.)

- [ ] **Step 2: Delete the old module**

Run: `git rm src/city.js`
Expected: `rm 'src/city.js'`.

- [ ] **Step 3: Verify everything compiles and all unit tests pass**

Run:
```bash
pnpm build && node tests/city-registry.test.mjs && node tests/city-resolve.test.mjs && node tests/city-visibility-decide.test.mjs
```
Expected: Parcel completes with no errors; three lines `✓ all N assertions passed`.

- [ ] **Step 4: Confirm no lingering references to the deleted module**

Run: `grep -rn "city\.js\|shouldShow\|getInitialCity\|citiesFromUrl\|urlSelection" src tests`
Expected: no matches (all references removed; only the new module names remain).

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git commit -m "refactor(city): wire new city modules into index, remove city.js"
```

---

## Task 8: Manual verification on staging

**Files:** none (verification only)

No automated coverage exists for the DOM shells, so verify behavior in the browser after publishing the JS + the FOUC CSS to a staging Webflow site.

- [ ] **Step 1: Ensure the FOUC CSS is in Webflow site-wide custom code**

```css
.is-city-hidden { display: none !important; }
html:not(.wf-design-mode) body:not(.is-city-ready)
  :is([data-city-show],[data-city-hide],[data-city-none],[data-city-any]) {
  display: none;
}
```

- [ ] **Step 2: Run through the checklist** (clear localStorage between identity checks)

- [ ] Neutral first visit to `/studios` (no saved city): generic content shows; `data-city-show`/`data-city-any` hidden; `data-city-none` ("Pick your city") shows; `<body>` has `is-city-ready`.
- [ ] `/studios/city/stockholm` (locked): Stockholm `data-city-show` content shows; `{{city-name}}` renders "Stockholm"; `localStorage["bruce-city"]` is now `stockholm` (seed-on-first-contact).
- [ ] After visiting the Stockholm page, return to `/studios`: now shows Stockholm content (saved preference), `data-city-none` hidden.
- [ ] With saved `copenhagen`, visit `/studios/city/stockholm`: shows Stockholm (lock wins); saved preference stays `copenhagen` (not clobbered).
- [ ] In-place switcher (`data-set-city`) on a global page flips content and `{{city-*}}` placeholders without navigating; `data-city-active` updates; reload keeps the choice.
- [ ] `data-set-city=""` resets to neutral; `localStorage["bruce-city"]` is removed.
- [ ] `?city=stockholm` on a non-locked page shows Stockholm but does NOT change the saved preference.
- [ ] `data-city-hide="stockholm"` element is hidden on the Stockholm page and visible elsewhere (incl. neutral).
- [ ] Editor link `/memberships{{city-path}}` resolves to `/memberships/stockholm` when a city is active and `/memberships` when neutral.

- [ ] **Step 3: No commit** (verification only). If a defect is found, fix in the relevant module, re-run its unit test (if pure) and `pnpm build`, then re-verify.

---

## Task 9: Marketing-editor guide

**Files:**
- Create: `docs/editors/city-system.md`

- [ ] **Step 1: Write the guide**

Create `docs/editors/city-system.md`:

````markdown
# City content — editor guide

This site can show different content per city (Stockholm, Copenhagen, Oslo…),
or stay city-neutral on shared pages. You control it all with attributes in
Webflow — no code.

## The cities list

Cities live in one hidden Collection List (inside a global symbol, so it's on
every page). Each item carries:

| Attribute | Bind to | Required |
|---|---|---|
| `data-city-slug` | the city's Slug | yes |
| `data-city-name` | the city's Name | yes |
| `data-city-var-phone` | a per-city field (e.g. Phone) | no |
| `data-city-var-lat` / `data-city-var-lng` | coordinates | no |

Any `data-city-var-XYZ` becomes a placeholder `{{XYZ}}` you can use in text.
To add a city, add a Collection item — nothing else.

## City pages (e.g. /studios/city/stockholm)

On the City template pages, add one attribute to the page **Body** tag:

- `data-city-lock` → bind to the current item's **Slug**.

That tells the page "this whole page is about this city." Visitors' saved
choices never override it.

## Show or hide content per city

Put one of these on any element:

| To… | Add | Example |
|---|---|---|
| Show only in certain cities | `data-city-show="stockholm,oslo"` | a Stockholm-only banner |
| Hide in certain cities | `data-city-hide="stockholm"` | hide a promo in Stockholm |
| Show only when NO city is picked | `data-city-none` | a "Pick your city" prompt |
| Show only once a city IS picked | `data-city-any` | "View Stockholm studios →" |

Values accept the city slug or name, separated by commas. An element with
none of these always shows.

## Letting visitors switch city

- **Link to another city's page:** use a normal link to that city's page
  (e.g. the City Studios page). Nothing special needed.
- **Switch in place** (on shared pages like the homepage): add
  `data-set-city="stockholm"` to a button. `data-set-city=""` clears it back
  to neutral. The active button gets `data-city-active="true"` for styling.

## Placeholders you can type into text

| Type | Shows | When no city picked |
|---|---|---|
| `{{city-name}}` | Stockholm | (blank) |
| `{{city}}` | stockholm | (blank) |
| `{{city-path}}` | /stockholm | (blank) |
| `{{phone}}` (any city var) | that city's value | (blank) |

Tip for links: `/memberships{{city-path}}` becomes `/memberships/stockholm`
when a city is active, and `/memberships` when neutral — so it never breaks.

## What visitors see before picking a city

On shared pages with no city in the URL, the page is **neutral**: generic
content shows, city-specific blocks stay hidden, and `data-city-none` prompts
appear. Once they pick a city (or land on a city page), that choice is
remembered for next time.

## Gotchas

- The hidden cities list **must** be inside the global symbol, or city pages
  on some templates won't find it.
- Leaving a `data-city-show` value **blank** means "always show" (it's
  ignored), not "hide everywhere".
- Typos in a city name/slug = the element stays hidden. Check the slug.
````

- [ ] **Step 2: Commit**

```bash
git add docs/editors/city-system.md
git commit -m "docs(city): add marketing-editor guide for the city system"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** registry (T1), resolution chain incl. seed/no-clobber (T2), context API + boot + onChange-replay (T3), four-attribute visibility (T4–T5), switcher (T6), wiring/cleanup (T7), FOUC CSS + manual matrix (T8), editor docs deliverable (T9). The `?city=` tier, neutral-as-resolved, and `{{city-path}}` are all exercised in T2/T3 and the T8 checklist.
- **Out of scope (do not build):** CF worker / IP geo, multi-city ambient state, `studios-city-select.js` and `explorer.js` (they read `[data-city-list]` directly and are unaffected — confirm with the T7 grep).
- **Release (separate from this plan):** rebuild `dist/` with `rm -rf .parcel-cache dist && pnpm build`, commit the minified `dist/`, then purge jsDelivr `@main` (`purge.jsdelivr.net`). Browser cache clears do not bypass the CDN edge.
