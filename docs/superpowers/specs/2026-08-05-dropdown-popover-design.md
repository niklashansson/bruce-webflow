# Dropdown Popover Positioning — Design

Date: 2026-08-05
Status: Approved (pending implementation)

## Goal

Stop dropdown panels from being clipped by their ancestors, and give them
shadcn/Radix-style viewport collision handling: flip above when there is no
room below, shift sideways to stay on screen, and clamp the height (with
internal scrolling) when the panel fits on neither side.

Applies to every `[data-dropdown-element="wrap"]` on the site — explorer
filter chips (desktop toolbar and mobile bottom sheet), the city picker, and
the footer locale switcher.

## The bug

On mobile, opening a filter dropdown inside the bottom sheet cuts the panel
off exactly where the sheet's content begins. Two stacked scroll containers
cause it, both by the same mechanism — a non-`visible` `overflow-x` forces
`overflow-y` to compute to `auto`, so the box clips vertically too:

1. **The sheet's own header.** `pure-web-bottom-sheet@0.6.0` ships this in its
   shadow DOM:

   ```css
   .sheet-content, .sheet-footer, .sheet-header {
     overflow-x: scroll; overscroll-behavior-x: none; ...
   }
   ```

   `[part="header"]` is therefore a scroll box that clips at its bottom edge —
   which is where the sheet content starts.

2. **The mobile chip row.** `.explorer_filter_bar_mobile_dropdowns` is a
   horizontal scroller (hence the scrollbar-hiding rules in the Webflow
   embed), so it clips its own children the same way.

`.sheet` itself is additionally `overflow: clip`.

Neither is fixable in CSS without cost. `[part="header"]` can be overridden to
`overflow: visible`, but the chip row cannot — there is no way to keep
`overflow-x: auto` while allowing `overflow-y: visible`. And an
ancestor-dependent fix is fragile here regardless, because `explorer.js`
re-parents the whole filter form between the desktop toolbar and the sheet
header at runtime.

## Why this shape

Render the panel in the **top layer** via the native `popover` API. The top
layer ignores every ancestor's `overflow`, `clip`, `transform` and `z-index`,
so all three clipping boxes stop mattering and the fix holds no matter where
the form is currently parented.

Top-layer rendering also removes the hardest class of positioning bugs for
free: top-layer elements are unaffected by ancestor transforms, and the sheet
animates itself with transforms. A plain `getBoundingClientRect()` reading of
the toggle is therefore correct without compensation.

Positioning is hand-rolled rather than delegated to `@floating-ui/dom`. The
required behaviour is a thin slice of what that library does — one placement,
one flip axis, one shift axis, one clamp — and the long tail it exists to
handle (RTL, virtual anchors, iframes, nested clipping ancestors) is mostly
moot once we are in the top layer. It would also add ~10 kB min+gz to *both*
`index.js` and `explorer.js`, since both pull in `dropdown.js`. Keeping the
maths in its own module means swapping in Floating UI later is a
same-signature change if an edge case turns nasty.

CSS Anchor Positioning would be the least code of all and would need no
tracking loop, but it is still Chromium-only and this site's traffic is
heavily iOS. It stays a possible progressive enhancement.

## Scope

In scope:

- New pure module `src/dropdown-place.js` + unit tests.
- Portal, positioning and anchor-tracking in `src/dropdown.js`.
- A `data-dropdown-placement` style hook.

Out of scope:

- Any change to the Webflow-side markup or classes.
- The nav dropdowns (`.nav_dropdown_component`), which are Webflow's native
  `w-dropdown` and do not use this module.
- Arrows/carets pointing at the toggle.
- CSS Anchor Positioning.

## Module split

Follows the existing pure-helper convention (`city-links-plan.js`,
`city-visibility-decide.js`): decision logic in a framework-free sibling with
`node tests/*.test.mjs` coverage, DOM work in the consumer.

### `src/dropdown-place.js` (new, pure)

```js
/**
 * @param {{
 *   anchor:   {top: number, bottom: number, left: number, width: number},
 *   panel:    {width: number, height: number},   // natural, unconstrained
 *   viewport: {top: number, left: number, width: number, height: number},
 *   gap: number,
 *   inset: number,
 * }} input
 * @returns {{ placement: "bottom"|"top", top: number, left: number, maxHeight: number }}
 */
export function place(input)
```

