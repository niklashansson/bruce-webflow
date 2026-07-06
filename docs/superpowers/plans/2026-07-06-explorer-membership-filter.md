# Explorer Membership Filter (Radios + Exclusive Toggle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-select membership filter (native radios) plus a "Show exclusive to X" toggle that narrows the list to studios exclusive to the selected membership — all matching done natively by Finsweet, JS only keeps the toggle's `fs-list-value` pointed at the selected radio.

**Architecture:** The membership radios (`fs-list-field="tiers"`, `fs-list-operator="contain"`) already filter the *included* set natively. The toggle is a real Finsweet condition input (`fs-list-field="tier"`, `fs-list-operator="equal"`) living inside the filters form; explorer.js glue rewrites its `fs-list-value` to the selected membership and dispatches a `change` event so Finsweet re-reads the condition. Both conditions AND natively; the exclusive set is a strict subset of the included set, so no negation exists anywhere.

**Tech Stack:** Vanilla JS (Parcel bundle `src/explorer.js`), Finsweet Attributes v2 `fs-list` (loaded by Webflow), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-06-explorer-membership-filter-design.md`

## Global Constraints

- Never set `.checked` directly on Finsweet-bound inputs — always `.click()` (desyncs the Finsweet model and Webflow custom-input visuals otherwise).
- The toggle input must stay INSIDE the `<form fs-list-element="filters">` subtree (Finsweet's change listener is on the form; already placed there in Webflow).
- The toggle must NEVER count into filter badges (`data-search-count`) or the grand total in `reflectFilters`.
- Wrap state attributes follow the existing pattern on `.explorer_wrap`: `data-explorer-membership`, `data-explorer-exclusive-available`, `data-explorer-exclusive`.
- The toggle label copy is static, Webflow-authored — JS never writes label text.
- Comments in explorer.js follow its existing style: block comments explaining constraints/why, not what.
- Release builds: `rm -rf .parcel-cache dist && pnpm build` (stale-cache gotcha), dist is committed minified, purge jsDelivr `@main` after pushing dist.

**Webflow prerequisites (already done by the user, verify before starting):**
- Membership inputs are radios: `input[type="radio"]` with `fs-list-field="tiers"`, `fs-list-operator="contain"`, `fs-list-value="base|black|epic"`.
- Toggle checkbox inside the filters form: `fs-list-field="tier"`, `fs-list-operator="equal"`, NO `fs-list-value`, and `data-explorer-element="exclusive-toggle"` on the `<input>` element itself.

---

### Task 1: Exclusive-toggle glue in explorer.js

**Files:**
- Modify: `src/explorer.js` (selector map `S` around line 35–66; new function after `reflectFilters` ~line 201; call sites in `setupFilterForms` ~line 236 and `refreshFilterForms` ~line 225)

**Interfaces:**
- Consumes: existing `S.wrap` selector, existing `setupFilterForms` / `refreshFilterForms` wiring.
- Produces: `syncExclusiveToggle(form)` — called with each filters `HTMLFormElement`; Task 2 depends on `S.exclusiveToggle` existing in the selector map; Task 3 (manual verification) depends on the wrap attributes below.

There is no DOM test rig in this repo (tests are framework-free pure-module tests; this is DOM glue — the spec explicitly opts for manual live-page verification, Task 3). So this task is implement → build → commit.

- [ ] **Step 1: Add the toggle selector to the `S` map**

In `src/explorer.js`, add to the `S` object (after the `filterBar` entry):

```js
  // The "Show exclusive to X" switch — a real Finsweet condition input
  // (fs-list-field="tier" fs-list-operator="equal") inside the filters form.
  exclusiveToggle: '[data-explorer-element="exclusive-toggle"]',
```

- [ ] **Step 2: Add the membership-radio selector constant and `syncExclusiveToggle`**

Insert after the `reflectFilters` function (before `syncCityLinks`):

```js
// ── Exclusive toggle ─────────────────────────────────────────
// The membership radios (fs-list-field="tiers", operator contain) natively
// filter to the studios INCLUDED in the selected membership. The exclusive
// toggle is a real Finsweet condition input (fs-list-field="tier", operator
// equal) with NO authored fs-list-value: this function keeps that attribute
// pointed at the selected membership and dispatches a change event so
// Finsweet re-reads the condition. tier=X implies X ∈ tiers, so the two
// conditions AND into "exclusive to X" — a strict subset, never a negation.
// Spec: docs/superpowers/specs/2026-07-06-explorer-membership-filter-design.md
const MEMBERSHIP_RADIO = 'input[type="radio"][fs-list-field="tiers"]';

