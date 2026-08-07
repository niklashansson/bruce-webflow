# Explorer "Show studios in nearby areas" Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the positively-phrased "Show studios in nearby areas" switch work — off (the default) shows metro-only studios, on reveals the whole Bruce region — by inverting it onto a hidden Finsweet condition input, and stop that hidden input from counting as an active filter.

**Architecture:** A Finsweet condition input only contributes while it is *checked*, so the state is split across two inputs per city dropdown: a visible `nearby-toggle` with no `fs-list-*` attributes, and a hidden `nearby-source` (`fs-list-field="in-metro"`, `fs-list-value="true"`, `checked`). JS keeps them inverted, page-globally, so the desktop and mobile copies stay in agreement. The inversion logic lives in a pure module (`src/nearby-plan.js`) with node tests; `explorer.js` is a thin DOM applier, following the existing `city-links-plan.js` ↔ `city-links.js` split.

**Tech Stack:** Vanilla JS (Parcel bundle `src/explorer.js`), Finsweet Attributes v2 `fs-list` (loaded by Webflow), framework-free `node:assert` tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md`

## Global Constraints

- **Never set `.checked` directly on a Finsweet-bound input** — always `.click()`. Direct assignment desyncs the Finsweet model. `.click()` dispatches `input` then `change`, and Finsweet re-reads conditions on the form's `fs-list-filteron` event, which defaults to `"input"`.
- **Do use `.checked` on the visible toggle.** It is not a Finsweet input, its visuals come from the CSS rule `[data-state~="checked"]:is(:checked, :has(:checked))`, and `.click()` would generate events that re-enter the handler down the wrong branch.
- Both inputs must stay **inside the `<form fs-list-element="filters">` subtree** — Finsweet only reads inputs there.
- The nearby inputs must **never count into filter badges (`data-search-count`) or the grand total** in `reflectFilters`.
- Wrap state attribute follows the existing pattern on `.explorer_wrap`: `data-explorer-nearby="true|false"`.
- Pure modules are framework-free: no DOM, no imports, JSDoc-typed exports. Tests are plain `node:assert/strict` scripts ending in `console.log(\`✓ all ${passed} assertions passed\`)`.
- Comments in `explorer.js` follow its existing style: block comments explaining constraints and *why*, not *what*.
- Release builds: `rm -rf .parcel-cache dist && pnpm build` (stale-cache gotcha). `dist/` is committed **minified** (no `--no-optimize`). Purge jsDelivr `@main` via `purge.jsdelivr.net` after pushing dist — a browser cache clear does not bypass the CDN edge.

**Webflow prerequisites — already shipped, verified live on `/studios/copenhagen`:**

- In **both** city dropdowns (desktop and mobile), inside `#studio-filters-form`:
  - Visible: `<input type="checkbox" data-explorer-element="nearby-toggle">`, **no** `fs-list-*` attributes, unchecked, labelled "Show studios in nearby areas".
  - Hidden: `<input type="checkbox" checked data-explorer-element="nearby-source" fs-list-field="in-metro" fs-list-value="true">` inside a `.u-display-none` wrapper.
- Studio items emit `<div fs-list-field="in-metro">true</div>`.
- Confirmed working: the counter reads 202 against a region total of 226, and Finsweet applies `is-active` to the hidden input's label. Finsweet **does** bind inputs inside a `display:none` wrapper.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/nearby-plan.js` (create) | Pure. Given current toggle/source states plus what originated the change, return the desired state of every input. No DOM. |
| `tests/nearby-plan.test.mjs` (create) | Node assertions over `planNearby`, including the loop-termination and clear cases. |
| `src/explorer.js` (modify) | Selectors, the DOM applier, the global-clear flag, wiring into the existing form listeners, and the `reflectFilters` exemption. |

---

### Task 1: `planNearby` pure module

**Files:**
- Create: `src/nearby-plan.js`
- Test: `tests/nearby-plan.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `planNearby({ toggles, sources, originKind, originIndex, clearPending })` where `toggles` and `sources` are `boolean[]` of current `.checked` values, `originKind` is `"toggle" | "source" | null`, `originIndex` is a number (only meaningful when `originKind === "toggle"`), and `clearPending` is a boolean. Returns `{ toggles: boolean[], sources: boolean[], nearby: boolean }` with `toggles.length === input toggles.length` and `sources.length === input sources.length`. Task 3 imports this.

The three branches, in priority order:

1. `clearPending` → `nearby = false` (a global clear returns to defaults, and the default is metro-only).
2. `originKind === "toggle"` with a valid `originIndex` → `nearby = toggles[originIndex]`.
3. Otherwise → the **first source is canonical**, `nearby = !sources[0]`. With no sources at all, `nearby = false`.

- [ ] **Step 1: Write the failing test**

Create `tests/nearby-plan.test.mjs`:

```js
// Unit tests for the nearby-plan pure helper.
// Framework-free: run with `node tests/nearby-plan.test.mjs`.
import assert from "node:assert/strict";
import { planNearby } from "../src/nearby-plan.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── toggle-origin branch ─────────────────────────────────────
check(
  "user switches nearby ON → every source unchecks, other toggles follow",
  planNearby({
    toggles: [true, false],
    sources: [true, true],
    originKind: "toggle",
    originIndex: 0,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "user switches nearby OFF → every source rechecks",
  planNearby({
    toggles: [false, true],
    sources: [false, false],
    originKind: "toggle",
    originIndex: 0,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);
check(
  "the mobile copy can originate too",
  planNearby({
    toggles: [false, true],
    sources: [true, true],
    originKind: "toggle",
    originIndex: 1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);

// ── canonical-source branch ──────────────────────────────────
check(
  "source-origin → first source is canonical, disagreeing duplicate converges",
  planNearby({
    toggles: [false, false],
    sources: [false, true],
    originKind: "source",
    originIndex: 1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "URL restore with nearby enabled → toggles come up on",
  planNearby({
    toggles: [false, false],
    sources: [false, false],
    originKind: null,
    originIndex: -1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "first paint → source checked, toggles off, metro only",
  planNearby({
    toggles: [false, false],
    sources: [true, true],
    originKind: null,
    originIndex: -1,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── loop termination ─────────────────────────────────────────
// The .click() we issue on a source re-enters the applier down the
// source branch. It must return the state it was handed, unchanged, or the
// handler would write again and never settle.
check(
  "already-consistent state returns itself (nearby on)",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: "source",
    originIndex: 0,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "already-consistent state returns itself (nearby off)",
  planNearby({
    toggles: [false, false],
    sources: [true, true],
    originKind: "source",
    originIndex: 0,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── clear ────────────────────────────────────────────────────
check(
  "a pending global clear beats the toggle the user just flipped",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: "toggle",
    originIndex: 0,
    clearPending: true,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);
check(
  "a pending global clear beats an unchecked canonical source",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: null,
    originIndex: -1,
    clearPending: true,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── degenerate input ─────────────────────────────────────────
// A locale or template that never authored the hidden input must not read as
// "nearby enabled" — with nothing to filter on, the honest answer is the
// default.
check(
  "no sources at all → default (nearby hidden)",
  planNearby({ toggles: [false], sources: [], originKind: null, originIndex: -1 }),
  { toggles: [false], sources: [], nearby: false },
);
check(
  "an out-of-range originIndex falls back to the canonical source",
  planNearby({
    toggles: [false, false],
    sources: [true, true],
    originKind: "toggle",
    originIndex: 7,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/nearby-plan.test.mjs`

Expected: FAIL — `ERR_MODULE_NOT_FOUND`, cannot find `../src/nearby-plan.js`.

- [ ] **Step 3: Write the implementation**

Create `src/nearby-plan.js`:

```js
/**
 * Nearby Plan — pure helper for the explorer's "Show studios in nearby areas"
 * switch.
 *
 * Framework-free (no DOM, no imports) so the inversion and the N-way sync are
 * unit-testable in Node. The DOM applier lives in explorer.js. (Same split as
 * city-links-plan.js ↔ city-links.js.)
 *
 * A Finsweet condition input only contributes while it is CHECKED, but the
 * behaviour we want is the opposite shape: the `in-metro equal true` condition
 * has to be active while the visible switch is OFF. So the state is split
 * across two inputs that are always inverses of each other —
 *
 *     toggle.checked === !source.checked
 *
 * — and this function decides, for one refresh, what every input should be.
 * Spec: docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
 */

/**
 * @param {object} state
 * @param {boolean[]} state.toggles      current .checked of each visible toggle
 * @param {boolean[]} state.sources      current .checked of each hidden source
 * @param {"toggle"|"source"|null} state.originKind  what caused this refresh
 * @param {number} state.originIndex     index into `toggles`, when originKind is "toggle"
 * @param {boolean} [state.clearPending] a global "Clear all" is in flight
 * @returns {{toggles: boolean[], sources: boolean[], nearby: boolean}}
 */
export function planNearby({
  toggles,
  sources,
  originKind,
  originIndex,
  clearPending = false,
}) {
  // "Clear all" returns the page to its defaults, and the default is
  // metro-only. Without this, Finsweet's clear would leave the source
  // unchecked — a cleared state that differs from the initial state.
  // Beats every other branch, including a toggle the user just flipped.
  const nearby = clearPending
    ? false
    : originKind === "toggle" && originIndex >= 0 && originIndex < toggles.length
      ? // The user acted on a visible switch: it is the intent, and the
        // sources follow it inverted.
        toggles[originIndex]
      : // Everything else — Finsweet's afterRender, URL restore, first paint.
        // The first source in DOM order is canonical; it is what Finsweet
        // persists to the URL. No sources authored at all → the default.
        sources.length > 0 && !sources[0];

  return {
    toggles: toggles.map(() => nearby),
    sources: sources.map(() => !nearby),
    nearby,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/nearby-plan.test.mjs`

Expected: PASS — `✓ all 12 assertions passed`

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`

Expected: every `tests/*.test.mjs` prints its `✓ all N assertions passed` line and the command exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/nearby-plan.js tests/nearby-plan.test.mjs
git commit -m "feat(explorer): pure planner for the nearby-areas inversion"
```

---

### Task 2: Stop the hidden source counting as an active filter

**Files:**
- Modify: `src/explorer.js` — the `S` selector map (add after the `exclusiveToggle` entry, currently line 68) and `reflectFilters` (the skip at line 176)

**Interfaces:**
- Consumes: the existing `S` map and `reflectFilters`.
- Produces: `S.nearbyToggle` and `S.nearbySource` selector constants, which Task 3 uses.

This is a standalone bug fix and lands first because it is already live: the hidden source ships `checked`, so `reflectFilters` counts it, `.explorer_wrap` carries `data-explorer-filtered="true"` and the form `data-has-filters="true"` on an untouched page. That shows "Clear all" and suppresses the discovery section before the user has filtered anything.

Note the visible toggle needs **no** exemption — it carries no `fs-list-field`, so the existing `if (!field || field === "*") continue;` already skips it. Only the source needs one.

There is no DOM test rig in this repo (tests are framework-free pure-module tests), so this task is implement → verify → commit, with behaviour confirmed on the live page in Task 4.

- [ ] **Step 1: Add the two selectors to the `S` map**

In `src/explorer.js`, immediately after the existing `exclusiveToggle` entry:

```js
  // The "Show studios in nearby areas" pair, inside the city dropdown. The
  // visible switch carries NO fs-list-* attributes; the hidden source is the
  // real Finsweet condition (fs-list-field="in-metro" fs-list-value="true")
  // and ships checked, so the default view is metro-only. JS keeps them
  // inverted — see syncNearbyToggle.
  nearbyToggle: '[data-explorer-element="nearby-toggle"]',
  nearbySource: '[data-explorer-element="nearby-source"]',
```

- [ ] **Step 2: Exempt the source in `reflectFilters`**

In `reflectFilters`, replace this (line 174–176):

```js
    // The exclusive toggle is a refinement of the membership selection, not a
    // filter of its own — it must never count into badges or the total.
    if (el.matches(S.exclusiveToggle)) continue;
```

with:

```js
    // The exclusive toggle is a refinement of the membership selection, not a
    // filter of its own — it must never count into badges or the total.
    // The nearby source is scope, not a filter: it ships CHECKED, so counting
    // it would pin data-explorer-filtered to "true" forever and permanently
    // hide the discovery collections. (Its visible partner needs no exemption
    // — it carries no fs-list-field, so the guard below already skips it.)
    if (el.matches(S.exclusiveToggle) || el.matches(S.nearbySource)) continue;
```

- [ ] **Step 3: Verify the bundle still builds**

Run: `pnpm build`

Expected: exits 0, no Parcel errors. (This is a syntax/wiring check, not the release build — Task 4 does the clean rebuild.)

- [ ] **Step 4: Confirm the suite is unaffected**

Run: `pnpm test`

Expected: exits 0, all pure-module tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/explorer.js
git commit -m "fix(explorer): the nearby source is scope, not an active filter"
```

---

### Task 3: The DOM applier and its wiring

**Files:**
- Modify: `src/explorer.js` — imports (top of file, alongside `./mapbox.js` and `./location.js`), a new section after `syncExclusiveToggle` (which ends at line 253), `refreshFilterForms` (line 277), and `setupFilterForms` (line 291)

**Interfaces:**
- Consumes: `planNearby` from Task 1; `S.nearbyToggle` / `S.nearbySource` from Task 2; the existing `S.wrap`, `S.filtersForm`, `refreshFilterForms` / `setupFilterForms` wiring.
- Produces: `syncNearbyToggle(form, origin)` where `origin` is the `Element` that caused the refresh or `null`; sets `data-explorer-nearby="true|false"` on `.explorer_wrap` for CSS.

Two behaviours are load-bearing and easy to get wrong:

- **Termination.** The `.click()` we issue on a source bubbles a `change` back to the form and re-enters this function with `origin` = that source. It runs down the canonical-source branch, finds everything already in agreement, writes nothing, and stops. This mirrors `syncExclusiveToggle`'s equality guard at line 239.
- **The clear flag is cleared by the caller, not here.** `refreshFilterForms` iterates every filters form on the page; if this function reset the flag, only the first form would see the clear.

Again: no DOM test rig, so implement → build → commit, with live verification in Task 4.

- [ ] **Step 1: Import the planner**

At the top of `src/explorer.js`, after the existing imports:

```js
import { planNearby } from "./nearby-plan.js";
```

so the import block reads:

```js
import { MAPBOX_STYLE, loadMapboxGl, loadScriptOnce } from "./mapbox.js";
import { requestUserLocation } from "./location.js";
import { planNearby } from "./nearby-plan.js";
```

- [ ] **Step 2: Add the global-clear selector to the `S` map**

Immediately after the `nearbySource` entry added in Task 2:

```js
  // A page-level "Clear all" — fs-list-element="clear" with NO fs-list-field.
  // The field-scoped clears (fs-list-field="tier" / "category") clear one
  // dropdown, not the page, and must not reset the nearby scope.
  globalClear: '[fs-list-element="clear"]:not([fs-list-field])',
```

- [ ] **Step 3: Add the applier**

Insert this whole section into `src/explorer.js` after `syncExclusiveToggle` ends (after line 253, before the `syncCityLinks` comment block):

```js
// ── Nearby-areas toggle ──────────────────────────────────────
// The visible switch reads positively ("Show studios in nearby areas") but the
// underlying Finsweet condition narrows: `in-metro equal true` must be ACTIVE
// while the switch is OFF. A Finsweet input only contributes while checked, so
// one input cannot express that. The state is split across a visible toggle
// and a hidden source that are always inverses, and this function keeps them
// so — page-globally, which is what makes the duplicated desktop/mobile filter
// bars agree without special-casing them.
//
// Writes are asymmetric, and deliberately:
//   - sources via .click(), never .checked — .checked desyncs Finsweet's model,
//     and the click's `input` event is what makes Finsweet re-read the
//     condition (fs-list-filteron defaults to "input").
//   - toggles via .checked, never .click() — they are not Finsweet inputs,
//     their visuals are pure CSS :has(:checked), and a click would re-enter
//     this function down the wrong branch.
//
// Spec: docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
let nearbyClearPending = false;
let nearbyClearBound = false;

function syncNearbyToggle(form, origin) {
  const toggleEls = [...form.querySelectorAll(S.nearbyToggle)];
  const sourceEls = [...form.querySelectorAll(S.nearbySource)];
  if (toggleEls.length === 0 || sourceEls.length === 0) return;

  const originKind =
    origin instanceof Element
      ? origin.matches(S.nearbyToggle)
        ? "toggle"
        : origin.matches(S.nearbySource)
          ? "source"
          : null
      : null;

  const plan = planNearby({
    toggles: toggleEls.map((el) => el.checked),
    sources: sourceEls.map((el) => el.checked),
    originKind,
    originIndex: originKind === "toggle" ? toggleEls.indexOf(origin) : -1,
    clearPending: nearbyClearPending,
  });

  toggleEls.forEach((el, i) => {
    if (el.checked !== plan.toggles[i]) el.checked = plan.toggles[i];
  });
  // Only click what actually disagrees — this equality guard is what
  // terminates the change → click → change cycle.
  sourceEls.forEach((el, i) => {
    if (el.checked !== plan.sources[i]) el.click();
  });

  const wrap = form.closest(S.wrap);
  if (wrap instanceof HTMLElement) {
    wrap.dataset.explorerNearby = plan.nearby ? "true" : "false";
  }
}

// "Clear all" resets the page to its defaults, and the default is metro-only.
// Finsweet's clear would otherwise leave the source unchecked — a cleared
// state that differs from the initial one. We only raise a flag here; the
// re-assertion happens on the next refreshFilterForms, which is also what
// lowers it (this function must not, or only the first form would see it).
// Delegated on the document because the clear buttons live OUTSIDE the
// filters form.
function bindNearbyClear() {
  if (nearbyClearBound) return;
  nearbyClearBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(S.globalClear)) {
      nearbyClearPending = true;
    }
  });
}
```

- [ ] **Step 4: Wire it into `refreshFilterForms`**

Replace the body of `refreshFilterForms` (line 277–285):

```js
function refreshFilterForms() {
  document.querySelectorAll(S.filtersForm).forEach((form) => {
    if (form instanceof HTMLFormElement) {
      syncExclusiveToggle(form);
      reflectFilters(form);
    }
  });
  syncCityLinks();
}
```

with:

```js
function refreshFilterForms() {
  document.querySelectorAll(S.filtersForm).forEach((form) => {
    if (form instanceof HTMLFormElement) {
      syncExclusiveToggle(form);
      syncNearbyToggle(form, null);
      reflectFilters(form);
    }
  });
  // Every form has now seen the pending clear; lower it.
  nearbyClearPending = false;
  syncCityLinks();
}
```

- [ ] **Step 5: Wire it into `setupFilterForms`**

Replace the body of `setupFilterForms` (line 291–308):

```js
function setupFilterForms() {
  document.querySelectorAll(S.filtersForm).forEach((el) => {
    const form = /** @type {HTMLFormElement} */ (el);
    if (form.dataset.explorerFiltersInit) return;
    form.dataset.explorerFiltersInit = "true";
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("change", () => {
      syncExclusiveToggle(form);
      reflectFilters(form);
      syncCityLinks();
    });
    syncExclusiveToggle(form);
    reflectFilters(form);
  });
  // Carry any URL-restored filters into the city links on first paint, before
  // Finsweet binds and afterRender takes over.
  syncCityLinks();
}
```

with:

```js
function setupFilterForms() {
  bindNearbyClear();
  document.querySelectorAll(S.filtersForm).forEach((el) => {
    const form = /** @type {HTMLFormElement} */ (el);
    if (form.dataset.explorerFiltersInit) return;
    form.dataset.explorerFiltersInit = "true";
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("change", (event) => {
      syncExclusiveToggle(form);
      syncNearbyToggle(form, event.target);
      reflectFilters(form);
      syncCityLinks();
    });
    syncExclusiveToggle(form);
    syncNearbyToggle(form, null);
    reflectFilters(form);
  });
  // Carry any URL-restored filters into the city links on first paint, before
  // Finsweet binds and afterRender takes over.
  syncCityLinks();
}
```

- [ ] **Step 6: Build**

Run: `pnpm build`

Expected: exits 0, no Parcel errors, and `dist/explorer.js` is rewritten.

- [ ] **Step 7: Confirm the suite still passes**

Run: `pnpm test`

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/explorer.js
git commit -m "feat(explorer): invert the nearby-areas switch onto its Finsweet source"
```

---

### Task 4: Release build and live verification

**Files:**
- Modify: `dist/explorer.js`, `dist/index.js`, `dist/studio.js` (Parcel output — committed minified)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: nothing further in code; this is the ship-and-verify gate.

`dist/` is committed and served over jsDelivr `@main`, so the build must be clean (Parcel can report success while shipping a stale bundle) and the CDN must be purged (a browser or incognito cache clear does **not** bypass the edge).

- [ ] **Step 1: Clean release build**

Run:

```bash
rm -rf .parcel-cache dist && pnpm build
```

Expected: exits 0; `dist/explorer.js`, `dist/index.js`, `dist/studio.js` exist and are minified (single long lines).

- [ ] **Step 2: Confirm the new code actually reached the bundle**

Run: `grep -c "nearby-toggle\|nearby-source" dist/explorer.js`

Expected: a non-zero count. A zero here means Parcel served a stale cache — redo Step 1.

- [ ] **Step 3: Commit and push dist**

```bash
git add dist
git commit -m "build: dist for the nearby-areas toggle"
git push
```

- [ ] **Step 4: Purge the CDN**

Fetch `https://purge.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/explorer.js` and confirm the response reports success.

- [ ] **Step 5: Verify on the live page**

Open `https://brucestudios.webflow.io/studios/copenhagen` with a hard reload, and check each of these:

| Check | Expected |
| --- | --- |
| On load | Count **202**. `.explorer_wrap` has `data-explorer-nearby="false"` and — the Task 2 fix — `data-explorer-filtered="false"`. "Clear all" is hidden. |
| Switch nearby **on** (desktop) | Count rises to **226**. `data-explorer-nearby="true"`. |
| Open the mobile filter bar (narrow the window below 50em) | Its nearby switch is **on** too — the copies agree. |
| Switch nearby **off** from the mobile copy | Count returns to **202**, and the desktop switch goes off. |
| Reload with nearby on | Finsweet restores it from the URL; the switch comes up **on** and the count is 226. |
| "Clear all" while nearby is on | Count returns to **202** and the switch goes **off** — back to the default. |
| Clear the **Memberships** chip only (its × button) while nearby is on | Nearby stays **on**. A field-scoped clear must not reset the scope. |
| With a membership selected | The exclusive toggle still works unchanged — no regression from the shared `change` listener. |
| Console | No errors, and no sign of a runaway loop (the page settles immediately after each switch). |

The `.click()`-on-a-hidden-input path is the one thing that cannot be proven off-page: `HTMLElement.click()` runs activation behaviour regardless of rendering, so a `display:none` checkbox does toggle — the first two rows above are what confirm it in practice. If the switch appears dead, that is the first thing to inspect.

- [ ] **Step 6: Record the outcome**

If every row passes, note the verification in the spec's status line:

```bash
# in docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
# change:  **Status:** Approved
# to:      **Status:** Shipped — verified on /studios/copenhagen 2026-08-07
git add docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
git commit -m "docs(explorer): mark the nearby-areas toggle shipped"
```

If a row fails, stop and report which one — do not patch blind. The failure mode tells you where to look: a dead switch points at the `.click()` path or at Finsweet not re-reading; a switch that flickers or a hung page points at the termination guard in `syncNearbyToggle` Step 3; a wrong count with a correct switch points at `planNearby`.

---

## Out of Scope

Deliberately excluded, per the spec — do not drift into these:

- The count mismatch (`<h1>`, `<title>`, meta description and JSON-LD advertise the regional total while the counter shows the metro figure).
- The three market-level overflow pages for studios unreachable by chip.
- Town-level pages and the nested "Other cities" dropdown.
