# Studios City Picker — Design

**Date:** 2026-05-22
**Status:** Approved (design); pending implementation plan
**Surface:** The studios search page (`/s`)

## Problem

The studios search toolbar exposes a "Location" filter as one dropdown among
the others (next to "Category"). It reads as just another facet and feels
unclear (*"Location filtret känns lite otydligt"*). Separately, city is rendered
as **three duplicate filter copies** (modal / nav searchbar / toolbar) that
Finsweet never keeps in sync — the source of the careful "click exactly one
copy" handling in the deep-link replay.

## Goal

Fold city selection into the result-count heading:

> **Over 1000 studios in [ All cities ▾ ]**

Selecting a city in that inline dropdown narrows the list (so the count and the
"in {city}" label stay truthful), recenters the map, and updates the page's
per-city placeholders. The heading picker becomes the **only** city control on
the page, which also collapses the never-synced duplicate copies down to one.

## Decisions (resolved during brainstorming)

1. **Auto-select:** geolocation is used **only if permission is already
   granted** — never a cold prompt on load. Otherwise fall back to the existing
   `city.js` default chain.
2. **Select mode:** **single-select** (one city at a time), matching the
   "in {city}" copy and `bruce.city`'s single `current` slug.
3. **Consolidation:** the heading picker **replaces all** city controls
   (toolbar Location + filter modal + nav searchbar). One source of truth.
4. **Default filter engagement:** the filter engages on **strong signal only** —
   a `?city=` deep-link or geo-if-granted. Saved choice and CMS default set only
   the *context* (map home + placeholders) and leave the heading at "All cities"
   so first-time / no-geo visitors land on the "Over 1000" hero.
5. **Architecture:** Approach A — `bruce.city` is the source of truth; a thin
   one-way bridge drives a single hidden Finsweet `city_equal` group.

## State model

Two related but **separate** pieces of city state — this separation is the
whole design:

| | City context (`bruce.city.current`) | City filter (hidden `city_equal`) |
|---|---|---|
| Values | always a concrete city | OFF ("all cities") *or* one city |
| Drives | map home-center, `{{city-name}}` / phone placeholders, persistence | list narrowing → count → "in {city}" copy |
| Never | "all" | — |

- **Concrete city selected** → `bruce.city.set(slug)` (context) **and** engage
  the hidden filter to that city. Count + camera follow the existing
  `afterRender` pipeline.
- **"All cities" selected** → clear the hidden filter only; context untouched
  (the map keeps a home, placeholders elsewhere still resolve).

## Markup contract

### Heading picker

The count block (`[data-studios-element="count-display"]` with its
singular / plural / over modes) already exists and is unchanged. The picker is
new and inline, built as a standard `dropdown.js` wrap:

```html
<h1>
  <span data-studios-element="count-display"><!-- existing modes --></span>
  in
  <span data-dropdown-element="wrap" data-studios-city-picker>
    <button data-dropdown-element="toggle">
      <span data-studios-city-label>All cities</span>
    </button>
    <div data-dropdown-element="content">
      <button data-studios-city-option="all">All cities</button>
      <!-- CMS Collection List of cities → one button per item: -->
      <button data-studios-city-option="{slug}">{name}</button>
    </div>
  </span>
</h1>
```

- Open/close, click-outside, Escape, and arrow-key nav are handled by the
  existing `dropdown.js` (no new menu code).
- Every option carries `data-studios-city-option` — `"all"` for the all-cities
  trigger, or the city `{slug}` for a concrete city. The picker is
  **self-contained**: its own delegated click handler reads that attribute and
  drives both context (`bruce.city.set`) and the filter, rather than depending
  on `city.js`'s `data-set-city` delegation. This keeps the heading's state =
  the *filter* selection, decoupled from context changes elsewhere (see the
  module section for why this matters).
- Active option styling uses `data-studios-city-active="true"`, set by the
  module on the option matching the current filter selection (or the "all"
  option). Styled independently of `city.js`'s context-driven
  `data-city-active`.
- `[data-studios-city-label]` holds the trigger text, written by the module
  from the **filter** selection — *not* `{{city-name}}`, which tracks context
  and would read wrong ("…in Stockholm" while showing all cities).

### Hidden filter group

The single canonical `city_equal` copy, one input per city, inside the filters
form (`form[fs-list-element="filters"]`):

```html
<div data-studios-city-filter hidden>
  <label><input type="checkbox" fs-list-field="city" fs-list-value="{city name}"></label>
  <!-- one per city -->
</div>
```

`fs-list-value` must match the studio item's city field text — the same value
the off-page redirect already emits (e.g. `Stockholm`).

### Removed

The city option is removed from the toolbar "Location" dropdown, the filter
modal, and the nav searchbar.

## New module: `src/studios-city-filter.js`

A focused module so `studios.js` (already ~1200 lines) stays map-only. Public
surface is small; it coordinates `window.bruce.city`, the filters form, and the
heading DOM.

- **`applyCitySelection(slug | "all")`** — idempotent entry point.
  - concrete slug → `bruce.city.set(slug)` (context) + `syncHiddenFilter(slug)` + label + active.
  - `"all"` → `syncHiddenFilter(null)` + label `"All cities"` + active (context untouched).
