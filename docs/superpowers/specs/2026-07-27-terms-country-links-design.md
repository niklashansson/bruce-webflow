# Terms Country Links — Design

Date: 2026-07-27
Status: Approved (pending implementation)

## Goal

Route every "Terms" link to the right per-country terms page — `/terms/se`,
`/terms/dk` or `/terms/no` (localized, e.g. `/sv/terms/se`) — based on the
visitor's selected city. Stockholm/Gothenburg → SE, Copenhagen → DK, Oslo →
NO. Links update live on city switch, exactly like the existing
membership/studio gateway links.

This is **link rewriting only**. No landing-page redirect (same deferral as
the city-link-rewrite design).

## Why this shape

The terms pages are per-**country**, but the active selection is a **city**.
The existing rewriter (`src/city-links.js`) keys its link lists by city slug,
so the missing piece is a city → country hop. Rather than duplicating the
Cities collection into three country-filtered hidden lists (heavy DOM, opaque
to editors), we teach the rewriter that a link list may be keyed by a **city
variable** instead of the city slug. The country rides along as a normal
`data-city-var-*` value, and the terms list needs only three static items.

As always: **no URL is ever constructed in JS**. Webflow renders real,
localized page links into hidden source elements; JS copies the right one.

## Scope

In scope:

- A `country` variable on cities (new Cities option field).
- A generic `data-city-link-by="<var>"` mechanism on link lists.
- The `terms` section using it, with SE as the neutral/default target.

Out of scope:

- Redirecting visitors who land directly on a terms URL.
- Cross-locale repair (same-locale matching only, as before).

## Webflow-side data contract

### A. Cities collection — new field

Add an **option field "Country"** with values `se`, `dk`, `no`. Render it on
the hidden city registry items (`[data-city-list] [data-city-slug]`) as:

```html
data-city-var-country="se"
```

`city-registry.js` already parses any `data-city-var-*` into `city.vars`, so
no registry code changes.

### B. Global component — gateway anchor + keyed link list

```html
<a data-city-gateway="terms" href="(internal link → Terms SE page)" hidden></a>

<div data-city-link-list="terms" data-city-link-by="country" hidden>
  <a data-city-link-item data-city-link-key="se" href="(internal link → Terms SE page)"></a>
  <a data-city-link-item data-city-link-key="dk" href="(internal link → Terms DK page)"></a>
  <a data-city-link-item data-city-link-key="no" href="(internal link → Terms NO page)"></a>
</div>
```

Load-bearing rules:

1. Every `href` is a **Webflow internal page link** (never typed text), so
   Webflow owns the locale prefix and any localized slugs.
2. These are **static links**, not a Collection List — the three terms pages
   are static pages.
3. The gateway points at **Terms SE**: it is both the match target and the
   neutral/unknown fallback (per the "default country page" decision).

### C. Authored links

Footer/menu "Terms" links are normal internal page links to the **Terms SE**
page. The rewriter recognizes that path as the `terms` gateway and repoints
per city. `data-city-link-skip` opts a link out, unchanged.

## Behavior

- **Active city with `country` var** → link points at
  `linkMap.terms[country]` (query/hash preserved).
- **Neutral (no city)** → gateway path (= Terms SE).
- **Active city with missing/unknown `country`** → gateway fallback
  (= Terms SE). Never a broken or guessed URL.
- **City switch** → managed links re-point from their stored section +
  original query/hash (existing WeakMap mechanism, untouched).
- Slug-keyed sections (`memberships`, `studios`) behave exactly as before.

## Code changes

Same pure-core / DOM-shell split as today.

### `src/city-links-plan.js` (pure, unit-tested)

`resolveHref` learns the keyed-by-var case. Context gains `keyBy` (section →
var name, absent for slug-keyed sections) and `activeVars` (the active city's
`vars`, or `null` when neutral):

```js
export function resolveHref(
  { section, search, hash },
  { gateways, linkMap, keyBy, active, activeVars },
) {
  const by = keyBy?.[section];
  const key = by ? (activeVars?.[by] ?? null) : active;
  const url = key ? linkMap[section]?.[key] : null;
  return (url ?? gateways[section] ?? "") + search + hash;
}
```

`matchSection` is unchanged.

### `src/city-links.js` (DOM shell)

- `readLinkMap()` also reads the optional `data-city-link-by` attribute from
  each `[data-city-link-list]` wrapper into a `keyBy` record
  (e.g. `{ terms: "country" }`).
- `apply(active)` resolves `activeVars` by finding the active city in
  `window.bruce.city.all()` (null when neutral or not found) and passes
  `keyBy` + `activeVars` through to `resolveHref`.

No changes to boot, safety passes, WeakMap handling, or exclusions.

## Testing

Extend `tests/city-links-plan.test.mjs` (`node tests/city-links-plan.test.mjs`):

- keyed section + active city with `country: "dk"` → DK URL, query/hash
  preserved
- keyed section + neutral → gateway (SE)
- keyed section + active city with no `country` var → gateway fallback
- keyed section + `country` value with no list entry → gateway fallback
- slug-keyed sections with `keyBy` present-but-unrelated → behavior identical
  to today (regression)
- omitted `keyBy` / `activeVars` (old call shape) → still resolves slug-keyed
  sections, so the shell and core cannot desync

## Deploy

The usual dance: `rm -rf .parcel-cache dist && pnpm build` (minified, no
`--no-optimize`), commit `dist/`, push, purge jsDelivr `@main` via
purge.jsdelivr.net.
