# Explorer membership filter: single-select + "exclusive to" toggle

**Date:** 2026-07-06
**Owner:** explorer.js (per-city explorer page)
**Status:** Approved

## Goal

Match the new filter design for the explorer page:

1. The Memberships filter is **single-select** — only one membership can be
   active at a time. With membership X selected, the list shows every studio
   **included** in X.
2. A **"Show exclusive to X" toggle** next to the count switches the list to
   only the studios **exclusive to X** — unlocked starting at that membership,
   not available on any lower one (mockup: 408 included → 60 exclusive for
   BLACK).

## Data model (existing, no CMS changes)

Each studio card carries two Finsweet fields:

| Field | Example | Meaning |
| --- | --- | --- |
| `fs-list-field="tier"` | `black` | The studio's **exclusive tier** — the lowest membership that unlocks it |
| `fs-list-field="tiers"` | `base black epic` | **Every** membership that unlocks it, one space-separated string |

Because a studio with `tier = X` always has X in its `tiers` string, the
exclusive set is a **strict subset** of the included set. The toggle only ever
*narrows* the natively filtered list — no negation/inversion is needed
anywhere.

## Approach: native-first

The membership checkboxes stay **fully native Finsweet fields**
(`fs-list-field="tiers"` + `fs-list-operator="contain"`, as already configured
in Webflow). Included-mode filtering, URL deep-linking (`fs-list-showquery`),
badge counting (`reflectFilters`), and "Clear all" keep working with no new
code.

JS adds three things:

1. **Single-select enforcement** (explorer.js)
   On `change`, when a membership checkbox becomes checked, uncheck every
   checked membership input with a **different** value — across all copies
   (toolbar dropdown + modal) — by calling `.click()` on them. Never set
   `.checked` directly (desyncs both the Finsweet model and Webflow's custom
   checkbox visuals). Re-clicking the selected membership unchecks it → back
   to no selection.

2. **Exclusive toggle** (explorer.js + pure module)
   A plain clickable element. When ON, the existing Finsweet `filter` hook
   narrows the natively filtered items to cards whose `tier` text equals the
   selected membership — structurally identical to the "search this area"
   narrowing already in that hook (but persistent, not one-shot). Re-runs via
   `fsListInstance.triggerHook("filter")` on every toggle/membership change.

3. **One URL param**: `exclusive=1`, written with `history.replaceState`
   (present only while ON). The membership itself persists via Finsweet's
   native query URL. `syncCityLinks` already copies `location.search`
   wholesale, so both carry across city switches for free.

## Markup contract (Webflow)

New elements/attributes — the only Webflow build work:

- **Toggle row** (sits next to the count, per the mockup):
  - Clickable element: `data-explorer-element="exclusive-toggle"`. JS binds
    click and maintains `aria-pressed`.
  - Dynamic tier name slot inside its label:
    `<span data-explorer-element="exclusive-tier-slot">BLACK</span>` — JS
    writes the **selected** membership's display name, read from that
    membership checkbox's own label text (stays Designer-authored).
- **State attributes on `.explorer_wrap`** (CSS reads these, same pattern as
  `data-state` / `data-explorer-map`):
  - `data-explorer-membership="<value>"` — present while a membership is
    selected, absent otherwise.
  - `data-explorer-exclusive-available="true|false"` — CSS shows the toggle
    row only when `true` (i.e. a membership is selected — any membership,
    including the top tier).
  - `data-explorer-exclusive="true|false"` — toggle state; styles the switch
    and may restyle cards.

The membership checkboxes themselves are **unchanged** (keep
`fs-list-field="tiers"`, `fs-list-operator="contain"`, `fs-list-value`).
JS identifies the membership group as checkbox inputs carrying
`fs-list-field="tiers"` inside the filters form(s) — no extra attribute
needed; the category group uses a different field key.

## Behavior

- **Selection changes** (single-select enforcement, above) flow through
  Finsweet natively; the filter hook + `afterRender` update count, badges,
  empty state, and the map as they already do.
- **Toggle click**: flip state → update wrap attributes + label slot + URL
  param → `triggerHook("filter")`.
- **Availability**: whenever no membership is selected, the toggle is hidden
  (`data-explorer-exclusive-available="false"`) and forced OFF. Switching
  between memberships keeps the toggle state.
- **Clear**: Finsweet's native `fs-list-element="clear"` unchecks the
  membership inputs itself; a click listener on clear elements (global or
  tier-scoped) additionally resets the toggle.
- **Selected membership resolution**: derived from the currently checked
  membership input(s) in the filters form(s); duplicated copies dedupe by
  value. Re-read on each filter pass so Finsweet's URL restore on load is
  picked up without ordering hacks.
- **Badges**: unchanged — the toggle never counts as a filter badge; the
  membership continues to count into the existing `tier` group via
  `reflectFilters`.

## Edge cases

| Case | Behavior |
| --- | --- |
| No membership selected | Toggle hidden + OFF; list = today's behavior |
| Toggle ON, membership unchecked/cleared | Toggle forced OFF + hidden |
| Toggle ON, membership switched | Toggle stays ON, narrowing follows the new membership; label slot updates |
| Card missing/empty `tier` text | Hidden in exclusive mode (can't prove exclusivity); included mode is native Finsweet behavior |
| Exclusive set empty | Existing `empty` state renders — no special casing |
| URL `exclusive=1` with no membership in URL | Ignored (toggle stays OFF/hidden) |
| Multiple membership values checked at load (stale shared link) | First checked value wins; single-select enforcement corrects on next interaction |

## Module split + testing

Following the repo's pure-module pattern (`faq-plan.js`,
`city-visibility-decide.js`):

- **`src/explorer-membership.js`** — pure, no DOM:
  - parse a `tier`/`tiers` text into normalized value(s);
  - resolve the selected membership from a list of checked values (dedupe,
    first-wins);
  - the exclusive predicate (`cardTier === selected`);
  - `exclusive=1` param encode/decode.
- **`tests/explorer-membership.test.mjs`** — framework-free
  (`node tests/explorer-membership.test.mjs`), covering the predicate, the
  edge cases above, and param round-tripping.
- **`src/explorer.js`** — DOM wiring only: single-select listener, toggle
  binding, wrap attributes, label slot, clear hook, filter-hook narrowing.

Manual verification on the live page (Finsweet + map integration can't be
unit-tested): select each membership, flip the toggle, verify counts, badges,
map markers, empty state, URL restore from a shared link, and city-switch
carry-over.
