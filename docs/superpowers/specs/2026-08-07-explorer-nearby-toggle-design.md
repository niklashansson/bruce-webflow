# Explorer "Show studios in nearby areas" toggle

**Date:** 2026-08-07
**Owner:** explorer.js (per-region explorer page, `/studios/<region>`)
**Status:** Approved

## Goal

The region pages default to **metro-only** results, with a positively-phrased
switch that lets the user widen to the whole Bruce region:

> ☐ Show studios in nearby areas

Off (the default) → metro only. On → the full region, including the overflow
towns. The switch reads as *adding* studios, which is the direction a user
thinks in; the underlying Finsweet condition still *narrows*, so JS inverts
between the two.

Background on why metro membership exists at all — Bruce's `city_id` is a
region, not a city, so Malmö's region reaches Kalmar and Karlskrona — lives in
the sync repo: `docs/superpowers/specs/2026-08-06-city-filter-geography-design.md`.

## Why JS is needed

A Finsweet condition input only contributes when it is **checked**. There is no
attribute that filters on *un*checked. The behaviour we want is the opposite
shape:

| visible switch | desired condition |
| --- | --- |
| off (default) | `nearby-enabled equal true` — metro only |
| on | no condition — whole region |

The condition must be active while the visible control is **off**, which one
input cannot express. So the state is split across two inputs and JS keeps them
inverted.

## Pre-existing defects this change fixes

Both were found by reading the live Copenhagen page (`brucestudios.webflow.io`)
during design.

1. **The shipped toggle does the opposite of its label.** The input exists,
   already labelled "Show studios in nearby areas", but carries the Finsweet
   attributes directly and ships *unchecked*. So today: unchecked → no
   condition → whole region; checked → metro only. Checking a box that promises
   to *add* nearby areas *removes* them.

2. **The field names do not match, so the filter matches nothing.** The input
   declares `fs-list-field="in-metro"`, but every studio item emits
   `fs-list-field="nearby-enabled"`. No element on the page carries an
   `in-metro` field, so engaging the condition today yields zero results.

   **Resolution:** `nearby-enabled` wins — it is the name already bound on
   ~1000 studio items, and changing the single input is the smaller edit. Per
   the Webflow slug gotcha (Webflow derives slugs from display names and
   silently ignores the requested slug), verify the live attribute rather than
   assuming it.

Also confirmed while reading the page: the **native Webflow collection filter
is gone** — the counter reads 226 against a metro count of ~202 — closing that
open question. And `reflectFilters` currently counts the input harmlessly only
because it is unchecked; the moment it defaults to checked it would pin
`data-explorer-filtered` to `"true"` and permanently hide the discovery
collections. See §"reflectFilters" below.

## Markup contract (Webflow)

The city dropdown is duplicated for desktop and mobile — two copies, both
inside the single `<form fs-list-element="filters" id="studio-filters-form">`.
Each copy carries a **pair**:

```html
<!-- visible control: NO fs-list-* attributes at all -->
<label data-wf--check-ui--variant="toggle" data-state="checked" class="form_ui_label">
  <input type="checkbox" data-explorer-element="nearby-toggle" class="form_ui_input">
  …existing form_ui_visual_wrap spans…
  <span class="form_ui_text">Show studios in nearby areas</span>
</label>

<!-- hidden condition input: keeps the fs-list-* attributes, ships checked -->
<div class="u-display-none">
  <input type="checkbox" checked aria-hidden="true" tabindex="-1"
         data-explorer-element="nearby-source"
         fs-list-field="nearby-enabled" fs-list-value="true">
</div>
```

Notes:

- The visible label's existing visuals keep working untouched. This page styles
  checkbox state through the CSS rule
  `[data-state~="checked"]:is(:checked, :has(:checked))`, **not** a Webflow JS
  class, so there is no `.w--redirected-checked` bookkeeping and setting
  `.checked` on the visible input updates it correctly.
- Both inputs must stay **inside the filters form** — Finsweet only reads
  inputs in that subtree.
- `tabindex="-1"` + `aria-hidden="true"` keep the hidden input out of the tab
  order and the accessibility tree.

**Verify before building on it:** that Finsweet binds an input inside a
`display:none` wrapper. If it skips hidden inputs, fall back to sr-only
clipping (`position:absolute; width:1px; height:1px; clip-path:inset(50%)`)
so the input stays rendered, keeping `tabindex="-1"` and `aria-hidden="true"`.

## State model

One page-global boolean, held between all `nearby-toggle` and `nearby-source`
inputs, which are always inverses of each other:

```
toggle.checked  ===  !source.checked
```

Because the state is page-global rather than paired per dropdown, the
desktop/mobile duplication stops being a special case — it falls out of the
model instead of needing its own handling.

`.explorer_wrap` gets `data-explorer-nearby="true|false"` so CSS can style the
row, mirroring the existing `data-explorer-exclusive`.

### Defaults

Set in the HTML, not by JS, so there is no first-paint flash and no dependency
on script timing:

- `nearby-source` → `checked` → `nearby-enabled equal true` → metro only.
- `nearby-toggle` → unchecked → reads "Show studios in nearby areas: off".

### Transitions

