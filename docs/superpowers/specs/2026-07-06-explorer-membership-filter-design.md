# Explorer membership filter: single-select + "exclusive to" toggle

**Date:** 2026-07-06 (revised same day: native-first via radios + dynamic `fs-list-value`)
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
*narrows* — no negation is needed, so both conditions can AND together
natively.

## Approach: fully native Finsweet, JS is glue only

Finsweet owns ALL matching. No custom predicate in the `filter` hook.

- **Membership single-select**: the tier inputs are **radios** (changed in
  Webflow) with `fs-list-field="tiers"` + `fs-list-operator="contain"`.
  Radio semantics give single-select natively; selecting X yields the
  condition `tiers contain X` → the *included* set.
- **Exclusive toggle**: a checkbox **inside the filters form** (placed there
  in Webflow) with `fs-list-field="tier"` + `fs-list-operator="equal"` and
  **no static value**. JS keeps its `fs-list-value` attribute set to the
  currently selected membership and dispatches a `change` event on it whenever
  the selection changes. Checked, it adds the condition `tier equal X`, which
  ANDs with the radio condition → the *exclusive* set.

  Verified against the Finsweet v2 source (`packages/list/src/filter/standard/
  conditions.ts`): a condition's value is re-read from the input's
  `fs-list-value` on every `change` event of that input, and conditions are
  keyed by `field_op`, so `tiers_contain` (radio) and `tier_equal` (toggle)
  coexist cleanly.

## Markup contract (Webflow)

- **Membership radios** (already done): `fs-list-field="tiers"`,
  `fs-list-operator="contain"`, `fs-list-value="base|black|epic"`, one radio
  group across the toolbar dropdown / modal copies.
- **Toggle checkbox** (already placed inside the `<form fs-list-element="filters">`
  subtree — required, Finsweet only reads inputs inside the form):
  - `fs-list-field="tier"`, `fs-list-operator="equal"`, no `fs-list-value`
    authored (JS maintains it).
  - Hook for JS: `data-explorer-element="exclusive-toggle"` on the input.
  - The label copy is **static**, authored in Webflow (e.g. "Show exclusive
    to BLACK") — no dynamic tier-name slot.
- **State attributes on `.explorer_wrap`** (CSS reads these, same pattern as
  `data-state` / `data-explorer-map`):
  - `data-explorer-membership="<value>"` — present while a membership is
    selected, absent otherwise.
  - `data-explorer-exclusive-available="true|false"` — CSS shows the toggle
    row only when `true` (a membership is selected — any tier, including the
    top one).
  - `data-explorer-exclusive="true|false"` — toggle state, styles the switch.

## JS responsibilities (glue only)

On membership radio change and on `afterRender` (covers Finsweet's URL
restore on load):

1. Resolve the selected membership from the checked radio (dedupe across
   copies).
2. Set the toggle input's `fs-list-value` to it and dispatch both bubbling
   `input` and `change` events on the toggle input so Finsweet re-reads the
   condition (Finsweet's `fs-list-filteron` default is `input`).
3. If no membership is selected: uncheck the toggle via `.click()` (never
   `.checked = false` — Finsweet model + Webflow custom-input visuals), set
   `data-explorer-exclusive-available="false"`.
4. Update the wrap attributes.
5. In `reflectFilters`, **skip** the toggle input when counting badges — the
   toggle must never count into the "Memberships ①" badge or the grand total
   (it does still keep `data-explorer-filtered` semantics via the radio).

No new pure module: the glue is DOM-centric and thin; small helpers live in
explorer.js. (The previously planned `src/explorer-membership.js` +
filter-hook predicate are dropped.)

## Behavior

- Radio select → Finsweet filters to included set; badges/count/map/empty
  state flow through the existing hooks untouched.
- Toggle on → condition `tier equal X` activates → exclusive set.
- Switching membership while toggle is on → glue updates `fs-list-value` +
  dispatches `input`/`change` → narrowing follows the new membership; toggle
  stays on.
- Membership cleared → toggle force-unchecked + hidden; list back to
  unfiltered.
- Mobile map mode: the filter bar (the whole form, toggle included) already
  moves into the bottom-sheet header via `placeFilterBar` — nothing new.

## Edge cases

| Case | Behavior |
| --- | --- |
| No membership selected | Toggle hidden + unchecked; today's behavior |
| Top tier selected | Toggle available like any other (`tier equal epic` = epic-exclusive studios) |
| Card missing/empty `tier` text | Native `equal` never matches an empty field → hidden in exclusive mode (correct: can't prove exclusivity) |
| Exclusive set empty | Existing `empty` state renders |
| Clear all (`fs-list-element="clear"`) | Native clear resets both conditions; glue then sees no selection and hides the toggle |
| Per-field clear on `tiers` only | Radios clear natively; glue detects no selection → unchecks + hides toggle |
| Double render on membership switch (radio change + toggle change) | Accepted — two cheap passes within Finsweet's debounce window |

## Verification points (implementation-time, with fallbacks)

1. **URL restore**: confirm `fs-list-showquery` serializes and restores the
   toggle's dynamic-value condition from a shared link. If restore is
   unreliable (the checkbox's `fs-list-value` is empty until glue runs), fall
   back to a hand-rolled `exclusive=1` param (`history.replaceState` +
   restore-on-load; `syncCityLinks` carries it across cities automatically).
2. **Deselect affordance**: radios can't be un-selected by re-clicking —
   confirm the filter UI keeps a per-field clear / "All" option so users can
   return to "no membership".
3. **`getFormFieldValue` semantics**: confirm an unchecked toggle yields an
   inactive condition and a checked one yields its `fs-list-value` (expected
   from `@finsweet/attributes-utils`, spot-check on the live page).

## Testing

Manual verification on the live page (all behavior is Finsweet + DOM glue —
no pure logic left to unit-test): select each membership, flip the toggle,
verify counts, badges (toggle never counts), map markers, empty state, clear
buttons, URL restore from a shared link, city-switch carry-over, and the
mobile bottom-sheet filter bar.
