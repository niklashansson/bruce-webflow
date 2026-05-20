# Studios Search Redirect — Design

**Date:** 2026-05-20
**New module:** `src/studios-search-redirect.js`
**Consumer:** `src/index.js` (global bundle)

## Background

The studios searchbar (free-text query + Memberships / Location / Categories
filter dropdowns) appears on marketing pages where `studios.js` does **not**
run. On the live search page (`/s`) Finsweet + `studios.js` filter a list in
place; on every other page the same-looking searchbar has nothing to act on —
typing a query and pressing the Search button does nothing, and the filter
dropdown options are plain `<a href="/s?city_equal=Bergen">` links that
navigate immediately on click.

We want those off-search pages to let a visitor **build up a multi-filter
search and a text query, then jump to `/s` with all of it applied** — the same
result they'd get by filtering on the search page directly.

## Scope

- **In scope:** A new global module that binds to a dedicated redirect form,
  serializes its text query + checked filter inputs into a `/s` URL in
  Finsweet's filter format, and redirects on submit. Author the off-page
  searchbar as a `<form>` with native checkbox/radio inputs.
- **Out of scope:** Any change to `studios.js`, `city.js`, or the live `/s`
  filtering. Any change to how Finsweet reads filters from the URL (we rely on
  the existing, working contract). Restyling the searchbar. Persisting the
  built-up selection across page loads.

## Approach (decided)

A **form + JS serializer**. A native form gives us `:checked` selection
styling, single-vs-multi via radio-vs-checkbox, Enter-to-submit, and
accessibility for free. But a native GET submit serializes a multi-select group
as repeated keys (`?city_equal=Bergen&city_equal=Oslo`), which is **not** the
format the search page restores. Finsweet's runtime format is a JSON array
(`?city_equal=["Bergen","Oslo"]` URL-encoded — the same `["københavn"]` shape
seen in the `city.js` URL-parsing bug). So a JS submit handler intercepts the
submit and builds the correct URL.

The rejected alternative (keep `<a>` links, JS-managed selection state) was more
code, reinvented checkbox semantics, needed custom styling hooks, and was less
accessible.

## Webflow markup contract

Documented in the module header in the `city.js` doc-comment style. The off-page
searchbar is authored as a dedicated form:

```html
<form data-studios-search action="/s">
  <input type="search"   name="q">                            <!-- free text  -->
  <input type="radio"    name="tier_equal"     value="BASE">  <!-- single group -->
  <input type="checkbox" name="city_equal"     value="Bergen"><!-- multi group  -->
  <input type="checkbox" name="category_equal" value="Yoga">  <!-- multi group  -->
  <button type="submit">Search</button>
</form>
```

- `data-studios-search` on the `<form>` is the bind marker — the module acts on
  this and nothing else.
- `action` is the redirect target path (defaults to `/s` if absent). Authorable
  so the search page can move without a code change.
- Filter inputs are grouped by `name`, which is the literal URL param key
  (`tier_equal`, `city_equal`, `category_equal`). Values are the filter values.
- Selection state is native `:checked` — styled in Webflow on the label/wrap.
  No custom attribute, no JS toggling.
- Single-value group → `radio`; multi-value group → `checkbox`.

## Module shape

`src/studios-search-redirect.js` follows the project's per-component pattern:
self-boots via import in `index.js`, idempotent init guarded by a
`data-script-initialized` flag on the form.

Responsibilities:

1. **Bind.** On init, find every `form[data-studios-search]`. For each, if not
   already initialized, attach a `submit` listener.
2. **Defensive no-op.** If a live studios component
   (`[data-studios-element="component"]`) exists anywhere in the document, skip
   binding entirely — the live page owns the searchbar and Finsweet must not be
   fought. (Belt-and-suspenders: the redirect form is a distinct component that
   should never be placed on `/s` in the first place.)
3. **Serialize + redirect.** On submit: `preventDefault()`, build the query
   string via the pure serializer below, then
   `window.location.assign(action + (query ? "?" + query : ""))`.

Enter-to-submit needs no extra handling — it's native form behavior.

## Serializer

A pure, exported function (testable in isolation via a Node script, as done for
the `city.js` fix):

```js
// Returns a URL query string (no leading "?"), already URL-encoded.
buildSearchQuery(formData): string
```

Rules:

- **`q`** — trimmed. Omitted entirely if empty after trim.
- **Filter groups** — collect the checked values for each `name`. Encode as a
  JSON array **always**, including a single selection:
  `city_equal=["Bergen"]`, `city_equal=["Bergen","Oslo"]`. This mirrors
  Finsweet's own runtime format, maximizing the chance the live page restores
  it. Groups with no checked values are omitted.
- **Encoding** — each `key=value` pair is `encodeURIComponent`-encoded so the
  brackets, quotes, commas, and non-ASCII city names (e.g. `København`) survive
  transit.
- **Order** — `q` first, then filter groups in DOM order, for stable, readable
  URLs.

### Empty submit

Nothing typed and nothing selected → `buildSearchQuery` returns `""` and the
module redirects to the bare `action` (`/s`), showing all studios. Predictable
"browse everything" behavior.

## index.js changes

Add `import "./studios-search-redirect.js";` so the module boots on every page.
Place it near the other `studios`/`city` related registrants.

## Verification

No automated test framework exists in the repo. Verification is two-part:

1. **Serializer unit check.** A throwaway Node script exercising
   `buildSearchQuery` against: empty input; query only; single filter; multi
   filter same group; multi groups; non-ASCII value (`København`); query +
   filters combined. Assert exact output strings.
2. **Live behavior.** On a marketing page: select filters across dropdowns, type
   a query, press Search → lands on `/s` with the list filtered and the map
   framed to the selection, and the search text applied. Confirm a single
   filter and a multi filter both restore. Confirm an empty submit lands on a
   bare `/s`.

## Assumptions to verify on the live `/s` page

Both are existing contracts the current static anchor links already depend on,
but call them out explicitly:

- `/s` restores **list filters** from `?city_equal=[…]` (and the other
  `*_equal` keys) on load. The JSON-array encoding is the format Finsweet emits
  itself, so single-element arrays must restore as well as multi.
- `/s` restores the **search text** from `?q=`. The input is authored with
  `name="q"`; if Finsweet's search URL key differs, the serializer's `q` key
  must match it.

If either differs from expectation, the fix is localized to the serializer's
key/encoding — no structural change.

## Risks

- **Encoding mismatch with Finsweet.** If the live page expects plain
  single-values (`city_equal=Bergen`) rather than `["Bergen"]`, single-filter
  redirects won't restore. Mitigated by centralizing all encoding in one pure
  function and verifying against the live page early. The `["…"]` choice is
  evidence-based (it's the shape the `city.js` bug surfaced from Finsweet).
- **Form placed on `/s` by mistake.** The defensive no-op (skip when a studios
  component is present) prevents hijacking the live searchbar even if the form
  is mistakenly reused there.
