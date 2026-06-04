# City Link Rewrite — Design

Date: 2026-06-04
Status: Approved (pending implementation)

## Goal

Make every plain in-site link to a gateway page (`/memberships`, `/studios`
and their localized variants) automatically resolve to the visitor's active
city page — correctly localized — without per-link authoring.

A visitor who has picked a city should be routed straight to that city's
membership/studio page from any normal link, while keeping the neutral
gateway reachable on purpose. The gateway pages are CMS-driven city
collections (`City Memberships`, `City Studios`), one published page per city
per locale.

## Why this exists

The previous link pattern hardcoded the section path in the link text:
`/memberships{{city-path}}`, where `{{city-path}}` (from
`buildPlaceholders()` in `src/city-resolve.js`) emits only `/${slug}`. That
breaks under Webflow Localization: a Swedish page (`/sv/medlemskap`) renders a
link to the English `/memberships/...` because:

- The **locale prefix** (`/sv`) and **section slug** (`medlemskap` vs
  `memberships`) are localized, and Webflow only rewrites those on *internal
  page links* — not on a hand-typed path string.
- The **city slug itself is localized**, so JS cannot safely construct the
  city segment either.

The only component that knows the full, correct, localized URL for a city's
page is **Webflow at render time**. So this design stops constructing URLs
entirely: Webflow emits real localized URLs into the DOM, and JS only copies
the right one onto matching links.

## Scope

In scope:

- Auto-rewriting **same-locale** gateway links to the active city's page.
- Sections: `memberships` and `studios` (identical mechanism, data-driven).
- A `data-city-link-skip` opt-out for deliberate gateway links.

Out of scope (explicitly deferred):

- **Redirecting** a visitor who lands directly on the neutral gateway. Once
  in-site links self-resolve, a city-holder rarely reaches the neutral
  gateway through navigation; direct/external entries stay on the (safe)
  neutral page. May be revisited later.
- **Cross-locale repair** (a mis-authored English link sitting on a Swedish
  page). We match only against the current page's localized gateway path.

## Webflow-side data contract

Both element kinds live in the **global component** so they are present on
every page and every locale.

### A. Gateway anchors — one per section

Tell JS the neutral path to match against, in the current locale:

```html
<a data-city-gateway="memberships" href="(internal link → Memberships page)" hidden></a>
<a data-city-gateway="studios"     href="(internal link → Studios page)"     hidden></a>
```

Webflow localizes the `href` (e.g. `/sv/medlemskap`, `/sv/studior`).

### B. Hidden Collection Lists — one per section

The city → URL map, localized by Webflow:

```html
<div data-city-link-list="memberships" hidden>
  <!-- Collection List bound to "City Memberships" -->
  <a data-city-link-item
     data-city-link-key="{{ City (reference) → Slug }}"
     href="(internal link → Current City Memberships Page)"></a>
</div>
<div data-city-link-list="studios" hidden>
  <!-- same shape, bound to "City Studios" -->
</div>
```

Two load-bearing rules:

1. **`data-city-link-key` binds to the *Cities*-collection slug** (via the
   reference field on the City Memberships / City Studios items), **not** the
   item's own localized slug. This is the stable join key — it matches what
   `bruce.city.get()` returns (e.g. `sto`, `cph`) and is identical across
   locales.
2. **Every `href` is a Webflow internal-page link**, never typed text — so
   Webflow owns the locale prefix, the localized section slug, and the
   localized city slug.

This mirrors the existing `[data-city-list]` registry pattern read by
`readCityList()` in `src/city-registry.js`.

## Matching behavior

On each city resolution, JS scans `<a>` elements and rewrites those whose path
is an **exact match** for a known gateway path.

- **Exact path match only.** Normalize each link's `pathname` (strip a single
  trailing slash) and compare to the section's gateway pathname. A bare
  `/sv/medlemskap` matches; a sub-page `/sv/medlemskap/foretag` does **not**.
- **Preserve `?query` and `#hash`.** Only the path portion is replaced; the
  original query and hash are re-appended to the resolved city URL.
- **Same-locale only.** We match against the current page's gateway path,
  which Webflow already localized — so a Swedish page only rewrites Swedish
  gateway links.

### Exclusions

- `<a data-city-link-skip>` is never rewritten. This is for "Browse all
  cities" / "Switch city" links that must keep pointing at the neutral
  gateway.
- Links living **inside** a `[data-city-link-list]` or `[data-city-gateway]`
  element are ignored — they are our own source data.

### Neutral state

When there is no active city, nothing is rewritten; links remain the authored
gateway, a safe non-broken page. Consistent with the original
`{{city-path}}`-era "links never break" philosophy.

