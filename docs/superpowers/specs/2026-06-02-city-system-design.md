# City System — Design (from scratch)

Date: 2026-06-02
Status: Approved (pending implementation)

> **Supersedes** the existing city implementation entirely. This is a
> ground-up replacement for `src/city.js`, `src/city-visibility.js`, and
> `src/city-visibility-decide.js`. Earlier related specs
> (`2026-05-22-studios-city-picker`, `2026-05-27-city-visibility-attribute`,
> `2026-05-27-preview-city`) are absorbed or replaced by this one. The
> resolution model and "neutral is a real state" behavior described here
> differ from the current code and take precedence.

## Goal

A single, attribute-driven city system that serves two page shapes:

- **City-bound pages** — `/studios/city/stockholm`, `/memberships/stockholm`.
  The URL commits to one city; content is deterministic, shareable, and
  SEO-stable regardless of visitor preference.
- **City-agnostic static pages** — `/studios`, `/memberships`, the homepage,
  global nav/footer. Indexable and **city-neutral by default**; able to
  conditionally show city-specific content and personalize in place once a
  city is known.

Editors express everything through CMS-bound HTML attributes. No per-page
JS wiring.

## Core concepts

There is exactly **one active city** at a time (or **neutral** — no city).
Two distinct sources of authority feed it:

- **Lock** — the city the *URL* commits to, on city-bound template pages.
  Absolute; a visitor's saved preference never overrides it.
- **Ambient** — the city resolved from visitor *preference* on pages that
  carry no city URL. Falls to **neutral** when unknown.

Both collapse into a single active-city value that placeholders and
visibility read. "Neutral" (`null`) is a first-class, fully-resolved state —
**not** an error or a pre-boot condition — and it is the correct baseline for
a first-time visitor and for crawlers.

## Resolution chain

Highest authority first. Produces the active city, or `null` (neutral):

1. **Lock** — `<body data-city-lock="{slug}">` on city-bound template pages.
   If present and the slug exists in the registry → active = lock.
   *Side effect:* if no saved preference exists yet, write this slug to
   localStorage (**seed-on-first-contact**). An existing saved choice is
   **never** overwritten by seeding.
2. **`?city=` param** — transient deep-link override for non-locked pages
   (campaign links to a personalized homepage). Not persisted. Lock outranks
   it; on a locked page the param is ignored.
3. **Saved preference** — `localStorage["bruce-city"]`, validated against the
   registry. Stale/removed slugs are ignored.
4. **Neutral (`null`)** — no implicit CMS-default or first-city fallback.

There is intentionally **no** "default city" fallback tier. A page that
genuinely wants to force a default can do so by being a locked page.

## Module decomposition

Five focused modules, each with one responsibility:

| Module | Responsibility |
|---|---|
| `src/city-registry.js` | Read the hidden CMS `[data-city-list]` into `cities[] = {slug, name, vars, coords}`. Re-read on late CMS render. Source of truth for *what cities exist*. |
| `src/city-context.js` | Run the resolution chain; hold the active city; persist; lock + seed-on-first-contact; push vars + reserved placeholders into `variables.js`; expose the public API and `onChange`. |
| `src/city-visibility.js` | Toggle `data-city-show/hide/none/any` elements off the active city. Observer + safety passes. Owns the `is-city-ready` body flag. |
| `src/city-visibility-decide.js` | Pure, DOM-free decision helper: `(attrs, activeSlug, cities) → {visible, unknownValues}`. Unit-tested. |
| `src/city-switcher.js` | `data-set-city` ambient (in-place) switching + `data-city-active` state sync. |

**Unchanged / out of scope:** `src/variables.js` (placeholder engine — the
city system pushes values into it via `setGlobal`), `src/location.js` (map
geolocation — unrelated).

## Public API (`window.bruce.city`)

```js
window.bruce.city.get()        // → "sto" | null   (null = neutral)
window.bruce.city.isNeutral()  // → boolean
window.bruce.city.set(slug)    // ambient set + persist + re-render; "" → neutral
window.bruce.city.all()        // → [{slug, name, coords, vars}, ...]
window.bruce.city.onChange(fn) // subscribe; fn(slug|null); returns unsubscribe
```

`set()` is the **explicit** path (the ambient switcher). It always
overwrites the saved preference; `set("")` resets to neutral **and removes**
the stored preference (so neutral persists). Only the lock's seed step is
conditional on the preference being empty.

