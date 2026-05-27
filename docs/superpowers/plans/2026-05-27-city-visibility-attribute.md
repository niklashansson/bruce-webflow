# City Visibility Attribute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `data-city-show` attribute that toggles element visibility based on the active city from `src/city.js`, with no flash before resolution.

**Architecture:** Two new modules. `src/city-visibility-decide.js` is a pure `shouldShow()` helper, unit-testable in Node (no DOM/browser globals). `src/city-visibility.js` is the thin DOM apply layer — subscribes to `window.bruce.city.onChange`, sweeps `[data-city-show]` elements on city change and on Finsweet/CMS late inserts (`MutationObserver` + safety-pass timers), and owns the `body.is-city-ready` flag that drops a global pre-hide CSS rule. Two site-wide CSS rules added in Webflow custom code complete the contract.

**Tech Stack:** Vanilla ES modules bundled by Parcel (`pnpm build`). Framework-free Node test runner using `node:assert/strict`, matching `tests/studios-city.test.mjs`. No new dependencies.

---

## File Structure

**Why two files for one feature:** The codebase convention is to split pure decision logic from the DOM apply layer so the logic can be imported and tested in Node — see `src/studios-city-select.js` (pure helpers) vs `src/studios-city-filter.js` (DOM apply). Putting `new MutationObserver(...)` and `document.readyState` checks at the top of the same file as the helper would explode the moment Node tries to import the helper. This split is what the spec's "mirroring studios-city-select.js's pure-helper pattern" clause anticipates; the spec's "New file" listing was singular but its implementation guidance is the two-file split.

**Create:**
- `src/city-visibility-decide.js` — pure `shouldShow()` helper. No DOM, no globals. Safe to import in Node.
- `src/city-visibility.js` — DOM apply layer (subscribe to `onChange`, sweep, `MutationObserver`, boot). Imports `shouldShow` from the decide module.
- `tests/city-visibility-decide.test.mjs` — unit tests for `shouldShow()`.

**Modify:**
- `src/index.js` — one new line: `import "./city-visibility.js";`.
- `src/city.js` — top docblock gets one cross-reference block to `data-city-show`. No behavior change.

**External (NOT a code change, but required for the feature to work):**
- Webflow site-wide custom code: two CSS rules described in Task 4.

---

## Task 1: Pure helper `shouldShow` with TDD

**Files:**
- Create: `tests/city-visibility-decide.test.mjs`
- Create: `src/city-visibility-decide.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/city-visibility-decide.test.mjs`:

