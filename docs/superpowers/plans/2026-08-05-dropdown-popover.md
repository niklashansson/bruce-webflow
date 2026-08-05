# Dropdown Popover Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render dropdown panels in the browser's top layer so they stop being clipped by the mobile bottom sheet, and position them with shadcn/Radix-style flip, shift and height-clamp collision handling.

**Architecture:** A new pure module `src/dropdown-place.js` owns the placement maths over plain numbers (unit-tested, no DOM). `src/dropdown.js` keeps all its existing behaviour and gains three things: the panel is portaled to the top layer via the native `popover` API on open, positioned with `place()`, and re-positioned by a single rAF-throttled tracking loop while open.

**Tech Stack:** Vanilla ES modules, bundled by Parcel. No new dependencies. Tests are framework-free `node:assert` scripts run directly with `node`.

## Global Constraints

- **No new runtime dependencies.** `package.json` gains nothing.
- **No Webflow-side changes.** No new classes, attributes or embeds are required of the site editor.
- **Pure modules stay pure.** `src/dropdown-place.js` must not touch the DOM, `window`, or any global. It takes numbers and returns numbers, matching `src/city-visibility-decide.js` and `src/city-links-plan.js`.
- **Tests are framework-free.** Pattern: `import assert from "node:assert/strict"`, a local `check()` helper, a `passed` counter, and a final `console.log(\`✓ all ${passed} assertions passed\`)`. Run with `node tests/<name>.test.mjs`. No test runner, no config.
- **Coordinates are client coordinates** throughout — the space `getBoundingClientRect()` reports in. Never page/document coordinates.
- **`gap` = 8px, `inset` = 8px.** Defined once as `GAP_PX` / `INSET_PX` in `src/dropdown.js` and passed in.
- **The iOS 16 path must keep working.** When `showPopover` is unavailable, `dropdown.js` behaves exactly as it does today — no portal, no positioning, no tracking.
- **Existing behaviour is preserved:** open/close, the WAAPI height/opacity/transform tween, outside-click dismissal, Escape, ArrowUp/ArrowDown roving, one-open-at-a-time, `zCounter` stacking, and the `data-open-on-hover-in` / `data-close-on-hover-out` attributes.

Spec: `docs/superpowers/specs/2026-08-05-dropdown-popover-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/dropdown-place.js` (create) | Pure flip / shift / clamp maths. One export: `place()`. |
| `tests/dropdown-place.test.mjs` (create) | Unit tests for `place()`. |
| `src/dropdown.js` (modify) | Behaviour: open/close, animation, a11y, portal lifecycle, tracking loop. Calls `place()`; owns all DOM reads and writes. |
| `dist/*` (regenerate) | Parcel build output, committed minified. |

---

## Task 1: Pure placement module

**Files:**
- Create: `src/dropdown-place.js`
- Test: `tests/dropdown-place.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `place({ anchor, panel, viewport, gap, inset })` → `{ placement: "bottom"|"top", top: number, left: number, maxHeight: number }`.
  - `anchor`: `{ top, bottom, left, width }` — client rect of the toggle.
  - `panel`: `{ width, height }` — the panel's **natural** size, measured unconstrained.
  - `viewport`: `{ top, left, width, height }` — visible band in client coordinates.
  - `gap` defaults to `8`, `inset` defaults to `8`.

- [ ] **Step 1: Write the failing test**

Create `tests/dropdown-place.test.mjs`:

```js
// Unit tests for the pure dropdown placement helper.
// Framework-free: run with `node tests/dropdown-place.test.mjs`.
import assert from "node:assert/strict";
import { place } from "../src/dropdown-place.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// A 400x800 phone viewport with no visual-viewport offset.
const PHONE = { top: 0, left: 0, width: 400, height: 800 };

// ── Vertical placement ───────────────────────────────────────