All inputs are plain numbers in client coordinates. No DOM, no globals.

Algorithm:

1. `spaceBelow = (viewport.top + viewport.height - inset) - (anchor.bottom + gap)`
   `spaceAbove = (anchor.top - gap) - (viewport.top + inset)`
2. Placement: `bottom` if `panel.height <= spaceBelow`; else `top` if
   `panel.height <= spaceAbove`; else whichever space is larger.
3. `maxHeight = min(panel.height, space[placement])`, floored at 0.
4. `top = placement === "bottom" ? anchor.bottom + gap : anchor.top - gap - maxHeight`
5. `left = anchor.left`, then clamped into
   `[viewport.left + inset, viewport.left + viewport.width - inset - panel.width]`.
   When the panel is wider than that box the clamp would invert, so it pins to
   the left inset instead of jumping right.

No minimum height: because step 2 falls back to the larger side, the worst
case is a toggle at the vertical centre, leaving half the viewport.

Defaults: `gap: 8`, `inset: 8`.

### `src/dropdown.js` (modified)

Keeps everything it does today — open/close, the WAAPI height/opacity/
transform tween, outside-click dismissal, Escape, ArrowUp/ArrowDown roving,
one-open-at-a-time, the `zCounter` stacking, and the hover-in/hover-out
attributes. Gains the portal, the `place()` call and the tracking loop.

The `zCounter` stacking becomes redundant on the portal path — the top layer
stacks by `showPopover()` order — but stays, because the iOS 16 fallback path
still depends on it and it costs nothing.

## Open sequence

The measure step is load-bearing. Webflow may author the panel's width as a
percentage of `.explorer_filter_dropdown`; in the top layer that percentage
would resolve against the viewport instead. So measure in normal flow first,
then portal:

1. Inline `display: block; visibility: hidden; height: auto` — renders in
   place, invisible, still in flow. (Inline `display` beats the UA's
   `[popover]:not(:popover-open) { display: none }`.) Read `offsetWidth` and
   `scrollHeight`.
2. Clear those inline values, call `showPopover()`.
3. Call `place()` with the toggle's rect, the measured natural size, and the
   viewport box. Apply the result: pin `width` to the measured width, set
   `top`, `left`, `max-height`.
4. Run the existing tween from height 0 to the clamped height.
   `transform-origin` is `top` when placed below, `bottom` when flipped, so
   the scale still anchors at the toggle.
5. On finish, set `overflow-y: auto` when clamped (`maxHeight <
   panel.height`), otherwise clear `overflow` as today.

Close calls `hidePopover()` and clears the inline geometry (`width`, `top`,
`left`, `max-height`, `overflow`) alongside the existing
`clearInlineState()`.

`popover="manual"`, not `auto`: the existing outside-click and Escape handlers
stay authoritative, and no light-dismiss races them. The panel remains a DOM
descendant of its wrap, so `activeDropdown.wrap.contains(target)` keeps
working unchanged.

## Anchor tracking

While a panel is open, reposition on:

- `scroll` on `window` with `capture: true, passive: true`. Scroll events do
  not bubble, but they do traverse the capture phase, so one listener catches
  every ancestor scroller — including the sheet host, whose snap animation
  *is* a scroll. No `bottom-sheet` coupling in `dropdown.js`.
- `resize` on `window`.
- `resize` and `scroll` on `visualViewport` when it exists.
- A `ResizeObserver` on the panel — Finsweet shows and hides facet options
  dynamically (`fs-list-emptyfacet="hide"`), so natural height changes while
  open and the clamp has to follow.

All funnel into one `requestAnimationFrame`-throttled reposition. Scroll
events whose target is the panel or inside it are ignored, so scrolling a
clamped option list does not re-trigger positioning and jitter.

Listeners attach on open and detach on close.

A reposition writes `top`, `left` and `max-height` only — never `height`. So
one landing mid-tween cannot fight the animation: the tween finishes to its
original target and `max-height` clamps the result if the available space
shrank underneath it.

## Viewport box

Read `visualViewport` when present:

