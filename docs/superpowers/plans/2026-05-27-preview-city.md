# Preview-City (Webflow Designer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `data-preview-city` attribute that lets editors preview a single city's `[data-city-show]` content inside the Webflow Designer canvas — CSS-only, no JS module changes.

**Architecture:** Two changes outside the repo (one site-wide CSS prefix update, one new Embed inside the Globals Symbol) plus one repo change (the `src/city-visibility.js` docblock is updated to reflect the new CSS contract and cross-reference the preview feature). No JS behavior changes. No new tests — the feature is pure CSS gated by Webflow's `.wf-design-mode` class.

**Tech Stack:** Webflow Designer (custom code in Project Settings + Embed component inside a Symbol), CSS `:has()` selector. No new repo dependencies.

---

## File Structure

**Modify (repo):**
- `src/city-visibility.js` — top docblock only. Update the documented CSS contract to include the `html:not(.wf-design-mode)` prefix on the pre-hide rule, and add a "Related" line cross-referencing `data-preview-city`. No behavior change.

**Modify (outside repo, in Webflow Designer):**
- Webflow Project Settings → Custom Code → Head Code → existing `<style>` block containing the city-visibility CSS contract. One selector prefix added to the pre-hide rule.
- The Globals Symbol → new Webflow Embed component → CSS block with per-city preview rules.
- The Globals Symbol → one wrapper element gains the `data-preview-city` custom attribute.

**No tests:** the feature is CSS-only. The shipped `tests/city-visibility-decide.test.mjs` still passes and stays the source of truth for the pure helper.

---

## Task 1: Update the `src/city-visibility.js` docblock

**Files:**
- Modify: `src/city-visibility.js` (top docblock only, lines 7-11 in the "Required CSS" block plus a new "Related" section near the bottom of the docblock).

- [ ] **Step 1: Update the required-CSS block in the docblock**

Open `src/city-visibility.js`. Find this exact block in the top docblock:

```js
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
 *     display: none;
 *   }
```

Replace with:

```js
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   html:not(.wf-design-mode) body:not(.is-city-ready)
 *     [data-city-show]:not([data-city-show=""]) {
 *     display: none;
 *   }
 *
 * The html:not(.wf-design-mode) prefix lets editors preview one city
 * at a time in the Webflow Designer via the data-preview-city
 * attribute — see specs/2026-05-27-preview-city-design.md.
```

- [ ] **Step 2: Verify no other changes**

Run: `git diff src/city-visibility.js`
Expected: only the docblock lines changed. No JS code, exports, or comments outside the docblock are touched.

- [ ] **Step 3: Commit**

```bash
git add src/city-visibility.js
git commit -m "$(cat <<'EOF'
Document data-preview-city in city-visibility docblock

The shipped pre-hide CSS rule gains an html:not(.wf-design-mode)
prefix so editors can use data-preview-city inside the Webflow
Designer canvas. See specs/2026-05-27-preview-city-design.md.
EOF
)"
```

---

## Task 2: Update the site-wide pre-hide CSS rule in Webflow

**Where:** Webflow Project Settings → Custom Code → Head Code.

This task is performed in the Webflow Designer, not in the repo. It updates the CSS contract that was shipped with the city-visibility feature.

- [ ] **Step 1: Open Webflow Project Settings**

In the Webflow Designer, click the project name in the top-left, then "Project Settings" → "Custom Code" tab → "Head Code" panel.

- [ ] **Step 2: Find the existing city-visibility CSS block**

Inside the Head Code, look for a `<style>` block containing rules with `.is-city-hidden` and `body:not(.is-city-ready) [data-city-show]…`. That was added when the city-visibility feature was deployed.

If the block looks like this (the originally shipped contract):

```html
<style>
  .is-city-hidden { display: none !important; }
  body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
    display: none;
  }
</style>
```

- [ ] **Step 3: Replace the pre-hide rule with the prefixed version**

Change the block to exactly:

```html
<style>
  .is-city-hidden { display: none !important; }
  html:not(.wf-design-mode) body:not(.is-city-ready)
    [data-city-show]:not([data-city-show=""]) {
    display: none;
  }
</style>
```

The only change is the `html:not(.wf-design-mode)` prefix on the second selector. The first rule (`.is-city-hidden`) is unchanged.

- [ ] **Step 4: Save the Project Settings**