check(
  "fits below — placed below, unclamped",
  place({
    anchor: { top: 100, bottom: 130, left: 20, width: 100 },
    panel: { width: 200, height: 300 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 20, maxHeight: 300 },
);

check(
  "does not fit below but fits above — flips, unclamped",
  place({
    anchor: { top: 600, bottom: 630, left: 20, width: 100 },
    panel: { width: 200, height: 400 },
    viewport: PHONE,
  }),
  { placement: "top", top: 192, left: 20, maxHeight: 400 },
);

check(
  "fits neither, more room above — flips and clamps to the space above",
  place({
    anchor: { top: 500, bottom: 530, left: 20, width: 100 },
    panel: { width: 200, height: 900 },
    viewport: PHONE,
  }),
  { placement: "top", top: 8, left: 20, maxHeight: 484 },
);

check(
  "fits neither, more room below — stays below and clamps",
  place({
    anchor: { top: 200, bottom: 230, left: 20, width: 100 },
    panel: { width: 200, height: 900 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 238, left: 20, maxHeight: 554 },
);

// ── Horizontal shift ─────────────────────────────────────────

check(
  "anchor near the right edge — panel shifts left to stay inside the inset",
  place({
    anchor: { top: 100, bottom: 130, left: 350, width: 40 },
    panel: { width: 200, height: 100 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 192, maxHeight: 100 },
);

check(
  "panel wider than the viewport — pinned to the left inset, not snapped right",
  place({
    anchor: { top: 100, bottom: 130, left: 350, width: 40 },
    panel: { width: 500, height: 100 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 8, maxHeight: 100 },
);

// ── Visual viewport ──────────────────────────────────────────

check(
  "offset viewport (soft keyboard / pinch zoom) is respected",
  place({
    anchor: { top: 150, bottom: 180, left: 20, width: 100 },
    panel: { width: 200, height: 500 },
    viewport: { top: 100, left: 0, width: 400, height: 300 },
  }),
  { placement: "bottom", top: 188, left: 20, maxHeight: 204 },
);

// ── Degenerate space ─────────────────────────────────────────

check(
  "no room on either side — maxHeight floors at 0, never negative",
  place({
    anchor: { top: 0, bottom: 40, left: 20, width: 100 },
    panel: { width: 200, height: 300 },
    viewport: { top: 0, left: 0, width: 400, height: 40 },
  }),
  { placement: "bottom", top: 48, left: 20, maxHeight: 0 },
);

check(
  "custom gap and inset are honoured",
  place({
    anchor: { top: 100, bottom: 130, left: 0, width: 100 },
    panel: { width: 200, height: 100 },
    viewport: PHONE,
    gap: 4,
    inset: 16,
  }),
  { placement: "bottom", top: 134, left: 16, maxHeight: 100 },
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/dropdown-place.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/dropdown-place.js`.

- [ ] **Step 3: Write the implementation**

Create `src/dropdown-place.js`:

```js
/**
 * Pure placement helper for dropdown.js. Framework-free (no DOM, no globals)
 * so the flip / shift / clamp rules live in one unit-testable place.
 *
 * Everything is plain numbers in CLIENT coordinates — the same space
 * getBoundingClientRect() reports in. The caller measures and applies; this
 * only decides.
 *
 * Rules, in order:
 *   1. Prefer below the anchor. If the panel's natural height fits there, done.
 *   2. Otherwise try above. If it fits there, flip.
 *   3. If it fits neither, take whichever side has more room and clamp the
 *      height to it — the caller scrolls the overflow inside the panel.
 *   4. Left-align to the anchor, then slide horizontally to stay inside the
 *      viewport's inset box.
 *
 * @param {object} input
 * @param {{top: number, bottom: number, left: number, width: number}} input.anchor
 *   Client rect of the toggle.
 * @param {{width: number, height: number}} input.panel
 *   The panel's NATURAL size — measured unconstrained, before any clamping.
 * @param {{top: number, left: number, width: number, height: number}} input.viewport
 *   The visible band, in client coordinates. With a soft keyboard open this is
 *   the visual viewport: shorter than, and possibly offset from, the layout one.
 * @param {number} [input.gap=8] Space between the anchor and the panel.
 * @param {number} [input.inset=8] Minimum space between the panel and the
 *   viewport edge.
 * @returns {{placement: "bottom" | "top", top: number, left: number, maxHeight: number}}
 */
export function place({ anchor, panel, viewport, gap = 8, inset = 8 }) {
  const viewportBottom = viewport.top + viewport.height;
  const viewportRight = viewport.left + viewport.width;

  // Room available to the panel on each side, with the gap and the edge inset
  // already deducted. Goes negative when the anchor sits outside the viewport.
  const spaceBelow = viewportBottom - inset - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - (viewport.top + inset);

  // Ties go to "bottom" — the default reading direction for a dropdown.
  let placement;
  if (panel.height <= spaceBelow) placement = "bottom";
  else if (panel.height <= spaceAbove) placement = "top";
  else placement = spaceAbove > spaceBelow ? "top" : "bottom";

  const space = placement === "bottom" ? spaceBelow : spaceAbove;
  // Floor at 0: an anchor scrolled off-screen must not yield a negative
  // max-height, which CSS would reject and leave the panel unclamped.
  const maxHeight = Math.max(0, Math.min(panel.height, space));

  const top =
    placement === "bottom" ? anchor.bottom + gap : anchor.top - gap - maxHeight;

  // Left-align to the anchor, then shift into the inset box. When the panel is
  // wider than that box the two bounds invert, so pin to the left edge rather
  // than letting the clamp snap it right.
  const minLeft = viewport.left + inset;
  const maxLeft = viewportRight - inset - panel.width;
  const left =
    maxLeft < minLeft
      ? minLeft
      : Math.min(Math.max(anchor.left, minLeft), maxLeft);

  return { placement, top, left, maxHeight };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/dropdown-place.test.mjs`
Expected: PASS — `✓ all 9 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/dropdown-place.js tests/dropdown-place.test.mjs
git commit -m "feat(dropdown): pure flip/shift/clamp placement helper"
```

---

## Task 2: Portal the panel to the top layer

**Files:**
- Modify: `src/dropdown.js`

**Interfaces:**
- Consumes: `place()` from Task 1.
- Produces (module-internal, relied on by Task 3):
  - `CAN_PORTAL` — `boolean` module constant.
  - `viewportBox()` → `{ top, left, width, height }`.
  - Each entry in `activeDropdown` gains `content: HTMLElement` and `reposition: () => void`.

There is no DOM test harness in this repo, so this task has no automated test. It is verified by hand in Task 4 alongside the rest of the wiring.

- [ ] **Step 1: Add the import, constants and the injected UA reset**

In `src/dropdown.js`, add below the existing `import { attrBool } from "./utils.js";`:

```js
import { place } from "./dropdown-place.js";
```

Then add after the existing `const OPEN_TRANSFORM = "translateY(0px) scale(1)";` block:

```js
// ── Top-layer portal ─────────────────────────────────────────
// Panels open inside clipping ancestors — most painfully the mobile bottom
// sheet, whose shadow-DOM header is a scroll box (overflow-x: scroll forces
// overflow-y to auto) and whose chip row is another one. The top layer ignores
// every ancestor's overflow, clip, transform and z-index, so showPopover()
// sidesteps all of them at once. It also means ancestor transforms don't apply
// to the panel, which is why a plain getBoundingClientRect() on the toggle is
// the correct anchor even mid-sheet-animation.
const CAN_PORTAL = "showPopover" in HTMLElement.prototype;

const GAP_PX = 8; // toggle → panel
const INSET_PX = 8; // panel → viewport edge

// showPopover() brings UA styles with it (inset: 0, margin: auto, a border,
// padding, fit-content sizing). This neutralises them. It lives here rather
// than in a Webflow embed because it's a functional requirement of this
// script, not a design token — the two must not drift apart. `position: fixed`
// is restated rather than inherited because Webflow authors these panels as
// `position: absolute`; the selector's specificity (0,2,0) beats a Webflow
// class (0,1,0), so no !important is needed.
let popoverStylesInjected = false;
function ensurePopoverStyles() {
  if (popoverStylesInjected || !CAN_PORTAL) return;
  popoverStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    [data-dropdown-element="content"]:popover-open {
      position: fixed;
      margin: 0;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      inset: auto;
      width: auto;
      height: auto;
      overflow: visible;
    }
  `;
  document.head.appendChild(style);
}

// The visible band in client coordinates. visualViewport is the honest source
// on mobile: the filter bar contains a search input, so the soft keyboard can
// be open while a panel is up, and innerHeight does not shrink for it.
function viewportBox() {
  const vv = window.visualViewport;
  if (vv)
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}
```

- [ ] **Step 2: Call the style injector and mark panels as popovers at init**

In `initDropdown()`, add `ensurePopoverStyles();` immediately after the existing `attachDocumentListeners();` line.

Then, inside the `forEach` body, replace this existing line:

```js
    content.style.display = "none";
```

with:

```js
    if (CAN_PORTAL) {
      // "manual", not "auto": the outside-click and Escape handlers below stay
      // authoritative, and light-dismiss can't race them. The panel stays a DOM
      // descendant of its wrap, so wrap.contains(target) keeps working — the
      // top layer changes where it paints, not where it lives.
      content.setAttribute("popover", "manual");
      // No inline display:none — that would beat the UA's
      // [popover]:not(:popover-open) rule and showPopover() could never
      // reveal it.
    } else {
      content.style.display = "none";
    }
```

- [ ] **Step 3: Add the per-wrap portal state and reposition function**

Still inside the `forEach` body, add immediately after the existing `let currentAnimation = null;` declaration:

```js
    // The panel's unconstrained size, measured once per open while it is still
    // in normal flow. Repositioning reuses it — re-measuring a clamped,
    // scrolling panel would feed back on itself.
    let naturalSize = { width: 0, height: 0 };
    // Whether the last placement had to clamp. Decides the resting overflow.
    let clamped = false;

    // Writes geometry ONLY — never `height`. A reposition landing mid-tween
    // therefore can't fight the animation: the tween finishes to its original
    // target and max-height clamps the result if the space shrank underneath.
    const reposition = () => {
      if (!CAN_PORTAL || !isOpen()) return;
      const { placement, top, left, maxHeight } = place({
        anchor: toggle.getBoundingClientRect(),
        panel: naturalSize,
        viewport: viewportBox(),
        gap: GAP_PX,
        inset: INSET_PX,
      });
      content.style.top = `${top}px`;
      content.style.left = `${left}px`;
      content.style.maxHeight = `${maxHeight}px`;
      // Anchor the scale/slide at the toggle, whichever side we landed on.
      content.style.transformOrigin = placement === "bottom" ? "top" : "bottom";
      wrap.setAttribute("data-dropdown-placement", placement);
      content.setAttribute("data-dropdown-placement", placement);
      clamped = maxHeight < naturalSize.height;
      return maxHeight;
    };

    // Measures in normal flow, hands the panel to the top layer, positions it.
    // Returns the height the open tween should animate to.
    //
    // The measure-first order matters: Webflow may author the panel's width as
    // a percentage of .explorer_filter_dropdown, and once the panel is fixed
    // that percentage would resolve against the viewport instead. So we read
    // the width while the cascade still resolves it correctly, then pin it.
    const portalOpen = () => {
      content.style.visibility = "hidden";
      content.style.display = "block";
      content.style.height = "auto";
      content.style.maxHeight = "none";
      naturalSize = {
        width: content.offsetWidth,
        height: content.scrollHeight,
      };

      // Clearing inline display hands visibility back to the UA's
      // [popover]:not(:popover-open) rule, so showPopover() takes effect.
      content.style.display = "";
      content.style.visibility = "";
      if (!content.matches(":popover-open")) content.showPopover();

      content.style.width = `${naturalSize.width}px`;
      // `?? naturalSize.height` is belt-and-braces: open() sets aria-expanded
      // before calling this, so reposition()'s isOpen() guard always passes.
      const maxHeight = reposition() ?? naturalSize.height;
      // Tween to the CLAMPED height. Animating to the natural height under a
      // smaller max-height would render as an instant jump, not an animation.
      return Math.min(naturalSize.height, maxHeight);
    };

    // Undoes portalOpen. Leaves the tween's own inline state to
    // clearInlineState().
    const portalClose = () => {
      if (!CAN_PORTAL) return;
      if (content.matches(":popover-open")) content.hidePopover();
      content.style.width = "";
      content.style.top = "";
      content.style.left = "";
      content.style.maxHeight = "";
      content.style.transformOrigin = "top";
      wrap.removeAttribute("data-dropdown-placement");
      content.removeAttribute("data-dropdown-placement");
    };
```

Note: `reposition` references `isOpen`, which currently sits further down the scope (just below `clearInlineState`). It is only *called* after `isOpen` is initialised, so the temporal dead zone is not actually a hazard — but to keep the reading order obvious, cut the existing line

```js
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
```

from its present position and paste it between `let currentAnimation = null;` and the new `let naturalSize` declaration, so the ordering reads: `currentAnimation` → `isOpen` → `naturalSize` → `clamped` → `reposition` → `portalOpen` → `portalClose` → `snapshotAndStop` → `animateTo` → `clearInlineState` → `open` → `close`.

- [ ] **Step 4: Branch the open path**

In `open()`, replace these three existing lines:

```js
      content.style.display = "block";
      content.style.height = "auto";
      const toHeight = content.scrollHeight;
```

with:

```js
      let toHeight;
      if (CAN_PORTAL) {
        toHeight = portalOpen();
      } else {
        content.style.display = "block";
        content.style.height = "auto";
        toHeight = content.scrollHeight;
      }
```

Then, in the same function, replace the existing `animateTo` completion callback:

```js
        () => {
          clearInlineState();
          // Let descendants overflow once the dropdown is settled open.
          content.style.overflow = "";
        },
```

with:

```js
        () => {
          clearInlineState();
          // A clamped panel keeps scrolling internally. An unclamped one lets
          // descendants (focus rings, submenus) overflow, as before.
          content.style.overflow = clamped ? "auto" : "";
        },
```

- [ ] **Step 5: Branch the close path**

In `close()`, replace the existing `animateTo` completion callback:

```js
        () => {
          clearInlineState();
          content.style.display = "none";
          wrap.style.zIndex = "";
          if (allClosed()) zCounter = 0;
        },
```

with:

```js
        () => {
          clearInlineState();
          if (CAN_PORTAL) portalClose();
          else content.style.display = "none";
          content.style.overflow = "";
          wrap.style.zIndex = "";
          if (allClosed()) zCounter = 0;
        },
```

- [ ] **Step 6: Publish `content` and `reposition` on the active entry**

In `open()`, replace the existing `activeDropdown` assignment:

```js
      activeDropdown = {
        wrap,
        toggle,
        close,
        focusableItems: /** @type {HTMLElement[]} */ ([
          ...content.querySelectorAll(FOCUSABLE_ITEM_SELECTOR),
        ]),
      };
```

with:

```js
      activeDropdown = {
        wrap,
        toggle,
        content,
        close,
        reposition,
        focusableItems: /** @type {HTMLElement[]} */ ([
          ...content.querySelectorAll(FOCUSABLE_ITEM_SELECTOR),
        ]),
      };
```

And update the `ActiveDropdown` typedef near the top of the file:

```js
/**
 * @typedef {{
 *   wrap: HTMLElement,
 *   toggle: HTMLElement,
 *   content: HTMLElement,
 *   close: () => void,
 *   reposition: () => number | undefined,
 *   focusableItems: HTMLElement[],
 * }} ActiveDropdown
 */
```

`reposition` returns the `maxHeight` it applied, or `undefined` when its guard
short-circuits. `portalOpen` is the only caller that uses the return value.

- [ ] **Step 7: Verify the module still parses and the pure tests still pass**

Run: `node --input-type=module -e "import('./src/dropdown.js').catch(e => { console.error(e.message); process.exit(1); })" ; node tests/dropdown-place.test.mjs`

Expected: the import fails with a `document is not defined` **ReferenceError** (there is no DOM in Node — that is the expected failure and proves the file parses), and the placement tests print `✓ all 9 assertions passed`. A `SyntaxError` instead means a real problem — fix it before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/dropdown.js
git commit -m "feat(dropdown): portal panels to the top layer and position them"
```

---

## Task 3: Track the anchor while open

**Files:**
- Modify: `src/dropdown.js`

**Interfaces:**
- Consumes: `CAN_PORTAL` and the `activeDropdown` entry's `content` / `reposition` from Task 2.
- Produces: `startTracking()` / `stopTracking()`, called from `open()` and `close()`.

- [ ] **Step 1: Add the tracking loop**

In `src/dropdown.js`, add immediately after the `attachDocumentListeners()` function definition:

```js
// ── Anchor tracking ──────────────────────────────────────────
// One rAF-throttled reposition shared by every source that can move an open
// panel. Attached on open, detached on close.
let trackingFrame = 0;

function onAnchorMove(event) {
  // Scrolling INSIDE an open panel must not re-run positioning — on a clamped
  // list that would fight the user's own scroll.
  const target = event?.target;
  if (
    target instanceof Node &&
    activeDropdown &&
    activeDropdown.content.contains(target)
  )
    return;
  if (trackingFrame) return;
  trackingFrame = requestAnimationFrame(() => {
    trackingFrame = 0;
    activeDropdown?.reposition();
  });
}

/** @type {ResizeObserver | null} */
let panelObserver = null;

function startTracking() {
  if (!CAN_PORTAL) return;
  // Capture phase: scroll events don't bubble, but they do traverse capture, so
  // this single listener sees every ancestor scroller — including the bottom
  // sheet's host, whose snap animation IS a scroll. That's why dropdown.js
  // never has to know that <bottom-sheet> exists.
  window.addEventListener("scroll", onAnchorMove, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", onAnchorMove);
  window.visualViewport?.addEventListener("resize", onAnchorMove);
  window.visualViewport?.addEventListener("scroll", onAnchorMove);
}

function stopTracking() {
  window.removeEventListener("scroll", onAnchorMove, { capture: true });
  window.removeEventListener("resize", onAnchorMove);
  window.visualViewport?.removeEventListener("resize", onAnchorMove);
  window.visualViewport?.removeEventListener("scroll", onAnchorMove);
  panelObserver?.disconnect();
  panelObserver = null;
  if (trackingFrame) {
    cancelAnimationFrame(trackingFrame);
    trackingFrame = 0;
  }
}

// Watches a settled panel for content-driven size changes — Finsweet shows and
// hides facet options live (fs-list-emptyfacet="hide"), so the natural height
// moves while the panel is open and the clamp has to follow. Only attached
// after the open tween finishes; during the tween the height is animating and
// every frame would fire.
function observePanel(entry) {
  if (!CAN_PORTAL || panelObserver) return;
  panelObserver = new ResizeObserver(() => onAnchorMove());
  panelObserver.observe(entry.content);
}
```

- [ ] **Step 2: Start tracking on open, stop on close**

In `open()`, add `startTracking();` on the line immediately after the `activeDropdown = { ... };` assignment.

In the open path's `animateTo` completion callback, add `observePanel(activeDropdown);` guarded so a fast close/reopen can't attach the observer to a stale panel. The callback becomes:

```js
        () => {
          clearInlineState();
          // A clamped panel keeps scrolling internally. An unclamped one lets
          // descendants (focus rings, submenus) overflow, as before.
          content.style.overflow = clamped ? "auto" : "";
          if (activeDropdown?.content === content) observePanel(activeDropdown);
        },
```

In `close()`, replace this existing line:

```js
      if (activeDropdown && activeDropdown.wrap === wrap) activeDropdown = null;
```

with:

```js
      // Detach synchronously, not in the tween's callback — a fast reopen would
      // otherwise let the old close's callback tear down the new panel's
      // tracking. Not repositioning during the ~200ms close tween is fine.
      if (activeDropdown && activeDropdown.wrap === wrap) {
        stopTracking();
        activeDropdown = null;
      }
```

- [ ] **Step 3: Verify the module still parses and the pure tests still pass**

Run: `node --input-type=module -e "import('./src/dropdown.js').catch(e => { console.error(e.message); process.exit(1); })" ; node tests/dropdown-place.test.mjs`

Expected: `document is not defined` (a ReferenceError, not a SyntaxError) and `✓ all 9 assertions passed`.

- [ ] **Step 4: Commit**

```bash
git add src/dropdown.js
git commit -m "feat(dropdown): track the anchor while a panel is open"
```

---

## Task 4: Build and verify in the browser

**Files:**
- Modify: `dist/*` (Parcel output, committed minified)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: nothing further.

- [ ] **Step 1: Run the unit tests**

Run: `node tests/dropdown-place.test.mjs`
Expected: `✓ all 9 assertions passed`

- [ ] **Step 2: Build against a clean cache**

Parcel can report success while shipping a stale `dist/`, so clear both first.

```bash
rm -rf .parcel-cache dist && pnpm build
```

Expected: Parcel reports success and writes `dist/index.js`, `dist/studio.js`, `dist/explorer.js`.

- [ ] **Step 3: Verify against a local dev build**

Run `pnpm start`, then on the published site swap the production script tag for the local one — the Webflow embeds already carry the commented-out development variants:

- `<script defer src="http://localhost:1234/index.js"></script>`
- `<script defer src="http://localhost:1234/explorer.js"></script>`

Work through this checklist:

1. **Explorer desktop toolbar** — open Memberships and Categories. Panels appear in the right place; no visual regression versus before.
2. **Explorer mobile, map open, sheet at half snap** — open Categories. The panel is no longer cut off where the sheet content begins, and it scrolls internally through all ~80 options.
3. **Same, mid-drag** — open a panel, then drag the sheet between peek, half and full. The panel stays glued to its chip throughout.
4. **Rightmost chip** — open the last chip in the horizontal row. The panel shifts left to stay on screen instead of overflowing.
5. **Scroll inside a clamped panel** — no jitter, no re-positioning fighting the scroll.
6. **Soft keyboard** — focus the filter search input, then open a dropdown while the keyboard is up. The panel is clamped to the visible band, not hidden behind the keyboard.
7. **Footer locale switcher** — scrolled to the page bottom, it flips upward and `data-dropdown-placement="top"` appears on the wrap.
8. **City picker** — opens and selects correctly.
9. **Keyboard a11y** — Escape closes and returns focus to the toggle; ArrowDown/ArrowUp move through options; clicking outside closes.
10. **iOS 16 / Safari 16 fallback** (or force it by evaluating `delete HTMLElement.prototype.showPopover` before the script loads) — dropdowns still open and close, clipped as they are today. No errors in the console.

- [ ] **Step 4: Commit the build**

```bash
git add dist
git commit -m "build: dist for top-layer dropdown popovers"
```

- [ ] **Step 5: Hand off the deploy**

Do **not** push or purge the CDN without the user's go-ahead — this publishes to the live site. Once they approve:

```bash
git push
```

then purge the jsDelivr edge cache for the `@main` bundles at <https://purge.jsdelivr.net/>. Clearing a browser cache is not enough; the CDN holds `@main` for up to 7 days.

---

## Notes for the implementer

- **`src/dropdown.js` is ~290 lines and stays that way.** This is an additive change; nothing existing is being restructured.
- **Read the whole `open()` and `close()` pair before editing either.** They mirror each other, and several edits in Tasks 2 and 3 touch both.
- **`content.scrollHeight` is the right natural-height read even on a clamped, scrolling panel** — `scrollHeight` reports full content height regardless of clipping. That is why `observePanel`'s callback needs no un-clamping dance.
- **Do not add `!important` to the injected stylesheet.** If a rule appears not to apply, check specificity first: `[data-dropdown-element="content"]:popover-open` is (0,2,0) and beats any single Webflow class.