## Architecture

Follows the established pure-core / DOM-shell split
(`city-resolve.js` ↔ `city-context.js`;
`city-visibility-decide.js` ↔ `city-visibility.js`).

### `src/city-links-plan.js` — pure, no DOM, no imports (unit-tested)

```js
// Which gateway section does a bare path belong to?
// Exact match, trailing-slash normalized.
export function matchSection(pathname, gateways) { … }
//   → "memberships" | "studios" | null

// The href to set for a managed link, given the active city.
// Falls back to the gateway path when neutral OR when the active city has no
// page in that section.
export function resolveHref({ section, search, hash }, { gateways, linkMap, active }) { … }
//   active && linkMap[section][active] → linkMap[section][active] + search + hash
//   else                               → gateways[section]        + search + hash
```

### `src/city-links.js` — thin DOM shell (not unit-tested)

Owns the DOM and lifecycle:

- `readGateways()` → `{ memberships: "/sv/medlemskap", … }` from
  `[data-city-gateway]`.
- `readLinkMap()` → `{ memberships: { sto: "/sv/medlemskap/sto", … }, … }`
  from `[data-city-link-list]`.
- A `WeakMap<HTMLAnchorElement, { section, search, hash }>` remembering each
  managed link's section and original query/hash, so it can be re-pointed on
  every switch (see Data flow).
- `apply(active)` → scans `<a>`, delegates each decision to the pure
  functions, sets `href`.
- Boot: an initial `apply` plus the same `SAFETY_PASS_DELAYS`
  (500 / 1500 / 3500 ms) retry pattern used by `city-context.js`, **and**
  `window.bruce.city.onChange(apply)`.

### Wiring

Add `import "./city-links.js";` to `src/index.js` immediately after
`./city-switcher.js` (currently line 11). It is a leaf consumer of
`bruce.city`; nothing imports it.

## Data flow & edge cases

**Happy path** (first load, Swedish, saved city `sto`):

1. `city-context` resolves → `onChange("sto")` → `city-links.apply("sto")`.
2. `readGateways()` → `{ memberships: "/sv/medlemskap" }`;
   `readLinkMap()` → `{ memberships: { sto: "/sv/medlemskap/sto" } }`.
3. A link with pathname `/sv/medlemskap` → `matchSection` → `"memberships"`.
   Stash `{ section: "memberships", search: "", hash: "" }` in the WeakMap.
   `resolveHref` → set `href = "/sv/medlemskap/sto"`.

**Re-pointing on switch** (`sto` → `cph`): after the first pass the link's
href is `/sv/medlemskap/sto`, which no longer exact-matches the gateway. A
naive re-scan could not find it. The WeakMap solves this: a link already
*managed* is re-resolved from its **stored section + original query/hash**,
never from its current (already-rewritten) href. `apply("cph")` recomputes
managed links → `/sv/medlemskap/cph`. State is never mutated in place such
that the origin is lost.

**Neutral restore** (switch to no city): `apply(null)` → managed links
resolve to the gateway path + preserved query/hash and revert cleanly.
Un-managed links were never touched.

**Late CMS load:** the hidden Collection Lists may be absent at first resolve,
so `readLinkMap()` can be empty and no rewrites happen yet. Handled by
re-reading the lists on every pass and running the `SAFETY_PASS_DELAYS`
retries. `apply` is idempotent, so settled passes are cheap no-ops.

**Missing-map fallback:** if a city has no page in a section
(`linkMap[section][active]` absent), `resolveHref` returns the gateway path —
never a broken or guessed URL.

**Finsweet safety:** the hidden lists are their own elements, never sharing an
`fs-list` instance or ID with any other list — additive, so they do not
corrupt Finsweet enumeration elsewhere on the page (the slider/explorer CMS
gotcha).

## Testing

Pure core only, framework-free, run with
`node tests/city-links-plan.test.mjs` (same shape as
`tests/city-resolve.test.mjs`):

`matchSection`:
- exact match → section key
- trailing-slash variants → still match
- sub-page path → `null`
- unrelated path → `null`
- empty/unknown gateways map → `null`

`resolveHref`:
- active city with a page → city URL, query/hash preserved
- active city without a page in that section → gateway fallback
- neutral (`active = null`) → gateway path, query/hash preserved
- query + hash round-trip (`?plan=pro#faq` survives the rewrite)

The DOM shell (`city-links.js`) is not unit-tested, consistent with
`city-context.js` / `city-switcher.js`: its decisions are delegated to the
pure core and the DOM/WeakMap/timer wiring is thin.