```js
// Unit tests for the city-visibility pure decision helper.
// Framework-free: run with `node tests/city-visibility-decide.test.mjs`.
// The helper has no DOM/global deps, so importing it in Node is safe.

import assert from "node:assert/strict";
import { shouldShow } from "../src/city-visibility-decide.js";

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

// ── empty / missing attribute → always visible ───────────────
check(
  "null attribute → visible",
  shouldShow(null, "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "empty attribute → visible",
  shouldShow("", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "whitespace-only attribute → visible",
  shouldShow("   ", "sto", CITIES),
  { visible: true, unknownValues: [] },
);

// ── pre-boot (no active slug) hides non-empty attributes ─────
check(
  "null activeSlug, non-empty attr → hidden",
  shouldShow("sto", null, CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "null activeSlug, empty attr → visible",
  shouldShow("", null, CITIES),
  { visible: true, unknownValues: [] },
);

// ── single value: slug match ─────────────────────────────────
check(
  "single slug match",
  shouldShow("sto", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single slug mismatch",
  shouldShow("cph", "sto", CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "single slug match, mixed case attr",
  shouldShow("STO", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single slug match, mixed case slug",
  shouldShow("sto", "STO", CITIES),
  { visible: true, unknownValues: [] },
);

// ── single value: name match ─────────────────────────────────
check(
  "single name match (exact case)",
  shouldShow("Stockholm", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single name match (lower case)",
  shouldShow("stockholm", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single name mismatch",
  shouldShow("Copenhagen", "sto", CITIES),
  { visible: false, unknownValues: [] },
);

// ── multi-value lists ────────────────────────────────────────
check(
  "comma list, one slug matches",
  shouldShow("cph, sto", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "comma list, no match",
  shouldShow("cph, osl", "sto", CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "comma list, extra whitespace tolerated",
  shouldShow("  cph ,   sto  ", "cph", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "comma list, mix of slug + name",
  shouldShow("Copenhagen, osl", "osl", CITIES),
  { visible: true, unknownValues: [] },
);

// ── unknown tokens reported ──────────────────────────────────
check(
  "unknown single value → hidden + reported",
  shouldShow("malmo", "sto", CITIES),
  { visible: false, unknownValues: ["malmo"] },
);
check(
  "unknown + known, known matches → visible, unknown still reported",
  shouldShow("malmo, sto", "sto", CITIES),
  { visible: true, unknownValues: ["malmo"] },
);
check(
  "unknown + known, neither matches → hidden + reported",
  shouldShow("malmo, cph", "sto", CITIES),
  { visible: false, unknownValues: ["malmo"] },
);
check(
  "multiple unknown values reported",
  shouldShow("malmo, gothenburg", "sto", CITIES),
  { visible: false, unknownValues: ["malmo", "gothenburg"] },
);

// ── edge cases ───────────────────────────────────────────────
check(
  "comma-only attribute → visible (no real tokens)",
  shouldShow(", ,", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "empty cities array, non-empty attribute → hidden, value reported",
  shouldShow("sto", "sto", []),
  { visible: false, unknownValues: ["sto"] },
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/city-visibility-decide.test.mjs`
Expected: fails with `ERR_MODULE_NOT_FOUND` (the import of `../src/city-visibility-decide.js` cannot resolve because the file doesn't exist yet).

- [ ] **Step 3: Create `src/city-visibility-decide.js`**

```js
/**
 * Pure decision helper for the city-visibility module (city-visibility.js).
 * Framework-free (no DOM, no globals) so the "is this element visible in the
 * active city" rules live in one unit-testable place — mirroring the
 * studios-city-select.js / studios-city-filter.js split.
 */

/**
 * Decide whether an element should be visible given its `data-city-show`
 * attribute value and the currently-active city slug.
 *
 * Returns `{ visible, unknownValues }` so the caller can warn once per
 * unknown value rather than per element.
 *
 * Semantics:
 *   - null/empty/whitespace-only attribute → always visible (no-op).
 *   - comma-separated values, each trimmed.
 *   - non-empty attribute but null active slug → hidden (fails closed
 *     while city.js is still resolving).
 *   - case-insensitive match against city.slug AND city.name (mirrors
 *     citiesFromUrl() in src/city.js so editors can use either).
 *   - tokens that match no city are listed in `unknownValues`.
 *
 * @param {string | null} attrValue
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 * @returns {{ visible: boolean, unknownValues: string[] }}
 */
export function shouldShow(attrValue, activeSlug, cities) {
  const raw = (attrValue ?? "").trim();
  if (raw === "") return { visible: true, unknownValues: [] };

  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return { visible: true, unknownValues: [] };

  if (!activeSlug) return { visible: false, unknownValues: [] };
  const activeLower = activeSlug.toLowerCase();

  let visible = false;
  const unknownValues = [];

  for (const t of tokens) {
    const match = cities.find(
      (c) => c.slug.toLowerCase() === t || c.name.toLowerCase() === t,
    );
    if (!match) {
      unknownValues.push(t);
      continue;
    }
    if (match.slug.toLowerCase() === activeLower) visible = true;
  }

  return { visible, unknownValues };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/city-visibility-decide.test.mjs`
Expected: `✓ all 22 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add tests/city-visibility-decide.test.mjs src/city-visibility-decide.js
git commit -m "$(cat <<'EOF'
Add pure shouldShow helper for city-visibility attribute

Tests-first: framework-free Node tests covering empty/whitespace
attributes, slug+name case-insensitive matching, comma lists,
pre-boot hidden-by-default, and unknown-value reporting.
EOF
)"
```

---

## Task 2: DOM apply layer + observer + boot

**Files:**
- Create: `src/city-visibility.js`
- Modify: `src/index.js`

This task has no unit tests — the DOM/observer code mirrors the established pattern in `src/city.js` and `src/variables.js`, both of which are verified manually rather than unit-tested. See Task 4 for the manual verification protocol.

- [ ] **Step 1: Create `src/city-visibility.js`**

```js
/**
 * City Visibility
 *
 * Toggles visibility of any element marked `data-city-show="<slug-or-name>[,...]"`
 * based on the active city resolved by src/city.js.
 *
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
 *     display: none;
 *   }
 *
 * The !important defeats Webflow class-driven display:flex/grid/block
 * (same external-CSS precedence lesson as the bottom-sheet component).
 * Pre-hide uses display:none rather than visibility:hidden to avoid
 * empty slots in flex/grid sections during the boot window.
 *
 * ── Attribute semantics ───────────────────────────────────────────
 *   data-city-show="cph"          visible only when active city is cph
 *   data-city-show="cph, sto"     visible when active is cph or sto
 *   data-city-show="Copenhagen"   name match works too, case-insensitive
 *   data-city-show=""             always visible (empty value is a no-op)
 *   no attribute                  always visible (normal behavior)
 *
 * Matching is case-insensitive against city.slug AND city.name (same
 * permissive lookup as citiesFromUrl() in src/city.js). Values matching
 * no city leave the element hidden and warn once per (attr, value) pair.
 *
 * ── FOUC ──────────────────────────────────────────────────────────
 * Pre-hide rule keeps non-empty data-city-show elements display:none
 * until <body> gains is-city-ready. This module sets that body class
 * only AFTER its first sweep against a non-null active city, so if
 * city.js fails to boot the pre-hide stays in place (fail-closed).
 *
 * Late inserts (Finsweet, dynamic CMS) are caught by a narrow
 * MutationObserver and safety-pass timers at [500, 1500, 3500] ms,
 * matching the convention in src/city.js and src/variables.js.
 */

import { shouldShow } from "./city-visibility-decide.js";

const ATTR = "data-city-show";
const HIDE_CLASS = "is-city-hidden";
const READY_CLASS = "is-city-ready";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** Dedupe warnings: one warning per (attr value, unknown token) pair. */
const warnedValues = new Set();

/**
 * @param {HTMLElement} el
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 */
function applyVisibility(el, activeSlug, cities) {
  const attr = el.getAttribute(ATTR);
  const { visible, unknownValues } = shouldShow(attr, activeSlug, cities);
  el.classList.toggle(HIDE_CLASS, !visible);

  for (const v of unknownValues) {
    const key = `${attr}|${v}`;
    if (warnedValues.has(key)) continue;
    warnedValues.add(key);
    console.warn(
      `[bruce.city-visibility] data-city-show="${attr}" — value "${v}" matched no known city.`,
      "Known cities:",
      cities.map((c) => ({ slug: c.slug, name: c.name })),
    );
  }
}

/**
 * Sweep every `[data-city-show]` element in the document. Sets the
 * `is-city-ready` body class once a sweep completes with a non-null slug,
 * which drops the global pre-hide rule.
 */
function sweep() {
  const api = /** @type {any} */ (window).bruce?.city;
  if (!api) return;
  const activeSlug = api.get();
  const cities = api.all();

  document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
    applyVisibility(/** @type {HTMLElement} */ (el), activeSlug, cities);
  });

  if (activeSlug) {
    document.body.classList.add(READY_CLASS);
  }
}

// ── Debounced re-sweep ───────────────────────────────────────
// A burst of mutations or simultaneous onChange + insert triggers one pass.

let pendingRafId = 0;
const scheduleSweep = () => {
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    sweep();
  });
};

// ── MutationObserver: catch late inserts ─────────────────────
// Cheap pre-filter (matches + querySelector only, no walk) — same pattern
// as src/city.js's observer. Webflow pages mutate constantly; expensive
// per-node walks would dominate the main thread.

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches?.(`[${ATTR}]`) || el.querySelector?.(`[${ATTR}]`)) {
        scheduleSweep();
        return;
      }
    }
  }
});

// ── Boot ─────────────────────────────────────────────────────
// Subscribes to city.onChange, runs an initial sweep, then arms the
// observer + safety-pass timers. Idempotent if re-invoked.

const boot = () => {
  const api = /** @type {any} */ (window).bruce?.city;
  api?.onChange?.(() => scheduleSweep());

  sweep(); // may run with null slug → all data-city-show get is-city-hidden,
  // body.is-city-ready stays unset, pre-hide remains. onChange or a safety
  // pass will re-run once city.js resolves.

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

- [ ] **Step 2: Wire into `src/index.js`**

Open `src/index.js` and add the import directly after the existing `city.js` import. Final state:

```js
import "./nav.js";
import "./announcements.js";
import "./modal.js";
import "./accordion.js";
import "./collapsible.js";
import "./dropdown.js";
import "./variables.js";
import "./city.js";
import "./city-visibility.js";
import "./location.js";
import "./studios-search-redirect.js";
import "./slider.js";
import "./tab.js";
import "./visual-video.js";
```

- [ ] **Step 3: Verify the pure-helper tests still pass**

Run: `node tests/city-visibility-decide.test.mjs`
Expected: `✓ all 22 assertions passed`

This re-runs the existing tests to confirm the helper module wasn't accidentally touched while wiring in the apply layer.

- [ ] **Step 4: Verify the bundle builds cleanly**

Run:
```bash
rm -rf .parcel-cache dist && pnpm build
```

Expected: build completes without errors and writes `dist/index.js`. The `rm -rf` is required — Parcel's stale-cache gotcha can otherwise emit a `dist/` that doesn't include the new module (see project memory `parcel_stale_cache_gotcha`).

- [ ] **Step 5: Commit**

```bash
git add src/city-visibility.js src/index.js dist/
git commit -m "$(cat <<'EOF'
Add city-visibility DOM apply layer + observer + boot

Subscribes to window.bruce.city.onChange to toggle the is-city-hidden
class on `[data-city-show]` elements, sets body.is-city-ready after
the first sweep against a non-null active city, and catches Finsweet
late inserts via a narrow MutationObserver plus safety-pass timers.
EOF
)"
```

---

## Task 3: Cross-reference `data-city-show` in `src/city.js` docblock

**Files:**
- Modify: `src/city.js` (top docblock only)

- [ ] **Step 1: Add a cross-reference block to the top docblock**

Find these two lines in `src/city.js`:

```js
 *   window.bruce.city.onChange(fn) → subscribe; returns unsubscribe
 */
