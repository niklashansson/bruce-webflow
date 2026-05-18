# Collapsible — Design

**Date:** 2026-05-13
**Component:** `src/collapsible.js`

## Background

The project already has an `accordion.js` module for grouped expand/collapse cards (sibling cards inside an `.accordion_list`, with `close-previous` and `open-by-default` group behavior). The site also needs a simpler primitive for one-off expandable regions — e.g. an FAQ row that isn't part of a group, an inline "show more" panel, a hover-revealed disclosure — where each wrap is fully independent and doesn't coordinate with siblings.

A separate module keeps the accordion's grouping logic from leaking into the simpler primitive, and lets the two evolve independently.

## Scope

- **In scope:** Single trigger + single content per `.collapsible_wrap`. Click to toggle, optional hover to open, optional open-by-default, optional per-wrap duration override. GSAP height animation. Nesting (a wrap inside another wrap's content). Auto-generated ARIA wiring.
- **Out of scope:** Sibling grouping / "only one open" behavior (use `accordion.js`). URL/hash-driven open. Hover-close on `mouseleave`. Global registry on `window.lumos`. Close-on-outside-click.

## Webflow contract

```html
<div class="collapsible_wrap"
     data-open-by-default="True"
     data-open-on-hover="True"
     data-duration="0.4">
  <button class="collapsible_trigger">…</button>
  <div class="collapsible_content">…</div>
</div>
```

Required descendants of each `.collapsible_wrap`:

- One `.collapsible_trigger` — should be a `<button>` so click and keyboard activation come for free.
- One `.collapsible_content` — the region whose height is animated.

Each wrap owns the *first* `.collapsible_trigger` and `.collapsible_content` it finds that aren't inside a nested `.collapsible_wrap`. This lets a wrap live inside another wrap's content without the outer wrap accidentally binding the inner trigger.

### Data attributes (all optional, all on `.collapsible_wrap`)

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `data-open-by-default` | `"True"` | unset → closed | Wrap is rendered open on init (no animation; timeline jumped to end via `tl.progress(1)`). |
| `data-open-on-hover` | `"True"` | unset → click-only | `mouseenter` on the trigger also opens. Does **not** close on `mouseleave` — closing still requires clicking the trigger. |
| `data-duration` | positive number (seconds) | `0.3` | Overrides the GSAP timeline duration. Missing, non-numeric, or `≤ 0` → default. |
| `data-collapsible-id` | string (key) | unset → no mirroring | Identifier used to broadcast `is-active` onto external mirror elements (see *State mirroring*). |

`"True"` / `"False"` string semantics match accordion's conventions (Webflow renders these as strings from a toggle control).

### State mirroring

One-way: when a wrap's `data-collapsible-id` is set, the wrap's `is-active` class is mirrored onto every element matching `[data-component="collapsible"][data-collapsible-id="<key>"]` anywhere on the page. The mirror elements are passive — they only reflect state, they don't initialize and they don't act as triggers. Clicking a mirror does nothing.

The mirror set is resolved on each `open`/`close` (not cached on init) so mirrors injected later — CMS-rendered cards, modals, lazy-loaded sections — pick up state changes without re-initializing. The selector escapes the key with `CSS.escape()` so non-URL-safe IDs don't break the selector.

Multiple wraps sharing the same `data-collapsible-id` are allowed; the mirror reflects whichever wrap last changed state. This is intentional flexibility, not a coordination guarantee — callers who need stricter semantics should use unique keys.

## JS architecture

`src/collapsible.js` owns the feature. `src/index.js` adds `import "./collapsible.js";` so it auto-boots on every page.

The module has two pieces:

1. **`initCollapsible()`** — exported. Selects every `.collapsible_wrap`, skips already-initialized ones, wires each.
2. **Auto-boot** — standard pattern from `nav.js` / `accordion.js`: runs `initCollapsible` on `DOMContentLoaded` or immediately if the document is already past loading.

### `initCollapsible()`

For each `.collapsible_wrap`:

1. Skip if `dataset.scriptInitialized` is set; otherwise mark it.
2. Resolve own trigger + own content (skipping descendants of nested `.collapsible_wrap`):
   ```js
   const own = (sel) => [...wrap.querySelectorAll(sel)]
     .find((el) => el.closest(".collapsible_wrap") === wrap);
   const trigger = own(".collapsible_trigger");
   const content = own(".collapsible_content");
   ```
   If either is missing, `console.warn` and skip (matches accordion's behavior).
3. Read attributes:
   - `openByDefault = wrap.getAttribute("data-open-by-default") === "True"`
   - `openOnHover = wrap.getAttribute("data-open-on-hover") === "True"`
   - `duration` — parse `data-duration` with `Number()`; if not a finite positive number, use `DEFAULT_DURATION`.
4. Set initial ARIA + ids using a per-wrap index (same scheme as accordion):
   - `trigger.id = "collapsible_trigger_<wrapIndex>"`
   - `content.id = "collapsible_content_<wrapIndex>"`
   - `trigger.aria-controls = content.id`
   - `content.aria-labelledby = trigger.id`
   - `trigger.aria-expanded = "false"`
   - `content.style.display = "none"` (timeline flips this on open)
5. Build the GSAP timeline:
   ```js
   const refresh = () => {
     tl.invalidate();
     if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
   };
   const tl = gsap.timeline({
     paused: true,
     defaults: { duration, ease: "power1.inOut" },
     onComplete: refresh,
     onReverseComplete: refresh,
   });
   tl.set(content, { display: "block" });
   tl.fromTo(content, { height: 0 }, { height: "auto" });
   ```
6. Define handlers:
   - `open(instant = false)` — adds `.is-active` on the wrap, sets `aria-expanded="true"`, plays the timeline (or jumps to end via `tl.progress(1)` if `instant`).
   - `close()` — no-op if not active; otherwise removes `.is-active`, sets `aria-expanded="false"`, reverses the timeline.
   - `toggle()` — `close()` if `.is-active`, else `open()`.
7. If `openByDefault`, call `open(true)`.
8. Bind events:
   - `trigger.addEventListener("click", toggle)`
   - If `openOnHover`, `trigger.addEventListener("mouseenter", () => open())` — note: only opens, never closes.

### Conventions

- File-level JSDoc header documenting markup, attributes, integrations, and dependency notes (same shape as `accordion.js`).
- Module-level constants where useful (`DEFAULT_DURATION = 0.3`).
- `dataset.scriptInitialized` guard for idempotent init.
- Exported `initCollapsible` plus standard `DOMContentLoaded` auto-boot.

## Dependencies

- **GSAP** — hard dependency. The height tween *is* the feature; without GSAP there is no graceful fallback (matches accordion's stance).
- **ScrollTrigger** — optional. If present on the page, `ScrollTrigger.refresh()` runs after each animation completes so pinned/triggered sections re-measure.

## Edge cases

- **Missing trigger or content** — `console.warn` and skip that wrap (don't throw, don't half-initialize).
- **Nested wraps** — outer wrap's `own()` resolver skips descendants of nested `.collapsible_wrap`, so each wrap binds only its direct trigger/content. A nested wrap inside an `open-by-default` outer wrap initializes normally; if the outer is initially closed, the nested wrap still wires up — its content is just inside a `display: none` parent until the outer opens.
- **Invalid `data-duration`** (e.g. `"fast"`, empty, `"0"`, `"-1"`) — falls back to default `0.3` rather than producing `NaN` or a degenerate timeline.
- **Re-init** — calling `initCollapsible()` again is a no-op for already-wired wraps; only newly-added wraps get wired. Matches the pattern across the codebase.
- **GSAP not loaded** — timeline construction throws on the first wrap. Same failure mode as accordion. Documented in the JSDoc header.
- **Trigger that isn't a `<button>`** — still works (click and `mouseenter` both fire on non-buttons), but loses keyboard activation. Markup contract recommends `<button>`.

## File changes

- `src/collapsible.js` (new):
  - JSDoc header.
  - `DEFAULT_DURATION` constant.
  - Exported `initCollapsible()`.
  - Standard auto-boot block.
- `src/index.js`:
  - Add `import "./collapsible.js";` alongside the other component imports.

## Success criteria

- A `.collapsible_wrap` with no data attributes starts closed and toggles open/closed on click, with a smooth height animation.
- `data-open-by-default="True"` renders open on load with no animation.
- `data-open-on-hover="True"` opens on `mouseenter`; clicking the trigger while open still closes it.
- `data-duration="0.6"` produces a noticeably slower animation than the default.
- A nested `.collapsible_wrap` inside an outer wrap's `.collapsible_content` is operable independently and does not toggle when the outer trigger is clicked.
- `aria-expanded` reflects state on every open/close transition.
- `ScrollTrigger.refresh()` fires after each transition when ScrollTrigger is loaded; absent ScrollTrigger, no errors.