```
{ top: visualViewport.offsetTop, left: visualViewport.offsetLeft,
  width: visualViewport.width,   height: visualViewport.height }
```

falling back to `{ top: 0, left: 0, width: innerWidth, height: innerHeight }`.

The filter bar contains a search input, so on mobile the keyboard can be open
while a panel is up; `innerHeight` is wrong in that state.

## UA style reset

`showPopover()` applies UA styles — `position: fixed`, `inset: 0`,
`margin: auto`, `width/height: fit-content`, a border, padding, `overflow:
auto`, and its own colours. `dropdown.js` injects a small stylesheet once on
first init to neutralise them:

Crucially, the UA's `[popover]` rule is **not** gated on `:popover-open` — it
applies from the moment the attribute is set, which includes the measurement
window. And the reset must beat the UA sheet without also beating the site's
own styling. Those two facts split the reset in half:

```css
/* Neutralise the UA sheet. Author origin already outranks the UA origin, so
   no specificity is needed — and :where() pins this at (0,0,0) so Webflow's
   own classes still win, which is the entire point. Ungated on
   :popover-open, so it also governs the measurement window. */
:where([data-dropdown-element="content"][popover]) {
  position: static; inset: auto; width: auto; height: auto;
  margin: 0; border: 0; padding: 0; overflow: visible;
  background: transparent; color: inherit;
}

/* Structural, and only while open. `display: block` matches what the
   pre-portal code forced on every open, so a panel authored `display: none`
   still opens. */
[data-dropdown-element="content"]:popover-open {
  position: fixed; inset: auto; margin: 0;
  width: auto; height: auto; display: block;
}
```

**Corrected 2026-08-05.** This section originally specified one rule at
`[data-dropdown-element="content"]:popover-open`, justified by its specificity
(0,2,0) beating a Webflow class (0,1,0). That reasoning was wrong twice over.
Specificity was never needed to beat the UA sheet — origin already does that —
and cranking it meant the reset also stripped the panel's authored background,
padding, border and clipping. Separately, gating the reset on `:popover-open`
left the UA's `position: fixed; width: fit-content` in force during
measurement, so `portalOpen()` measured an already-fixed, out-of-flow panel;
a panel with no authored width measured 22px instead of 400px, and that value
was then pinned for the whole open. Both were reproduced in Chrome before this
correction.

This is a functional requirement of the script, not a design token, so it
lives with the script rather than in a Webflow embed where the two could drift
apart.

## Fallback

```js
const CAN_PORTAL = "showPopover" in HTMLElement.prototype;
```

When false, skip portaling and positioning entirely and behave exactly as
today. That is iOS 16 and below; those users get the current clipping,
nothing worse.

A `position: fixed` fallback without the top layer would not help — the
sheet's transforms make it a containing block for fixed descendants, so it
would still clip.

## Style hook

On open, the wrap and the content both get
`data-dropdown-placement="top" | "bottom"`; removed on close. Lets Webflow
style flipped panels differently (shadow direction, corner radius) with no
further JS.

## Verification

`tests/dropdown-place.test.mjs`, framework-free, run with
`node tests/dropdown-place.test.mjs`:

- fits below → `placement: "bottom"`, unclamped
- does not fit below, fits above → `placement: "top"`, unclamped, `top`
  accounts for panel height
- fits neither → larger side wins, `maxHeight` equals that side's space
- shift left when the anchor is near the right edge
- no shift when the anchor is comfortably inside
- panel wider than the viewport → pinned to left inset
- `viewport.top`/`viewport.left` offsets (keyboard-open case) respected
- zero/negative available space does not produce a negative `maxHeight`

Manual pass on the four surfaces, since the DOM wiring is not unit-testable
here:

1. Explorer desktop toolbar — open each filter, confirm no regression.
2. Explorer mobile chips in the sheet — at peek, half and full snaps, and
   mid-drag; confirm the panel is no longer clipped at the content boundary
   and rides with the sheet.
3. Rightmost chip (Categories) — confirm shift keeps it on screen and the
   ~80-option list clamps and scrolls internally without jitter.
4. City picker and footer locale switcher — confirm the locale switcher flips
   upward at the page bottom.

Also confirm the iOS 16 path still opens (unportaled, clipped as before).
