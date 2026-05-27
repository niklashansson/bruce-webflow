# Preview-City (Webflow Designer) — Design

Date: 2026-05-27
Status: Approved (pending implementation)

## Goal

Let editors preview the page as it appears for a specific city while
working in the Webflow Designer — without leaving the Designer, without
deleting `localStorage`, and without changing the URL. CSS-only. No
changes to any JS module.

## Why CSS-only

The Webflow Designer renders pages in an editing iframe that does not
run our custom JS. `city.js` never resolves an active city, so
`body.is-city-ready` is never set, and the existing pre-hide rule (from
the shipped city-visibility feature) hides every
`[data-city-show]:not([data-city-show=""])` element.

CSS can detect Designer state via the `.wf-design-mode` class Webflow
adds to `<html>`, and CSS `:has()` can use the preview attribute to
scope the override. No JS dispatch, no module changes.

## Approach — invert the pre-hide in the Designer

The pre-hide rule's job is to prevent FOUC on real visitor sessions.
That goal is not meaningful in the Designer — there is no visitor and
no JS racing. Pre-hide in the Designer also costs the editor visibility
into city-conditional content while editing.

So the design changes the pre-hide rule to skip the Designer entirely.
In the Designer the default state becomes "everything visible". The
preview attribute then **hides the non-matching cities** when the
editor wants to focus on one city.

This avoids the `display: revert` trap: `revert` falls back to the
user-agent default (`block`), not to the Webflow class's `flex`/`grid`.
By hiding non-matches instead of trying to un-hide matches, matching
elements keep their natural Webflow display — flex containers stay
flex, grids stay grids.

## Editor-facing API

A single attribute on any element inside the Globals Symbol:

```html
<div data-preview-city="cph">…</div>
```

- `data-preview-city="cph"` → in the Designer, hide every
  `[data-city-show]` element whose value does not contain `cph` or
  `Copenhagen` (case-insensitive). Matching elements stay visible.
- `data-preview-city=""` or attribute removed → no preview override.
  Default Designer state: all `[data-city-show]` elements visible.
- Switching cities = change the attribute value to another slug.

Single value only. No comma list. Preview is intentionally one-city-at-a-time.

## CSS contract

### One update to the shipped city-visibility CSS

The pre-hide rule shipped with `city-visibility` needs a single prefix
added so it does not apply inside the Designer:

```css
/* Before — shipped today */
body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
  display: none;
}

/* After — Designer is excluded from pre-hide */
html:not(.wf-design-mode) body:not(.is-city-ready)
  [data-city-show]:not([data-city-show=""]) {
  display: none;
}
```

The `.is-city-hidden { display: none !important }` rule stays exactly
as-is. JS never runs in the Designer, so `is-city-hidden` is never
applied there — the `!important` is harmless in that context and still
required everywhere else.

### New CSS — lives inside the Globals Symbol as an Embed

```html
<style>
  /* Designer preview overrides — see specs/2026-05-27-preview-city-design.md
     One block per previewable city. When data-preview-city matches the slug,
     hide every [data-city-show] except those containing the slug or name. */

  html.wf-design-mode:has([data-preview-city="cph"])
    [data-city-show]:not([data-city-show=""])
    :not([data-city-show*="cph" i])
    :not([data-city-show*="copenhagen" i]) {
    display: none !important;
  }

  html.wf-design-mode:has([data-preview-city="sto"])
    [data-city-show]:not([data-city-show=""])
    :not([data-city-show*="sto" i])
    :not([data-city-show*="stockholm" i]) {
    display: none !important;
  }

  /* …one block per previewable city. */
</style>
```

### Why `!important` on the preview rule

The preview rule competes with the Webflow class display setting
(e.g., `display: flex`). Although the `:has()` selector gives the
preview rule higher specificity than a class selector, the
combination of cascading sources in Webflow's published HTML can be
unpredictable. `!important` is the cheap insurance and matches the
pattern of `.is-city-hidden`.

### Effect summary

| Context | `wf-design-mode` | preview-city set | Behavior |
|---|---|---|---|
| Production (real visitors) | absent | n/a | Pre-hide applies until JS sets `is-city-ready`; JS then tags non-matches with `.is-city-hidden`. Unchanged from city-visibility. |
| Staging on `*.webflow.io` | absent | n/a | Same as production. Editors and clients can use `?city=` to choose. |
| Webflow Designer, no preview | present | no | Modified pre-hide does not apply. All `[data-city-show]` elements visible by default. Editors can see and edit any city-conditional content. |
| Webflow Designer, previewing `cph` | present | `cph` | Modified pre-hide still does not apply. Preview rule hides every `[data-city-show]` that does not contain `cph`/`copenhagen`. Matching elements visible at their natural Webflow display. |

## Setup — where the CSS lives

Two locations:

1. **Site-wide custom code (Project Settings → Custom Code → Head Code).**
   Update the existing city-visibility pre-hide rule to add the
   `html:not(.wf-design-mode)` prefix shown above. One-line change.
   Keep `.is-city-hidden { display: none !important }` unchanged.

2. **Inside the Globals Symbol, as a Webflow Embed.** All preview
   rules live here so they travel with the cities CMS list. Adding a
   new city = adding one block to this Embed.

Splitting between site-wide and Symbol-local is deliberate:

- The pre-hide rule is global infrastructure for the city-visibility
  feature and belongs in site-wide custom code where city-visibility
  already lives.
