# Announcement Banner — Design

**Date:** 2026-05-12
**Component:** `src/announcements.js`
**CMS Collection:** Announcements

## Background

Marketers need to publish nav-bar announcements without engineering involvement. A new Webflow CMS collection `Announcements` holds individual announcement items (Message, Link URL, Dismissible toggle, Start Date, End Date). The existing static `.nav_banner` element with a single hard-coded message and session-scoped dismissal is being replaced.

## Scope

- **In scope:** Per-announcement session-scoped dismissal in JS, FOUC prevention for dismissed items, empty-state collapse.
- **Out of scope:** Date filtering, sorting, ordering. Webflow handles all of that natively on the Collection List.

## Behavior

- Every active announcement Webflow renders is displayed (stacked) unless the visitor has dismissed that specific announcement in the current session.
- A close button appears only on announcements where the Dismissible toggle is on (Webflow-side conditional visibility).
- Clicking close hides that single announcement for the session, keyed by slug. Sibling announcements remain visible.
- When all rendered announcements are dismissed (or none were rendered), the `.nav_banner` container collapses via an `is-empty` class.
- Dismissals persist for the session only (`sessionStorage`). A new session shows everything Webflow renders again.

## Webflow contract

The Webflow Collection List binding `.nav_banner` must emit, for each item:

- `data-announcement-slug="{slug}"` on the item root — required, this is the dismissal key.
- A close button with class `nav_banner_close_wrap` inside the item, shown only when the Dismissible field is on (Webflow conditional visibility on the field). JS doesn't read the Dismissible value directly; the presence or absence of the close button is the signal.

The wrapper `.nav_banner` itself stays as today.

Webflow auto-generates slugs as URL-safe (alphanumeric + hyphens), so they're safe to use unescaped in CSS attribute selectors. The pre-DOM hide block still applies defensive escaping in case a slug is ever hand-edited.

## JS architecture

A new sibling module `src/announcements.js` owns the feature. `nav.js` keeps only the skip-link and scroll-state concerns (the legacy single-banner dismissal is removed). `src/index.js` registers `announcements.js` so it auto-boots on every page.

The new module has three pieces:

1. **Pre-DOM dismissal hide** (FOUC prevention) — sync at script load.
2. **Announcement init** (`initAnnouncements`) — wires close buttons, evaluates empty state. Auto-boots on DOMContentLoaded.
3. **Storage helpers** — `readDismissedSlugs` / `writeDismissedSlugs`.

### Storage

- Key: `dismissed-announcements`
- Value: JSON array of dismissed slug strings, e.g. `["spring-sale", "maintenance-window"]`
- Scope: `sessionStorage`

Two helpers wrap read/write:

- `readDismissedSlugs(): Set<string>` — parses JSON, returns empty set on any error (missing key, corrupt value, storage blocked).
- `writeDismissedSlugs(set: Set<string>): void` — serializes and stores; swallows storage errors.

The legacy `hide-nav-banner` key is removed.

### Pre-DOM hide (FOUC prevention)

Runs synchronously on script load, before any banner items paint:

1. Read dismissed slugs from `sessionStorage`.
2. If non-empty, inject a `<style>` element into `<head>` with one rule per slug:
   ```css
   [data-announcement-slug="spring-sale"] { display: none !important; }
   [data-announcement-slug="maintenance-window"] { display: none !important; }
   ```
3. Slug values are escaped for CSS attribute-selector safety (`"` and `\` are escaped).

This works regardless of script position because the rules match elements that haven't parsed yet. `!important` is used to win against Webflow's default styles without requiring CSS specificity coordination.

### `initAnnouncements()`

On DOMContentLoaded:

1. Locate `.nav_banner`. If absent, no-op.
2. Find every `.nav_banner_close_wrap` inside `.nav_banner` and, for each:
   - Find the closest `[data-announcement-slug]` ancestor (the item root). If absent, skip.
   - Skip if already initialized (`dataset.scriptInitialized`).
   - On click:
     - Add the slug to the dismissed-slug set; persist to `sessionStorage`.
     - Hide the item (`display: none` on the item root).
     - Re-evaluate empty state.
3. Evaluate empty state once at the end.

Function is idempotent — second-call wires only newly-added close buttons.

### Empty-state detection

```
isEmpty = banner.querySelectorAll('[data-announcement-slug]') has zero
          visible (display !== 'none') items
```

When empty, add `is-empty` class to `.nav_banner`. When transitioning back to non-empty (not expected in a single session, but cheap to handle), remove the class. CSS in the Webflow project hides or collapses the banner when `.nav_banner.is-empty`.

## Edge cases

- **Storage blocked** (private mode, sandboxed iframe): both helpers swallow exceptions. Dismissals don't persist across page loads but still apply for the current view (item is removed from DOM immediately on close).
- **Corrupt sessionStorage value**: parse failure resets the dismissed set to empty. Worst case: banners reappear once.
- **Non-dismissible item with no close button**: nothing to wire up; the item displays normally.
- **Marketer toggles Dismissible off after a user dismissed it**: the slug stays in sessionStorage and the pre-DOM hide still hides the item that session. Acceptable — the dismissal preference is honored.
- **Webflow's empty-list placeholder** (`.w-dyn-empty`): not a `[data-announcement-slug]`, so empty-state detection ignores it. Webflow project CSS can hide `.w-dyn-empty` inside `.nav_banner` if desired.
- **Item without `data-announcement-slug`**: skipped by close-button wiring (no key to store under). Doesn't break other items.

## File changes

- `src/announcements.js` (new):
  - Storage helpers `readDismissedSlugs()` / `writeDismissedSlugs()`.
  - Pre-DOM IIFE that injects per-slug `display: none !important` CSS.
  - `initAnnouncements()` exported and auto-booted on DOMContentLoaded.
- `src/nav.js`:
  - Remove legacy `BANNER_STORAGE_KEY` / `BANNER_HIDE_CLASS` constants, the pre-DOM block, and `initBannerClose()`.
  - `initNav()` calls only `initSkipLink()` and `initScrollState()`.
  - Doc comment trimmed accordingly.
- `src/index.js`:
  - Add `import "./announcements.js"` next to `nav.js`.

## Success criteria

- A dismissible announcement closes when its close button is clicked, persists across page navigation within the session, and reappears in a fresh session.
- A non-dismissible announcement has no close button and is never dismissed.
- Dismissing every active announcement leaves `.nav_banner.is-empty` so the project's CSS can collapse the area.
- No banner flicker on subsequent page loads — dismissed items are hidden before paint.