Click "Save Changes" in Project Settings.

- [ ] **Step 5: Publish to `*.webflow.io` staging**

Click "Publish" in the Designer top-right, select the `*.webflow.io` staging domain only (NOT the custom production domain yet — verify on staging first).

- [ ] **Step 6: Quick smoke test on staging**

Open the staging URL in a regular browser (not the Designer). Verify any page with `[data-city-show]` elements still works:

- No FOUC on initial load.
- Only the active city's content appears after JS resolves.
- Switching cities still works.

If anything regressed, revert the change (drop the `html:not(.wf-design-mode)` prefix) and stop — don't proceed to Task 3 until the pre-hide change is confirmed safe.

---

## Task 3: Add the preview-city Embed inside the Globals Symbol

**Where:** Webflow Designer → open the Globals Symbol master.

This task adds the preview rules. They live inside the Globals Symbol so they travel with the cities CMS list.

- [ ] **Step 1: Open the Globals Symbol master**

In the Webflow Designer, open any page that contains the Globals Symbol. Right-click the Symbol → "Edit Symbol", or use the Symbols panel to open the master.

- [ ] **Step 2: Add a new Embed component**

From the Add panel, drag a "Embed" component into the Globals Symbol. Place it at the end of the Symbol's contents (alongside or near the existing `[data-city-list]` element). The Embed renders no visible output — it only injects CSS.

- [ ] **Step 3: Paste the preview CSS into the Embed**

Open the Embed's code editor. Paste this exact CSS, then click "Save & Close":

```html
<style>
  /* Designer preview overrides — see docs/superpowers/specs/2026-05-27-preview-city-design.md
     One block per previewable city. When data-preview-city matches the slug, hide every
     [data-city-show] that does not contain the slug or name. Matching elements keep their
     natural Webflow display (flex, grid, block) because nothing un-hides them — they're
     simply not hidden in the first place when the modified pre-hide rule skips the
     Designer (gated by html:not(.wf-design-mode) in site-wide CSS). */

  /* Copenhagen */
  html.wf-design-mode:has([data-preview-city="cph"])
    [data-city-show]:not([data-city-show=""])
    :not([data-city-show*="cph" i])
    :not([data-city-show*="copenhagen" i]) {
    display: none !important;
  }

  /* Stockholm */
  html.wf-design-mode:has([data-preview-city="sto"])
    [data-city-show]:not([data-city-show=""])
    :not([data-city-show*="sto" i])
    :not([data-city-show*="stockholm" i]) {
    display: none !important;
  }

  /* Oslo */
  html.wf-design-mode:has([data-preview-city="osl"])
    [data-city-show]:not([data-city-show=""])
    :not([data-city-show*="osl" i])
    :not([data-city-show*="oslo" i]) {
    display: none !important;
  }
</style>
```

Note: the three cities above (`cph`, `sto`, `osl`) match the project's current cities. If the project has different or additional cities, follow the same per-block pattern for each, using the slug and name from the CMS.

- [ ] **Step 4: Add the `data-preview-city` attribute to a wrapper inside Globals**

The attribute can live on any element inside the Symbol — `:has()` finds it document-wide. The cleanest placement is on the same wrapper that already holds `data-city-list` (the hidden CMS list wrapper), OR on the Globals Symbol's root container. Pick one:

Option A — on the `[data-city-list]` wrapper:

1. Select the existing element that has the custom attribute `data-city-list` (no value).
2. In the Element Settings panel → Custom Attributes → click "+" to add a new attribute.
3. Name: `data-preview-city`. Value: leave empty for now (preview off by default).
4. Click "Save".

Option B — on the Globals Symbol root:

1. Select the outermost element of the Globals Symbol.
2. Add the custom attribute `data-preview-city` with empty value.

Either placement works. Option A keeps the city-related attributes co-located.

- [ ] **Step 5: Save the Symbol**

Save the Symbol changes. This persists the Embed and the attribute to the Symbol master, propagating to every instance.

- [ ] **Step 6: Publish to staging**

Publish the project to `*.webflow.io` staging only.

---

## Task 4: Verify in the Webflow Designer

This task validates the editor experience end-to-end. Performed entirely in the Webflow Designer canvas (not on the published site).

- [ ] **Step 1: Open a page containing `[data-city-show]` elements in the Designer**

