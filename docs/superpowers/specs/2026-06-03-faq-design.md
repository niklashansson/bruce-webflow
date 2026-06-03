# FAQ Component — Design

**Date:** 2026-06-03
**Module:** `src/faq.js`

## Problem

The FAQ is a two-level nested accordion (see design reference): top-level **Sections**
expand, and inside an open section the individual **Questions** expand to reveal answers.

The content lives in two normalized CMS collections:

- **FAQ Sections** — title + manual sort order.
- **FAQ Items** — question, answer, and a **single reference** to a FAQ Section.

It must ship as a **reusable Webflow Component**. A Webflow Component cannot contain a
*nested* collection list, so the Sections → Items hierarchy cannot be assembled with
native nested collection lists. It must be assembled another way.

## Decision

Use **two sibling (non-nested) collection lists** inside the component plus a small
`faq.js` "nest, prune, hand off" script:

- A **Sections** list renders the accordion shells (sorted by section order), each
  containing an empty drop-zone tagged with the section slug.
- An **Items** list renders the question accordions (sorted by item order), each tagged
  with its referenced section slug.
- `faq.js` moves each item into its section's drop-zone, removes empty sections, removes
  the now-empty source list, then calls the existing `initAccordion()`.

This keeps **both** section headers and items styled natively in Webflow, preserves
independent manual ordering of sections and items, adds **no external dependency**, fits
inside a Component (no nested list), and reuses `src/accordion.js` for all interaction.

### Approaches considered

1. **Two sibling lists + `faq.js` (chosen).** Full native styling of both levels;
   independent ordering; no dependency; reuses `accordion.js`. Cost: two lists to bind.
2. **Finsweet List Nest.** Same two-list structure but Finsweet does the nesting. Less
   custom JS, but adds an external dependency, requires coordinating load order with
   accordion init, and the site's existing Finsweet (`fs-list`) integration is already
   noted as fragile in project memory. Rejected.
3. **Single flat Items list, `faq.js` builds/de-dupes section headers.** Literally one
   collection list, but Webflow's single-field sort can't cleanly order sections-then-
   items, section-header markup is duplicated on every item, and it is the most brittle.
   Rejected.

## Webflow markup contract

```html
<div data-faq-element="component">

  <!-- SECTIONS: Collection List bound to FAQ Sections, sorted by section order -->
  <div data-faq-element="sections" data-accordion-element="list"
       data-close-previous="True" data-close-on-second-click="True">
    <!-- one per FAQ Section (Webflow .w-dyn-item) -->
    <div data-accordion-element="item">
      <button data-accordion-element="toggle">{{ Section Name }}</button>
      <div data-accordion-element="content">
        <!-- empty drop-zone = the nested question accordion -->
        <div data-faq-element="target" data-faq-section="{{ Section Slug }}"
             data-accordion-element="list"
             data-close-previous="False" data-close-on-second-click="True"></div>
      </div>
    </div>
  </div>

  <!-- ITEMS: Collection List bound to FAQ Items, sorted by item order -->
  <div data-faq-element="source">
    <!-- one per FAQ Item (Webflow .w-dyn-item) -->
    <div data-accordion-element="item" data-faq-section="{{ Item → Section → Slug }}">
      <button data-accordion-element="toggle">{{ Question }}</button>
      <div data-accordion-element="content">{{ Answer }}</div>
    </div>
  </div>

</div>
```

**Join key = Section slug.** Bound on each section's `target` (`{{ Section Slug }}`) and on
each item via the single-reference field (`{{ Item → Section → Slug }}`). Slug is unique
and stable. The marketer must set up the referenced-slug bind on the item — this is the one
slightly non-obvious bind.

Accordion behavior attributes (`data-close-previous`, `data-close-on-second-click`,
`data-open-on-hover`, `data-open-by-default`) are read by `accordion.js` as today and are
not the concern of `faq.js`.