```

Replace with:

```js
 *   window.bruce.city.onChange(fn) → subscribe; returns unsubscribe
 *
 * ── Related ──────────────────────────────────────────────────
 * `data-city-show="<slug-or-name>[,...]"` toggles element visibility
 * based on the active city — see src/city-visibility.js.
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/city.js
git commit -m "Cross-reference data-city-show in city.js docblock"
```

---

## Task 4: Manual verification on Webflow staging

This task does not produce code. It verifies the feature works end-to-end before the branch is shipped. The CSS rules below MUST be added to Webflow site-wide custom code on the staging site for the feature to behave correctly.

**Required CSS (paste into Webflow site-wide custom code, inside `<style>` tags in the `<head>`):**

```css
.is-city-hidden { display: none !important; }
body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
  display: none;
}
```

- [ ] **Step 1: Add the two CSS rules to Webflow staging site custom code**

Webflow → Project Settings → Custom Code → Head Code → paste the CSS above inside `<style>...</style>` tags. Save and republish staging.

- [ ] **Step 2: Add test elements to a staging page**

On any staging page (a layout that mirrors production city behavior is ideal), add four temporary elements:

```html
<div data-city-show="cph">Visible in Copenhagen only</div>
<div data-city-show="cph, sto">Visible in Copenhagen or Stockholm</div>
<div data-city-show="Stockholm">Visible in Stockholm (by name)</div>
<div data-city-show="malmo">Unknown city — should stay hidden + warn</div>
```

Publish staging.

- [ ] **Step 3: Verify initial-load behavior (cold cache)**

Open the staging page in a fresh incognito window with `localStorage` empty and no `?city=` param. The page resolves to the CMS default city.

Verify:
- No flash of any of the four test elements before resolution.
- Only the elements matching the default city are visible after resolution.
- The "unknown city" element is hidden.
- Browser console shows one `[bruce.city-visibility]` warning for the `malmo` value, with the known-cities list.

- [ ] **Step 4: Verify city switch behavior**

With the staging page still open, switch cities using whatever switcher UI exists on the staging site (e.g., click a `[data-set-city="sto"]` button, or call `window.bruce.city.set("sto")` from the console).

Verify:
- Elements update visibility immediately on switch (no page reload).
- No flicker — the switch happens within one animation frame.
- `localStorage` has the new city persisted (`bruce-city` key).

- [ ] **Step 5: Verify deep-link behavior**

Reload the staging page with `?city=cph` in the URL.

Verify:
- Elements matching `cph` are visible from first paint, no flash.
- The CMS-default-only element is hidden (assuming default is not `cph`).

- [ ] **Step 6: Verify late-insert behavior**

In the browser devtools console, run:

```js
const el = document.createElement("div");
el.setAttribute("data-city-show", "cph");
el.textContent = "Late-inserted CPH-only element";
document.body.appendChild(el);
```

Verify:
- The element is correctly toggled (visible only if active city is `cph`) on the next animation frame.
- No console errors.

- [ ] **Step 7: Verify fail-closed behavior**

Open devtools, find the built `applyCity` function inside `dist/index.js`, set a breakpoint on its first line, then reload the staging page.

Verify (while paused at the breakpoint):
- All `[data-city-show]` elements with non-empty attributes are `display: none` via the pre-hide CSS rule (inspect computed style).
- The `<body>` element does NOT have the `is-city-ready` class.

Resume execution:
- After `applyCity` completes, the sweep runs and `is-city-ready` appears on `<body>`.
- Matching elements reveal; non-matching elements keep `display: none` (now via `is-city-hidden` class).

- [ ] **Step 8: Remove the temporary test elements**

Delete the four test `<div>`s from the staging page. The CSS rules stay (they're harmless when no `data-city-show` elements exist).

- [ ] **Step 9: Confirm working tree is clean**

```bash
git status
```

Expected: only the dist build artifacts from Task 2 (if anything) and no stray local debugging changes.

---

## Definition of Done

- [ ] `node tests/city-visibility-decide.test.mjs` passes (22 assertions).
- [ ] `pnpm build` completes cleanly after `rm -rf .parcel-cache dist`.
- [ ] Staging verification steps 3–7 all pass.
- [ ] The two required CSS rules are queued for production Webflow custom code at release time — flag this in the PR description so the deployer doesn't forget. Without the CSS, the feature has no pre-hide protection and the `is-city-hidden` class won't reliably beat Webflow's class-driven display values.
- [ ] PR description includes the editor-facing usage notes from the `src/city-visibility.js` docblock so reviewers and editors know how to use the new attribute.