The studios page is a good choice — it has city-conditional content from the just-shipped city-visibility feature.

If the page doesn't have any `[data-city-show]` elements yet, add a few temporary ones for the test:

```html
<div data-city-show="cph">Visible in Copenhagen only</div>
<div data-city-show="cph, sto">Visible in Copenhagen or Stockholm</div>
<div data-city-show="Stockholm">Visible in Stockholm (by name)</div>
<div data-city-show="osl">Visible in Oslo only</div>
```

- [ ] **Step 2: Confirm default Designer state — everything visible**

With `data-preview-city` set to empty (the default), all four test elements should be visible in the Designer canvas. This is the new behavior unlocked by the `html:not(.wf-design-mode)` prefix on the pre-hide rule — editors can see all city-conditional content while editing.

Before this change, all four would have been hidden by pre-hide. After the change, they're all visible.

- [ ] **Step 3: Set `data-preview-city="cph"` and verify Copenhagen preview**

Open the Globals Symbol, set `data-preview-city` to `cph`. The Designer canvas should immediately update:

- "Visible in Copenhagen only" — visible ✓
- "Visible in Copenhagen or Stockholm" — visible ✓
- "Visible in Stockholm (by name)" — hidden
- "Visible in Oslo only" — hidden

- [ ] **Step 4: Verify layout integrity in preview**

Inspect one of the matching elements (e.g., a flex container with `data-city-show="cph"`). Confirm that its layout (flex direction, grid placement, etc.) is preserved — i.e., the preview did not flatten it to `display: block`. This is the key benefit of the "hide non-matches" inversion: matches keep their natural display.

If matching elements look layout-broken, the pre-hide rule was probably NOT updated correctly in Task 2 (the `html:not(.wf-design-mode)` prefix is missing). Revisit Task 2.

- [ ] **Step 5: Switch to `data-preview-city="sto"` and verify Stockholm preview**

Change the attribute value to `sto`. Verify:

- "Visible in Copenhagen only" — hidden
- "Visible in Copenhagen or Stockholm" — visible ✓ (matched by "sto")
- "Visible in Stockholm (by name)" — visible ✓ (matched by "stockholm" name)
- "Visible in Oslo only" — hidden

- [ ] **Step 6: Switch to `data-preview-city="osl"` and verify Oslo preview**

Change to `osl`. Verify:

- "Visible in Copenhagen only" — hidden
- "Visible in Copenhagen or Stockholm" — hidden
- "Visible in Stockholm (by name)" — hidden
- "Visible in Oslo only" — visible ✓

- [ ] **Step 7: Clear the attribute and verify default returns**

Clear `data-preview-city` (delete the attribute or set value to empty). Confirm all four test elements are visible again.

- [ ] **Step 8: Verify staging is unaffected**

Open the staging URL (`*.webflow.io`) in a regular browser with empty localStorage and no `?city=` param. Verify the published staging site still behaves like the production city-visibility feature — only the resolved city's elements appear, no flash, switchers work.

The `data-preview-city` attribute is in the published HTML (the Symbol carried it through), but `.wf-design-mode` is not in the live HTML, so all the preview CSS rules are inert. Confirm via DevTools: inspect `<html>` and verify the class list does NOT include `wf-design-mode`.

- [ ] **Step 9: Remove test elements**

If you added temporary test elements in Step 1, remove them now.

- [ ] **Step 10: Publish to production**

Once staging is verified and editors are happy with the Designer preview behavior, publish to the custom production domain.

---

## Definition of Done

- [ ] `src/city-visibility.js` docblock reflects the new CSS contract and references the preview-city spec.
- [ ] Site-wide custom code in Webflow has the `html:not(.wf-design-mode)` prefix on the pre-hide rule.
- [ ] The Globals Symbol contains an Embed with per-city preview rules covering every CMS-defined city.
- [ ] A wrapper inside the Globals Symbol carries the `data-preview-city` attribute (default value empty).
- [ ] All eight verification steps in Task 4 pass.
- [ ] Production custom domain is published with the changes from Task 2 (no new code needs deploying for Tasks 3-4 — they live entirely in the Webflow Designer / Symbol layer).
- [ ] PR description (if a PR is opened for the docblock change) includes a reminder for the deployer that the matching Webflow custom-code change must be published before merging, otherwise the docblock would describe contract that doesn't exist on the live site yet.