**`onChange` semantics:** subscribers are notified once on the **initial
resolution** (even when the result is neutral / `null`, and even if that
matches a subscriber's assumed starting state), and again on every subsequent
change — including transitions to and from neutral. This initial fire is what
drives the visibility module to set `is-city-ready`; without it a neutral page
(`null → null`) would never reveal its `data-city-none` content. This differs
from the old code, which only fired on an actual slug change.

## Editor-facing attribute API

### Registry — one hidden Collection List in a global symbol (ships on every page)

```html
<div data-city-list hidden>
  <!-- Collection Item, attributes bound to CMS fields: -->
  <div data-city-slug="{slug}"
       data-city-name="{name}"
       data-city-var-phone="{phone}"
       data-city-var-studio-count="{count}"
       data-city-var-lat="{lat}"
       data-city-var-lng="{lng}"></div>
</div>
```

- `data-city-slug` (required), `data-city-name` (required).
- Any `data-city-var-*` attribute → a per-city placeholder value; the key is
  the suffix (`data-city-var-phone` → `{{phone}}`).
- `lat`/`lng` are parsed once into a `coords` tuple `[lng, lat]` (Mapbox
  convention); a missing/invalid pair → `coords: null`.

### Lock — on city-bound collection template pages

```html
<body data-city-lock="{current item slug}">
```

Bound to the current CMS item's slug. This is the only wiring a city-bound
template needs.

### Conditional visibility — four attributes

| Attribute | Element is visible when |
|---|---|
| `data-city-show="stockholm,oslo"` | active city ∈ list |
| `data-city-hide="stockholm"` | active city ∉ list (**including neutral**) |
| `data-city-none` | neutral — no city chosen (e.g. "Pick your city") |
| `data-city-any` | any city is active (e.g. "View {{city-name}} studios") |
| *(no attribute)* | always — the generic SEO baseline |

`show`/`hide` values are comma-separated, trimmed, matched case-insensitively
against both `slug` and `name`. `none`/`any` take no value. An element with
none of these attributes is never touched.

### Switching

- **Between city pages** (locked → locked): plain Webflow CMS anchor links to
  each city's collection page. No JS, no attribute — the destination page's
  lock resolves everything, and seed-on-first-contact records the choice.
- **In-place on global pages**: `data-set-city="{slug}"` (JS sets active +
  persists + syncs `data-city-active="true|false"` for styling).
  `data-set-city=""` resets to neutral. Delegated listeners cover static and
  CMS-injected switchers; keyboard activation supported for non-native
  triggers (`role="button"`).

### Placeholders (rendered by `variables.js`)

| Placeholder | Active city | Neutral |
|---|---|---|
| `{{city}}` | slug (`stockholm`) | `""` |
| `{{city-name}}` | display name (`Stockholm`) | `""` |
| `{{city-path}}` | `/stockholm` | `""` |
| `{{<var>}}` | the `data-city-var-<var>` value | `""` |

`{{city-path}}` exists so editor links degrade cleanly: `/memberships{{city-path}}`
→ `/memberships/stockholm` when a city is active, `/memberships` when neutral.

## Data flow & boot

1. **Registry** reads `[data-city-list]`. Late CMS renders are caught by a
   narrow `MutationObserver` plus safety passes at `[500, 1500, 3500]` ms
   (matching the existing module convention).
2. **Context** runs the resolution chain → active city or neutral; performs
   seed-on-first-contact if applicable; pushes the active city's vars and the
   reserved placeholders into `variables.js`; fires `onChange`.
3. **Visibility** sweeps every `[data-city-show]/[hide]/[none]/[any]`, toggles
   `is-city-hidden`, then sets `body.is-city-ready` **once resolution has
   completed — even if the result is neutral**. (This is the key behavioral
   difference from the old code, which only flagged ready on a non-null slug.)
4. **Switcher** delegated listeners are live throughout; a `set()` re-runs the
   context → `onChange` → sweep cycle.

### FOUC handling (site-wide custom CSS, added once)

```css
.is-city-hidden { display: none !important; }

html:not(.wf-design-mode) body:not(.is-city-ready)
  :is([data-city-show],[data-city-hide],[data-city-none],[data-city-any]) {
  display: none;
}
```

- Pre-hide keeps **all** city-conditional content `display:none` until the
  context resolves; the first sweep reveals the correct set and drops the
  pre-hide via `is-city-ready`.
- `!important` on `.is-city-hidden` defeats Webflow class-driven
  `display:flex/grid/block` (same external-CSS precedence lesson as the
  bottom-sheet web component).
- **Fail-closed:** if the registry never loads / context never resolves,
  `is-city-ready` is never set and only generic (no-attribute) content shows —
  which is exactly the safe neutral baseline.
- The `html:not(.wf-design-mode)` prefix + a `data-preview-city` hook on
  `<body>` lets editors preview a single city in the Webflow Designer without
  the live resolution chain running.

### "Resolved" vs "pre-boot"

The decision helper must distinguish *neutral* (resolved, no city) from
*not-yet-resolved* (pre-boot). The signal is the context's **initial
`onChange` fire** (see *Public API*): the visibility module sets
`is-city-ready` inside its `onChange` handler, which the context guarantees to
run once after the first resolution — even for a neutral result. Before that
fire, pre-hide CSS holds. Because neutral is a valid resolved state,
`is-city-ready` can be set with `active === null` — at which point
`data-city-none` elements reveal and `data-city-show`/`any` elements stay
hidden.

## Edge cases

- **Lock slug not in registry** → warn once, treat as neutral (don't push
  undefined vars). A correctly-published city page will always have its slug
  in the registry.
- **Saved slug removed from CMS** → ignored during validation, resolve onward
  (→ neutral unless another tier matches).
- **localStorage throws** (private mode / strict cookie policy) → best-effort
  try/catch on both read and write; degrade to session-only / neutral.
- **Unknown token in `show`/`hide`** → warn once per `(attribute, token)` pair,
  element stays hidden (the safer reading of an unknown city is "not this
  city").
- **Lock + `?city=` both present** → lock wins; param ignored.
- **Multiple `?city=` values** → first wins (single ambient city).

## Testing

Pure helpers carry the unit coverage; DOM wiring is verified manually on
staging (same coverage boundary as the rest of the project).

**`city-visibility-decide` (pure):**
- `show` × active-match / no-match / unknown-token / neutral
- `hide` × active-in-list / not-in-list / neutral (visible when neutral)
- `none` × neutral (visible) / active (hidden)
- `any` × active (visible) / neutral (hidden)
- no-attribute → always visible
- case-insensitive slug and name matching

**`city-context` resolution (pure where possible):**
- lock present → wins over saved preference
- lock present, no saved pref → seeds preference
- lock present, existing saved pref → preference **not** clobbered
- `?city=` on non-locked page → overrides saved; not persisted
- lock + `?city=` → lock wins
- saved preference valid → resolves to it
- saved preference invalid/removed → neutral
- nothing set → neutral
- localStorage throws → no crash, neutral

**`city-registry` parsing:**
- slug/name/vars extraction; `data-city-var-*` key derivation
- lat/lng → coords tuple; missing/invalid → `coords: null`
- empty/missing list → empty array (→ neutral downstream)

## Index wiring

`src/index.js` imports the new modules in dependency order:
`city-registry` → `city-context` → `city-visibility` → `city-switcher`.
Correctness does not depend on import order (the ready-flag gating handles
timing), but this order reads naturally.

## Editor documentation (deliverable)

A plain-language guide for **marketing editors** is part of this work, not an
optional extra. It lives at `docs/editors/city-system.md` and is written for
non-developers (no JS, no internals) so it can be shared as-is or pasted into
the team's wiki/Notion.

It must cover, with copy-pasteable examples:

- **Cities registry** — how to add a city to the hidden Collection List and
  what each `data-city-*` / `data-city-var-*` field does.
- **City pages** — adding `data-city-lock` (bound to the item slug) on the
  City / City Studios template pages.
- **Showing/hiding content per city** — the four attributes
  (`data-city-show`, `data-city-hide`, `data-city-none`, `data-city-any`) with
  a one-line "use this when…" for each and a worked example.
- **City switchers** — when to use a plain CMS link to a city page vs. a
  `data-set-city` in-place switcher.
- **Placeholders** — the `{{city}}`, `{{city-name}}`, `{{city-path}}`, and
  per-city `{{var}}` tokens, including the `/memberships{{city-path}}`
  link-degradation pattern.
- **The neutral state** — what visitors see before they pick a city and why
  `data-city-none` exists.
- A short **gotchas** list (don't put the registry outside the global symbol;
  blank vs. missing attribute behavior).

Keep it task-oriented ("To show a block only in Stockholm, add…") rather than
reference-oriented.

## Editor / CMS rollout notes

- The two CSS rules go into Webflow site-wide custom code **before**
  publishing the JS, or first-load FOUC is visible.
- City-bound template pages must add `<body data-city-lock="{slug}">` bound to
  the collection item slug.
- The hidden `[data-city-list]` Collection List must live in a global symbol
  so it ships on every page (including static/neutral ones).
- `dist/` is committed minified; rebuild with `rm -rf .parcel-cache dist`
  before `pnpm build` to avoid stale-cache builds, then purge jsDelivr `@main`
  (`purge.jsdelivr.net`) — browser cache clears do **not** bypass the CDN edge.

## Out of scope (YAGNI)

- No IP / edge (Cloudflare Worker) geolocation. The neutral baseline makes
  first-visit detection unnecessary; saved preference + URL cover the rest.
- No multi-city ambient state. Multi-city behavior (e.g. the explorer map
  filtering to several cities) is a separate list-filter concern.
- No negation syntax beyond the four attributes (`data-city-show="!cph"`).
- No animation hook on show/hide — editors attach CSS transitions to
  `.is-city-hidden` themselves if wanted.
- No matching by city `vars` (`data-city-show-where="phone=*"`).