- **`syncHiddenFilter(slug | null)`** — the desync-safe bridge. Reads which
  hidden city input is currently checked; if it differs from the target, fires
  one genuine `.click()` to uncheck the old and one to check the new (the same
  "interacted event" rule the deep-link replay uses, so Finsweet's debounce and
  internal model stay consistent and we never end up with two checked copies).
  Idempotent — no clicks when already on the target. One-way only (hidden inputs
  carry no `data-studios-city-option`), so there is no loop.
- **Option clicks:** one delegated `click` handler on the picker reads
  `data-studios-city-option` and calls `applyCitySelection("all" | slug)`.
  **No `bruce.city.onChange` subscription** — the heading deliberately reflects
  the *filter*, not context. Reacting to `onChange` would make the initial
  default-chain context resolution (which fires `null → defaultCity` at boot)
  silently engage the filter, violating the strong-signal rule. So context
  changes from elsewhere never touch the heading; the picker's own clicks are
  the only thing that engages the filter post-load.
- **Initial engagement** (strong-signal rule). Runs inside a
  `FinsweetAttributes.push(["list", …])` callback so the hidden-input clicks land
  *after* Finsweet has bound the list (clicking before binding would no-op,
  exactly like the existing deep-link replay):
  - `?city=` present (`bruce.city.urlSelection()[0]`) → engage filter for that city.
  - else geolocation already granted and resolves to a nearest city → engage
    that city (`applyCitySelection` also persists it via `bruce.city.set`).
  - else → "All cities" (filter off); `city.js` still resolves the context city
    for map home + placeholders independently.

  "Geo if already granted" uses the Permissions API
  (`navigator.permissions.query({ name: "geolocation" })`) — only call
  `requestUserLocation()` when state is `"granted"`. Nearest city = min great-
  circle distance over `bruce.city.all()` entries that have `coords`.

  On **back/forward** navigation (the same `shouldApplyDeepLinkFilters` rule the
  deep-link replay uses), Finsweet restores its own filter state — including the
  hidden city input — from the URL it took over. So the picker must NOT re-click
  there (that would double-check and desync). Instead it mirrors the URL city
  into the heading label / active state / context without touching the inputs.
  `syncHiddenFilter` is also idempotent against an already-checked target, as a
  second line of defence.

The pure decision helpers live in a separate framework-free module
`src/studios-city-select.js` (mirroring `studios-deep-link.js`), so they unit-
test without a DOM: `nearestCitySlug`, `resolveInitialCitySelection`, and
`planCityFilterClicks`.

## Changes to existing files

- **`studios.js` — camera:** the current "filters cleared → `flyToCity()`"
  branch in `render()` must respect the "all cities" intent. When the city
  filter is explicitly OFF, **fit to all features** instead of flying to the
  context city. When a concrete city is engaged, the existing
  `onChange → flyToCity` + `fitToFeatures` already frame it correctly.
- **`studios.js` — deep-link replay:** skip the `city` field key in the generic
  checkbox-clicking loop in `applyUrlDeepLinkFilters` (`if (key === "city") continue;`,
  alongside the existing `q` skip). `city.js` already reads `?city=` for context
  and the picker's boot engagement applies the hidden city filter, so the `city`
  field is owned by the picker. The generic replay keeps handling `category`,
  `q`, and any future fields.

  The Finsweet field key for city is **`city`** (so `fs-list-field="city"`, URL
  param `?city=`); `city_equal` in some comments is only a `data-search-group`
  hook label, not the field key.
- **`studios-filter-count.js`:** unchanged. The hidden city group is real
  `:checked` inputs, so `hasActiveFilters()` and Finsweet "Reset all" naturally
  include city.

## "All cities" behavior + placeholders

- Filter off → count = unfiltered total → existing "over" copy
  ("Over 1000 studios"), trigger label "All cities", camera fits all features.
- Placeholders (`{{city-name}}`, phone) track **context**, so in "all cities"
  the page chrome still shows the last concrete city's values. Intended —
  context never goes "all".
- **Copy note (content, not code):** "…studios in **All cities**" reads
  slightly oddly. The connecting word may want to live in the localized copy so
  each locale can phrase it naturally. Flagged to the team.

## Inbound multi-city deep-link edge case

The off-page redirect can still emit `?city=Bergen&city=Oslo`. Single-select can
only reflect one: `city.js` already takes `citiesFromUrl()[0]` for context, and
the bridge engages the hidden filter for that first city only. Extra cities are
dropped with a one-line `console.warn`. The redirect itself is off-page and out
of scope here.

## Testing

- **Unit (pure, extractable):**
  - `syncHiddenFilter` click decision: given target vs currently-checked,
    assert which `.click()`s fire (none when already correct; one when only
    clearing; two when switching).
  - initial-engagement resolver: given `{ urlCities, geoState, geoCoords,
    cities }`, assert the chosen selection (`"all"` vs a slug) per the
    strong-signal rule.
  - nearest-city: given coords + city list, assert the nearest slug.
- **Manual verify** (consistent with the rest of this codebase — no harness for
  the Finsweet/map pipeline): pick a city → list narrows, count + "in {city}"
  update, map recenters; "All cities" → resets to total + fit-all; `?city=`
  deep-link lands engaged; geo-granted vs geo-denied landing; "Reset all"
  clears city too.

## Out of scope

- Changing the off-page redirect searchbar (`studios-search-redirect.js`).
- Multi-city selection on the search page.
- Cold geolocation prompting.
