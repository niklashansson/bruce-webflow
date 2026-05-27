# City Visibility Attribute — Design

Date: 2026-05-27
Status: Approved (pending implementation)

## Goal

Let editors control whether any element appears on the page based on the
active city, using a single CMS-editable attribute. No JS required from
editors; no per-page wiring.

## Public API

A single attribute on any element:

```html
<div data-city-show="cph">             <!-- only in Copenhagen -->
<div data-city-show="cph, sto">        <!-- only in CPH or Stockholm -->
<div data-city-show="Copenhagen">      <!-- name match works too -->
<div data-city-show="">                <!-- empty = always visible -->
<div>                                  <!-- no attribute = always visible -->
```

### Matching rules

- Value is comma-separated. Each entry is trimmed.
- Match is case-insensitive against both the city's `slug` and its `name`
  (the same permissive lookup used by `citiesFromUrl()` in `src/city.js`).
- Empty string or missing attribute → element is always visible. The empty
  case is treated as a no-op so an editor who blanks the field doesn't
  accidentally hide content.
- A value that matches **no known city** is logged once via
  `console.warn` with the offending input and the list of known cities
  (mirrors the warning style in `citiesFromUrl()`). The element stays
  hidden because the safer interpretation of an unknown city is "not
  this city" rather than "all cities".

## Hide mechanism

JS owns a single class plus a body-level "ready" flag. The project ships
two small CSS rules globally:

```css
/* Site-wide custom code, added once in Webflow */
.is-city-hidden { display: none !important; }

body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
  display: none;
}
```

- `!important` on `.is-city-hidden` defeats Webflow's class-driven
  `display: flex/grid/block`. Without it, an element styled
  `display: flex` via a Webflow class would ignore
  `.is-city-hidden { display: none }`. Same external-CSS precedence
  lesson from the bottom-sheet web component work.
- Pre-hide uses `display: none` rather than `visibility: hidden`. In
  Webflow's typical flex/grid sections, `visibility: hidden` leaves
  awkward empty slots during the ~100ms boot window;
  `display: none` collapses the layout to the resolved set of cities
  with one reflow when matches reveal. Cleaner final state.
- The visibility module fully owns the `is-city-ready` body class — no
  change to `city.js` is required. The module sets the class only after
  it has done its first sweep against a non-null active city, so a
  scenario where `city.js` fails to boot leaves pre-hide in place
  (fail-closed: better to hide a city-scoped block than to flash it on
  every visitor).

## FOUC sequence

1. HTML renders. The pre-hide rule keeps every
   `[data-city-show]:not([data-city-show=""])` element `display: none`.
2. `city.js` boots, resolves the active city, calls `applyCity(slug)`,
   which fires the `onChange` listener fan-out.
3. The visibility module's `onChange` callback sweeps all
   `[data-city-show]` elements and adds `is-city-hidden` to non-matches.
4. Still inside that same callback (synchronously, before paint), the
   visibility module adds `is-city-ready` to `<body>`. Pre-hide drops.
   Matches reveal (no `.is-city-hidden`, no pre-hide); non-matches stay
   `display: none` via `.is-city-hidden !important`.

The single ordering constraint — sweep then ready-class — is enforced
inside the visibility module's own callback, so it cannot be broken by
import order or boot timing.

## Late inserts (CMS / Finsweet / Webflow interactions)

Two independent triggers re-sweep:

- **City switch:** the visibility module subscribes to `city.onChange()`
  and re-sweeps every `[data-city-show]` in the document on each switch.
- **New nodes:** a narrow `MutationObserver` on `<body>` re-sweeps
  whenever a subtree containing `[data-city-show]` is inserted. The
  pre-filter is cheap (`matches?.()` and `querySelector?.()` only, no
  walk), matching the pattern in `src/city.js` and `src/variables.js`.

A rAF-debounced scheduler collapses bursts of mutations into a single
pass. Safety-pass timers at `[500, 1500, 3500]` ms catch any inserts
that escaped the observer, matching the existing module convention.

## Module placement

New file `src/city-visibility.js`. Imported from `src/index.js` next to
the existing `city` import.

### Pure helper (testable)