- Preview rules are conceptually tied to the cities list, which is
  inside the Symbol. The list of previewable slugs/names lives next
  to the list of cities.

## Editor workflow

1. Open the Globals Symbol master in the Webflow Designer.
2. Find the wrapper element holding `data-preview-city`. Set its value
   to the slug of the city to preview (e.g., `cph`, `sto`, `osl`).
3. The Designer view immediately hides every `[data-city-show]` that
   does not match. Other elements (no `data-city-show`, or
   `data-city-show=""`) are unaffected.
4. To switch cities, change the value.
5. To turn off preview, clear the value (or delete the attribute).
6. Saving the Symbol persists the attribute. Because the preview rule
   is gated by `.wf-design-mode`, this is harmless on every published
   surface.

## Adding a new city

When the editor adds a new city to the CMS list:

1. Note the slug and the name (e.g., slug `mlm`, name `Malmö`).
2. Open the Globals Symbol's preview Embed.
3. Add a new block following the existing pattern:
   ```css
   html.wf-design-mode:has([data-preview-city="mlm"])
     [data-city-show]:not([data-city-show=""])
     :not([data-city-show*="mlm" i])
     :not([data-city-show*="malmö" i]) {
     display: none !important;
   }
   ```
4. Save and publish staging.

If this becomes onerous (10+ cities) the rules can be code-generated
from the CMS list, but YAGNI for the project's current ~3-5 cities.

## Limitations

1. **Designer-only.** Preview does not work on `*.webflow.io` staging
   or the custom-domain production site. Those surfaces run the full
   JS lifecycle; editors and clients there should use the existing
   `?city=` URL parameter for ad-hoc city selection.
2. **No text substitution.** `{{city-name}}`, `{{phone}}`, and other
   variables.js placeholders do not update in preview because the
   Designer does not run our JS. This is a Designer reality, not a
   limitation specific to this feature.
3. **No switcher styling preview.** `data-set-city` active-state
   styling (`data-city-active="true"`) requires JS to set. Preview
   does not simulate it.
4. **Substring matching.** The CSS uses `*=` substring matching. If
   two city slugs are substrings of each other (e.g., `cph` and
   `cph2`), preview rules will collide. Use distinct, non-overlapping
   slugs (the project's current slugs — `cph`, `sto`, `osl` — are safe).
5. **One previewable city at a time.** No multi-city preview. Set the
   attribute to a single slug.
6. **Default Designer view changes.** Today, all `[data-city-show]`
   elements are hidden in the Designer because the shipped pre-hide
   applies there. With this feature, the pre-hide is disabled in the
   Designer and all city-conditional content is visible by default.
   This is an intentional UX improvement (editors can see and edit
   any city-conditional element), but it is a behavior change from
   the just-shipped city-visibility feature.

## Browser support

`:has()` is supported in Chrome 105+, Firefox 121+, and Safari 15.4+
(all releases from 2023 or earlier). Webflow's Designer runs in a
modern Chromium build, so `:has()` is available. The preview rules
only need to work in the Designer, so out-of-Designer support is not
a concern.

## Out of scope (YAGNI)

- Production preview (covered by `?city=` URL parameter).
- `*.webflow.io` staging preview (also covered by `?city=`).
- Multi-city preview.
- Auto-generated CSS rules from the CMS list.
- A floating "Previewing: Copenhagen" badge in the Designer.
- A JS fallback for browsers without `:has()` support.
- Previewing text placeholders, switcher states, or any non-visibility
  city-driven behavior.

## Testing

No unit tests — CSS-only, no JS to test.

Manual verification protocol:

1. Update the site-wide pre-hide rule in Webflow custom code with the
   `html:not(.wf-design-mode)` prefix.
2. Inside the Globals Symbol, add the Embed with preview rules for
   `cph` and `sto` (or whichever cities exist).
3. Open the Webflow Designer for the project on a page containing
   `[data-city-show]` elements (e.g., the studios page).
4. With no `data-preview-city` set, confirm all `[data-city-show]`
   elements are visible in the Designer canvas — this is the new
   default Designer behavior.
5. Set `data-preview-city="cph"` on the Globals wrapper. Confirm only
   elements whose `data-city-show` contains `cph` or `Copenhagen` are
   visible. Others are hidden.
6. Verify matching elements keep their Webflow flex/grid layout
   (the design intent of using "hide non-matches" rather than
   "un-hide matches").
7. Change to `data-preview-city="sto"`. Confirm Stockholm-marked
   elements appear and Copenhagen-only ones disappear.
8. Clear the attribute. Confirm all `[data-city-show]` elements are
   visible again.
9. Publish to `*.webflow.io` staging. Open staging in a regular
   browser. Confirm:
   - The new pre-hide rule still works (FOUC is prevented; only
     active-city elements appear after JS resolves).
   - The preview attribute has no effect on staging (it's a no-op
     outside the Designer).
10. Open Webflow's Preview button (top-right of Designer). This
    renders the page in the Designer but with interactions enabled.
    Behavior here depends on whether `wf-design-mode` persists into
    Preview view; document the observed behavior as part of step 10
    (likely: preview attribute does NOT take effect in Preview view
    because `wf-design-mode` is removed in Preview, which is the
    correct behavior — the JS runs in Preview and the existing
    city-visibility flow handles things).