### Data attributes owned by `faq.js`

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-faq-element="component"` | component root | scope boundary; one FAQ instance |
| `data-faq-element="sections"` | Sections collection list | the outer accordion list (also `data-accordion-element="list"`) |
| `data-faq-element="source"` | Items collection list | flat source of item accordions; removed after nesting |
| `data-faq-element="target"` | nested list in each section's content | destination drop-zone (also `data-accordion-element="list"`) |
| `data-faq-section="<slug>"` | `target` and each source item | join key |
| `data-faq-keep-empty="True"` | component root (optional) | keep sections that receive zero items (default: remove them) |

## `faq.js` behavior

`initFaq()` iterates every `[data-faq-element="component"]` (guarded by
`data-script-initialized`, matching the codebase pattern). For each component:

1. Collect source items: `[data-faq-element="source"] [data-faq-section]` scoped to this
   component.
2. For each source item, find the matching
   `[data-faq-element="target"][data-faq-section="<slug>"]` in the same component and
   `appendChild` the item element into it (DOM order preserved → item order respected).
   Move the `data-accordion-element="item"` node itself so it becomes a direct child of the
   target list (keeps `accordion.js`'s `closest(list) === list` scoping correct).
3. Items whose slug matches no target → leave out, `console.warn`.
4. Remove section items whose target received zero children — unless
   `data-faq-keep-empty="True"`.
5. Remove the now-empty `[data-faq-element="source"]` list from the DOM.
6. Call `initAccordion()` (imported from `accordion.js`) to wire both levels.

`faq.js` performs **no animation** — it only restructures the DOM and hands off. It reuses
`utils.js` helpers (e.g. `attrBool`, and `flattenDisplayContents` if `.u-display-contents`
wrappers appear) consistent with `accordion.js` / `collapsible.js`.

### Init order / race safety

`faq.js` auto-boots on `DOMContentLoaded` (same pattern as the other modules), runs its
restructure, then calls `initAccordion()`. The accordion's own auto-boot may run first; it
harmlessly skips the still-empty nested target lists because `accordion.js` already defers
lists with zero items for a later init pass. After `faq.js` nests the items and re-invokes
`initAccordion()`, the now-populated target lists initialize. `initAccordion()` is
idempotent via its own `data-script-initialized` guard, so the double call is safe.

`faq.js` is imported in `src/index.js` **before** `accordion.js` is relied upon; ordering
is not load-bearing because of the idempotent re-init, but importing `faq.js` keeps the
restructure co-located with the rest of the boot sequence.

## Edge cases

- **Section ordering** — from the FAQ Sections list sort (manual order field).
- **Item ordering within a section** — from the FAQ Items list sort. Independent of section
  order; both marketer-controlled.
- **Orphan item** (slug matches no section) — omitted, warned.
- **Empty section** — removed by default; `data-faq-keep-empty="True"` keeps it.
- **Open-by-default** — left to `accordion.js`'s existing `data-open-by-default`; default is
  all closed. (The design reference shows one section + one question open, but that is a
  marketer choice via the attribute, not a `faq.js` default.)
- **Multiple FAQ components on one page** — each scoped independently by its
  `[data-faq-element="component"]` root; slugs only matched within the same component.

## Testing / verification

This is a Webflow + Parcel project with manual verification (no automated DOM test
harness). Verification steps:

1. Build with `pnpm build` and load the FAQ page.
2. Confirm sections render in section-order, each with its questions in item-order.
3. Confirm both accordion levels open/close and the nested height animation grows the
   parent (the `accordion.js` `fill:forwards` commit path).
4. Confirm an empty section is removed (and kept when `data-faq-keep-empty="True"`).
5. Confirm the source list is gone from the DOM and no orphan warnings unless expected.
6. Confirm two FAQ components on one page do not cross-contaminate.

## Out of scope

- Search/filter over FAQ items.
- Deep-linking to a specific open question.
- Any animation logic (owned by `accordion.js`).