function syncExclusiveToggle(form) {
  const toggle = form.querySelector(S.exclusiveToggle);
  if (!(toggle instanceof HTMLInputElement)) return;

  const radio = form.querySelector(`${MEMBERSHIP_RADIO}:checked`);
  const selected =
    radio?.getAttribute("fs-list-value") ?? radio?.value ?? "";

  // No membership → no reference for "exclusive"; force the switch off via
  // click (never .checked — that desyncs Finsweet and the Webflow visuals).
  if (!selected && toggle.checked) toggle.click();

  // Rewrite + re-dispatch only when the value really changed. The dispatched
  // change re-enters this function through the form's change listener; this
  // equality check is what terminates that recursion.
  if (toggle.getAttribute("fs-list-value") !== selected) {
    toggle.setAttribute("fs-list-value", selected);
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const wrap = form.closest(S.wrap);
  if (wrap instanceof HTMLElement) {
    if (selected) wrap.dataset.explorerMembership = selected;
    else delete wrap.dataset.explorerMembership;
    wrap.dataset.explorerExclusiveAvailable = selected ? "true" : "false";
    wrap.dataset.explorerExclusive =
      selected && toggle.checked ? "true" : "false";
  }
}
```

- [ ] **Step 3: Wire the call sites**

Three places, mirroring how `reflectFilters` is driven:

In `refreshFilterForms` (covers Finsweet's afterRender, incl. URL restore on load):

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

In `setupFilterForms`, inside the existing per-form `change` listener and the initial reflection:

```js
    form.addEventListener("change", () => {
      syncExclusiveToggle(form);
      reflectFilters(form);
      syncCityLinks();
    });
    syncExclusiveToggle(form);
    reflectFilters(form);
```

(`syncExclusiveToggle` runs before `reflectFilters` so the badge pass sees the settled toggle state.)

- [ ] **Step 4: Build to catch syntax errors**

Run: `pnpm build`
Expected: Parcel builds `dist/explorer.js` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/explorer.js
git commit -m "feat(explorer): exclusive-toggle glue — sync fs-list-value to selected membership"
```

---

### Task 2: Exclude the toggle from badge counting in `reflectFilters`

**Files:**
- Modify: `src/explorer.js` — the `for (const el of form.querySelectorAll("input:checked"))` loop inside `reflectFilters` (~line 170)

**Interfaces:**
- Consumes: `S.exclusiveToggle` from Task 1.
- Produces: nothing new — behavioral guarantee that the toggle never counts as a filter selection.

The toggle input carries `fs-list-field="tier"`, so without this it would count into the group badges and the grand total. The membership *radio* still counts (that keeps `data-explorer-filtered` / collections-hide working); only the toggle is skipped.

- [ ] **Step 1: Add the skip**

In `reflectFilters`, first line inside the `input:checked` loop:

```js
  for (const el of form.querySelectorAll("input:checked")) {
    // The exclusive toggle is a refinement of the membership selection, not a
    // filter of its own — it must never count into badges or the total.
    if (el.matches(S.exclusiveToggle)) continue;
    const field = el.getAttribute("fs-list-field");
    ...
```

(Only the `continue` line and comment are new; the rest of the loop is unchanged.)

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/explorer.js
git commit -m "fix(explorer): exclusive toggle never counts into filter badges"
```

---

### Task 3: Manual verification on the explorer page (spec verification points)

**Files:**
- None (browser verification). Fallback code, if needed, modifies `src/explorer.js` (see Step 4).

**Interfaces:**
- Consumes: Tasks 1–2 deployed to a page where the Webflow prerequisites exist (radios + toggle input). Use the Webflow staging domain with the locally built script, or publish and purge per Task 4 first — whichever the user prefers.

Checklist (all on `/studios/city/<slug>`):

- [ ] **Step 1: Core flows**

1. No membership selected → toggle row hidden (`data-explorer-exclusive-available="false"` on `.explorer_wrap`), list unfiltered.
2. Select each membership radio → count drops to the included set; "Memberships ①" badge shows 1; toggle row appears.
3. Flip the toggle ON → count drops to the exclusive subset (`tier equal <selected>`); badge STILL shows 1 (toggle not counted); `data-explorer-exclusive="true"`.
4. Switch membership while toggle is ON → list follows the new membership's exclusive set without touching the toggle.
5. Uncheck/clear the membership (per-field clear or "Clear all") → toggle force-unchecks and hides; list resets.
6. Map open during 2–4 → markers follow each change (existing afterRender flow).
7. Exclusive set empty for some membership → `data-state="empty"` empty state renders.

- [ ] **Step 2: Verification point — unchecked-toggle condition is inert**

With a membership selected and toggle OFF, confirm the result set equals the included set exactly (the `tier_equal` condition contributes nothing while unchecked).

- [ ] **Step 3: Verification point — URL restore via fs-list-showquery**

Toggle ON, copy the URL, open in a new tab. Confirm BOTH the membership radio and the toggle restore, and the list shows the exclusive set.

- [ ] **Step 4: Fallback ONLY if Step 3 fails — hand-rolled `exclusive=1` param**

If Finsweet does not restore the toggle's dynamic-value condition, add to `src/explorer.js`:

```js
// fs-list-showquery can't restore the toggle (its fs-list-value is empty
// until the glue runs), so the toggle state rides a dedicated param instead.
const EXCLUSIVE_PARAM = "exclusive";
let exclusiveRestored = false;

function persistExclusiveToUrl(form) {
  const toggle = form.querySelector(S.exclusiveToggle);
  if (!(toggle instanceof HTMLInputElement)) return;
  const url = new URL(location.href);
  if (toggle.checked) url.searchParams.set(EXCLUSIVE_PARAM, "1");
  else url.searchParams.delete(EXCLUSIVE_PARAM);
  history.replaceState(history.state, "", url);
}

// One-shot, from the first afterRender (AFTER Finsweet restored the radio).
function restoreExclusiveFromUrl(form) {
  if (exclusiveRestored) return;
  exclusiveRestored = true;
  if (new URLSearchParams(location.search).get(EXCLUSIVE_PARAM) !== "1") return;
  const toggle = form.querySelector(S.exclusiveToggle);
  const hasMembership = form.querySelector(`${MEMBERSHIP_RADIO}:checked`);
  if (toggle instanceof HTMLInputElement && !toggle.checked && hasMembership) {
    toggle.click();
  }
}
```

Call `restoreExclusiveFromUrl(form)` at the top of `refreshFilterForms`'s per-form loop, and `persistExclusiveToUrl(form)` at the end of `syncExclusiveToggle`. Re-run Steps 1 and 3, then commit:

```bash
git add src/explorer.js
git commit -m "feat(explorer): exclusive=1 URL param fallback for toggle deep-links"
```

- [ ] **Step 5: Verification point — deselect affordance**

Radios can't be un-clicked. Confirm the filter UI has a per-field clear / "All" affordance (`fs-list-element="clear"` with `fs-list-field="tiers"`, or the global clear). If missing, flag to the user — that's a Webflow build item, not JS.

- [ ] **Step 6: Mobile bottom-sheet pass**

On a narrow viewport, open the map: the filter bar (toggle included, since it lives in the form) moves into the sheet header via the existing `placeFilterBar`. Repeat Step 1 flows 2–3 there.

---

### Task 4: Release build + deploy

**Files:**
- Modify: `dist/` (committed minified build)

- [ ] **Step 1: Clean release build** (stale-cache gotcha — Parcel can report success but ship a stale dist)

```bash
rm -rf .parcel-cache dist && pnpm build
```

Expected: fresh `dist/explorer.js` (+ index/studio bundles), minified.

- [ ] **Step 2: Commit and push dist**

```bash
git add dist && git commit -m "build: dist for explorer membership filter + exclusive toggle"
git push
```

- [ ] **Step 3: Purge jsDelivr** (browser/incognito cache does NOT bypass the CDN edge cache)

Purge the `@main` bundle URLs via `https://purge.jsdelivr.net/...` for `dist/explorer.js` (and any other shipped bundles).

- [ ] **Step 4: Re-run Task 3 Step 1 on the live page**

Confirm the production page behaves; done.