| Trigger | source | visible toggle | results |
| --- | --- | --- | --- |
| First paint | checked (HTML) | off (HTML) | metro only |
| User switches nearby on | unchecked | on | whole region |
| URL restore | whatever Finsweet restores | inverse of source | as shared |
| Clear all | forced back to checked | off | metro only |

## Sync rules

The `change` handler branches on **what originated the change**:

- **A visible toggle changed.** `included = target.checked`. Every
  `nearby-source` is driven to `!included` via `.click()`. Every *other*
  visible toggle gets `.checked` set directly.

- **Anything else** — Finsweet `afterRender`, URL restore, first paint, a
  clear. The **first `nearby-source` in DOM order is canonical**. All toggles
  are set to its inverse; any disagreeing sources are clicked into line.

Two rules about *how* state is written, both load-bearing:

- **Sources are driven with `.click()`, never `.checked`.** Setting `.checked`
  desyncs Finsweet's model. A synthetic click dispatches `input` then `change`,
  and Finsweet re-reads the condition on the form's `fs-list-filteron` event,
  which defaults to `"input"`.
- **Visible toggles are driven with `.checked`.** They are not Finsweet inputs,
  their visuals are pure CSS `:has(:checked)`, and using `.click()` would
  generate events that re-enter the handler down the wrong branch.

**Termination.** The `.click()` on a source bubbles a `change` back to the
form, re-entering the handler down the second branch. It finds everything
already in agreement, writes nothing, and stops. This is the same shape as
`syncExclusiveToggle`'s equality guard at `src/explorer.js:239`.

### Clear all

Finsweet's clear would otherwise uncheck the source and leave the page showing
the whole region — a cleared state that differs from the initial state, and
which contradicts "nearby hidden by default".

So: a click on a **global** clear — `[fs-list-element="clear"]` with **no**
`fs-list-field` — sets a one-shot flag. The next `refreshFilterForms` sees the
flag, drives the source back to `checked`, and clears it.

Field-scoped clears (`fs-list-element="clear" fs-list-field="tier"`, and the
same for `category`) must **not** reset nearby — those clear one dropdown, not
the page.

The source input remains the single source of truth throughout; the flag only
overrides it for one pass. This keeps shared URLs restoring correctly.

## reflectFilters

Both `nearby-toggle` and `nearby-source` join the exclusive toggle's exemption
in `reflectFilters` (`src/explorer.js:176`). Neither is a filter chip:

- The source is **checked by default**, so counting it would make
  `form.dataset.hasFilters` permanently `"true"`, pin
  `data-explorer-filtered="true"`, permanently hide the discovery collections,
  and show "Clear all" on an untouched page.
- Turning nearby **on** *widens* the result set. A badge reading "1 filter
  active" for an action that adds studios is backwards.

## Code shape

The repo's idiom for logic worth testing without a browser — `city-links-plan.js`,
`city-visibility-decide.js`, `clean-link-params.js` — is a pure module with a
node test beside a thin DOM applier. The inversion plus N-way sync is exactly
that kind of logic, so:

**`src/nearby-plan.js`** — pure, no DOM. Given the current toggle and source
states, which element originated the change, and whether a global clear is
pending, return the desired state for every input:

```js
planNearby({ toggles, sources, originIndex, originKind, clearPending })
//   toggles: boolean[]   current .checked of each visible toggle
//   sources: boolean[]   current .checked of each hidden source
//   originKind: "toggle" | "source" | null
// → { toggles: boolean[], sources: boolean[], nearby: boolean }
```

**`tests/nearby-plan.test.mjs`** covering:

- toggle-origin branch: switching on unchecks every source
- other-origin branch: canonical source drives every toggle
- loop termination: an already-consistent state returns itself unchanged
- URL restore: source unchecked on load → toggles come up on
- disagreeing duplicates: desktop and mobile out of sync converge on canonical
- clear pending: forces source checked and toggles off regardless of input

**`src/explorer.js`** — the applier, roughly 40 lines in the shape of the
existing exclusive-toggle section:

- Two selectors in `S`: `nearbyToggle`, `nearbySource`.
- `syncNearbyToggle(form, origin)` — read the DOM, call `planNearby`, apply the
  result (`.click()` for sources, `.checked` for toggles), write
  `data-explorer-nearby`.
- Called from `refreshFilterForms()` and `setupFilterForms()` alongside
  `syncExclusiveToggle`; the form's `change` listener passes `event.target`.
- A delegated `click` listener for the global-clear flag.
- Both hooks added to the `reflectFilters` skip.

## Out of scope

Deliberately not part of this change, from the same brief:

- **Count mismatch** (`<h1>`, `<title>`, meta, JSON-LD say the regional total
  while the counter shows metro). Needs either a `metro-studio-count` field on
  Regions or a copy decision.
- **Market-level overflow pages** (Sverige 143 / Norge 11 / Danmark 21) for the
  studios unreachable by chip.
- **Town-level pages** and the nested "Other cities" dropdown.

## Ship

Per the repo's build gotchas: `rm -rf .parcel-cache dist`, then `pnpm build`
(minified, no `--no-optimize`), commit `dist/`, and purge jsDelivr `@main` via
`purge.jsdelivr.net` — a browser or incognito cache clear does not bypass the
CDN edge cache.