```js
/**
 * Decide whether an element should be visible given its attribute value
 * and the currently-active city.
 *
 * Returns { visible: boolean, unknownValues: string[] } so the caller can
 * warn once per unknown value rather than per element.
 *
 * @param {string | null} attrValue   raw attribute, may be null/"" /"cph"/"cph,sto"
 * @param {string | null} activeSlug  current city slug, or null pre-boot
 * @param {Array<{slug: string, name: string}>} cities
 */
export function shouldShow(attrValue, activeSlug, cities) { ... }
```

Behavior:

- `attrValue` is null or empty (after trim) → `{ visible: true, unknownValues: [] }`.
- `activeSlug` is null and `attrValue` is non-empty → `{ visible: false, unknownValues: [] }` (pre-boot, treat as hidden; pre-hide CSS would have hidden it anyway).
- For each comma-token: trim, lowercase, match against `slug.toLowerCase()` or `name.toLowerCase()`. Tokens that match no city go into `unknownValues`.
- `visible` is true iff at least one valid token matches `activeSlug`.

This shape mirrors the helper extraction in `src/studios-city-select.js`
and keeps the DOM-touching code a thin shell over it.

### Apply layer

- `applyVisibility(el, activeSlug, cities)` — calls `shouldShow`, toggles
  `is-city-hidden`, emits warnings for unknown values (with a module-level
  `Set` keyed by `attrValue` to deduplicate warnings).
- `sweep()` — runs `applyVisibility` over every `[data-city-show]`. After
  a sweep that ran with a non-null `activeSlug`, sets
  `document.body.classList.add("is-city-ready")` (idempotent, single
  source of truth for the ready flag).
- `boot()` — wires `city.onChange(sweep)`, runs an initial sweep, sets
  up the `MutationObserver`, schedules safety passes at
  `[500, 1500, 3500]` ms.

### Initial-sweep timing

`shouldShow` returns `visible: false` while `activeSlug` is null, so an
initial sweep that runs before `city.js` has resolved a city does not
reveal non-matches. The first meaningful sweep happens either:

- inside the `city.onChange` callback fired by `applyCity()` (normal
  case where `city.js` boots after the listener subscribes), or
- inside `boot()`'s manual initial sweep when `city.get()` already
  returns a slug (case where `city.js` resolved before the visibility
  module subscribed).

The `is-city-ready` body class is only set once a sweep has run with a
non-null slug, so import order between `src/index.js` entries doesn't
affect correctness.

## Touch points in existing files

- **`src/city.js`** — no behavior change. One line added to the top
  docblock cross-referencing `data-city-show`.
- **`src/index.js`** — `import "./city-visibility.js";` placed next to
  the existing `city` import.

## Out of scope (YAGNI)

- No `data-city-hide` attribute. The "show in everything except X" use
  case can be expressed by listing the cities to show.
- No negation syntax (`data-city-show="!cph"`).
- No animation/transition hook on show/hide. Editors can attach CSS
  transitions to `.is-city-hidden` themselves if they want fade-outs.
- No public programmatic API
  (`bruce.city.visibility.refresh()`/etc.) — `onChange` + `MutationObserver`
  cover all current cases.
- No support for matching by city `vars` (e.g.
  `data-city-show-where="phone=*"`).

## Testing

The pure `shouldShow` helper is straightforward to unit-test against a
fixed `cities` array:

- empty / null / whitespace-only attribute → visible
- single slug match (lowercase + mixed case)
- single name match (lowercase + mixed case)
- multi-value list, one match → visible
- multi-value list, no match → hidden
- unknown token reported in `unknownValues`
- `activeSlug = null` → hidden when attribute is non-empty, visible when empty

DOM-level behavior (class toggling, observer wiring, body-class write
ordering) is verified manually on the staging site — same coverage
boundary as `studios-city-select.js`.

## Editor / CMS rollout notes

- The two CSS rules must be added to Webflow site-wide custom code
  before publishing the JS change, or first-load FOUC will be visible.
- jsDelivr caches `@main` up to 7 days (see `parcel_stale_cache_gotcha`),
  so production rollout uses a pinned version tag.
- `dist/` rebuild requires `rm -rf .parcel-cache dist` before
  `pnpm build` to avoid stale-cache builds.
