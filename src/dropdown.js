/**
 * Dropdown Component
 *
 * Single togglable dropdown region with an animated open/close, click-outside
 * dismissal, Escape key support, and ArrowUp/ArrowDown navigation through
 * focusable items inside the content panel.
 *
 * Per-wrap data attributes (all optional, all on the wrap):
 *   - data-open-on-hover-in="true"     mouseenter on the wrap opens it
 *   - data-close-on-hover-out="true"   mouseleave on the wrap closes it
 *
 * Webflow markup (style with whatever classes you want):
 *   <div data-dropdown-element="wrap"
 *        data-open-on-hover-in="true"
 *        data-close-on-hover-out="true">
 *     <button data-dropdown-element="toggle">…</button>
 *     <div data-dropdown-element="content">
 *       <a href="…">Item 1</a>
 *       <a href="…">Item 2</a>
 *     </div>
 *   </div>
 *
 * Nested dropdowns work — each wrap resolves only its own direct toggle and
 * content, so nested toggles don't toggle the outer wrap.
 */

import { attrBool } from "./utils.js";
import { place } from "./dropdown-place.js";

const A = {
  wrap: '[data-dropdown-element="wrap"]',
  toggle: '[data-dropdown-element="toggle"]',
  content: '[data-dropdown-element="content"]',
};

const DURATION_MS = 200;
const EASING = "ease-out";
const FOCUSABLE_ITEM_SELECTOR = "a, button";

// Visual entry state — alongside the height tween, content fades in, slides
// up from `TRANSLATE_CLOSED` below its resting position, and scales from
// `SCALE_CLOSED`. transform-origin is set to "top" at init so the scale
// anchors under the toggle rather than at the box's center.
const SCALE_CLOSED = 0.97;
const TRANSLATE_CLOSED_PX = 8;
const CLOSED_OPACITY = "0";
const CLOSED_TRANSFORM = `translateY(${TRANSLATE_CLOSED_PX}px) scale(${SCALE_CLOSED})`;
const OPEN_OPACITY = "1";
const OPEN_TRANSFORM = "translateY(0px) scale(1)";

// ── Top-layer portal ─────────────────────────────────────────
// Panels open inside clipping ancestors — most painfully the mobile bottom
// sheet, whose shadow-DOM header is a scroll box (overflow-x: scroll forces
// overflow-y to auto) and whose chip row is another one. The top layer ignores
// every ancestor's overflow, clip, transform and z-index, so showPopover()
// sidesteps all of them at once. It also means ancestor transforms don't apply
// to the panel, which is why a plain getBoundingClientRect() on the toggle is
// the correct anchor even mid-sheet-animation.
const CAN_PORTAL = "showPopover" in HTMLElement.prototype;

const GAP_PX = 8; // toggle → panel
const INSET_PX = 8; // panel → viewport edge

// showPopover() brings UA styles with it (inset: 0, margin: auto, a border,
// padding, fit-content sizing) via the UA stylesheet's [popover] rule, which
// applies the moment popover="manual" is set — not gated on :popover-open,
// so it's live during measurement too. It lives here rather than in a
// Webflow embed because it's a functional requirement of this script, not a
// design token — the two must not drift apart.
//
// Two rules, two jobs:
//   - The neutralising rule undoes the UA sheet. Author origin already beats
//     the UA origin, so no specificity is needed — wrapping the selector in
//     :where() keeps it at (0,0,0) so the site's own Webflow classes still
//     win. This is what lets the docstring's "style with whatever classes
//     you want" promise hold: the panel's authored background, padding,
//     border and overflow survive being portalled.
//   - The structural rule only applies while the popover is actually open,
//     and only sets what genuinely must differ from the UA default:
//     position: fixed (Webflow authors these panels as position: absolute)
//     and display: block (parity with the pre-portal code, which always
//     forced display: block on open — otherwise an authored display: none
//     panel would open invisibly, since :popover-open matching doesn't
//     imply visible).
let popoverStylesInjected = false;
function ensurePopoverStyles() {
  if (popoverStylesInjected || !CAN_PORTAL) return;
  popoverStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    :where([data-dropdown-element="content"][popover]) {
      position: static;
      inset: auto;
      width: auto;
      height: auto;
      margin: 0;
      border: 0;
      padding: 0;
      overflow: visible;
      background: transparent;
      color: inherit;
    }

    [data-dropdown-element="content"]:popover-open {
      position: fixed;
      inset: auto;
      margin: 0;
      width: auto;
      height: auto;
      display: block;
    }
  `;
  document.head.appendChild(style);
}

// The visible band in client coordinates. visualViewport is the honest source
// on mobile: the filter bar contains a search input, so the soft keyboard can
// be open while a panel is up, and innerHeight does not shrink for it.
function viewportBox() {
  const vv = window.visualViewport;
  if (vv)
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

// Dynamic stacking — each open bumps the wrap above any already-animating
// peers so the newly-opening dropdown always sits on top of the one still
// closing underneath it. Counter resets to 0 when every dropdown is closed.
const Z_BASE = 1000;
let zCounter = 0;

/**
 * @typedef {{
 *   wrap: HTMLElement,
 *   toggle: HTMLElement,
 *   content: HTMLElement,
 *   close: () => void,
 *   reposition: () => number | undefined,
 *   focusableItems: HTMLElement[],
 * }} ActiveDropdown
 */

// Only one dropdown can be open at a time, so a single reference is enough —
// no need to scan a registry on every page click and keystroke.
/** @type {ActiveDropdown | null} */
let activeDropdown = null;

// ── Shared document listeners (attached once) ────────────────
let documentListenersAttached = false;
function attachDocumentListeners() {
  if (documentListenersAttached) return;
  documentListenersAttached = true;

  document.addEventListener("click", (e) => {
    if (!activeDropdown) return;
    const target = /** @type {Element | null} */ (e.target);
    if (target && !activeDropdown.wrap.contains(target)) activeDropdown.close();
  });

  document.addEventListener("keydown", (e) => {
    if (!activeDropdown) return;
    if (e.key === "Escape") {
      const { toggle, close } = activeDropdown;
      close();
      toggle.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const focused = /** @type {Element | null} */ (document.activeElement);
    if (!focused || !activeDropdown.wrap.contains(focused)) return;
    const items = activeDropdown.focusableItems;
    if (!items.length) return;
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    const currentIndex = items.indexOf(/** @type {HTMLElement} */ (focused));
    const nextIndex =
      currentIndex === -1
        ? step === 1
          ? 0
          : items.length - 1
        : (currentIndex + step + items.length) % items.length;
    items[nextIndex].focus();
  });
}

// ── Anchor tracking ──────────────────────────────────────────
// One rAF-throttled reposition shared by every source that can move an open
// panel. Attached on open, detached on close.
let trackingFrame = 0;

function onAnchorMove(event) {
  // Scrolling INSIDE an open panel must not re-run positioning — on a clamped
  // list that would fight the user's own scroll.
  const target = event?.target;
  if (
    target instanceof Node &&
    activeDropdown &&
    activeDropdown.content.contains(target)
  )
    return;
  if (trackingFrame) return;
  trackingFrame = requestAnimationFrame(() => {
    trackingFrame = 0;
    activeDropdown?.reposition();
  });
}

/** @type {ResizeObserver | null} */
let panelObserver = null;

function startTracking() {
  if (!CAN_PORTAL) return;
  // Capture phase: scroll events don't bubble, but they do traverse capture, so
  // this single listener sees every ancestor scroller — including the bottom
  // sheet's host, whose snap animation IS a scroll. That's why dropdown.js
  // never has to know that <bottom-sheet> exists.
  window.addEventListener("scroll", onAnchorMove, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", onAnchorMove);
  window.visualViewport?.addEventListener("resize", onAnchorMove);
  window.visualViewport?.addEventListener("scroll", onAnchorMove);
}

function stopTracking() {
  window.removeEventListener("scroll", onAnchorMove, { capture: true });
  window.removeEventListener("resize", onAnchorMove);
  window.visualViewport?.removeEventListener("resize", onAnchorMove);
  window.visualViewport?.removeEventListener("scroll", onAnchorMove);
  panelObserver?.disconnect();
  panelObserver = null;
  if (trackingFrame) {
    cancelAnimationFrame(trackingFrame);
    trackingFrame = 0;
  }
}

// Watches a settled panel for content-driven size changes — Finsweet shows and
// hides facet options live (fs-list-emptyfacet="hide"), so the natural height
// can move while the panel is open and the clamp has to follow.
//
// Observes the panel's ELEMENT CHILDREN, not the panel itself. The panel's
// own border box is capped by the inline `max-height` reposition() writes, so
// once it's clamped, growth past the clamp changes nothing about that box —
// the observer would never fire for exactly the case it exists to catch.
// Children aren't capped by their parent's max-height, so their boxes keep
// reporting real size changes whether the panel is clamped or not. Falls back
// to observing `entry.content` itself only when there are no element children
// (a text-only panel), so there's still some coverage.
//
// Whichever child fired, reposition() (invoked via onAnchorMove) re-measures
// the panel's natural height itself (content.scrollHeight), so it doesn't
// matter which descendant changed — the fix is at the read, not the watch.
//
// Only attached after the open tween finishes; during the tween the height is
// animating and every frame would fire.
function observePanel(entry) {
  if (!CAN_PORTAL || panelObserver) return;
  panelObserver = new ResizeObserver(() => onAnchorMove());
  const children = entry.content.children;
  if (children.length) {
    for (const child of children) panelObserver.observe(child);
  } else {
    panelObserver.observe(entry.content);
  }
}

const allClosed = () => activeDropdown === null;

// ── Init ─────────────────────────────────────────────────────

/** Initialize all dropdown wraps. Safe to call multiple times. */
export function initDropdown() {
  attachDocumentListeners();
  ensurePopoverStyles();

  document.querySelectorAll(A.wrap).forEach((wrapEl, wrapIndex) => {
    const wrap = /** @type {HTMLElement} */ (wrapEl);
    if (wrap.dataset.scriptInitialized) return;
    wrap.dataset.scriptInitialized = "true";

    // Resolve the toggle/content that belong to THIS wrap — skip any
    // descendants that live inside a nested wrap.
    const own = (selector) =>
      [...wrap.querySelectorAll(selector)].find(
        (el) => el.closest(A.wrap) === wrap,
      );

    const toggle = /** @type {HTMLElement | undefined} */ (own(A.toggle));
    const content = /** @type {HTMLElement | undefined} */ (own(A.content));

    if (!toggle || !content) {
      console.warn("Missing elements:", wrap);
      return;
    }

    const openOnHoverIn = attrBool(wrap, "data-open-on-hover-in");
    const closeOnHoverOut = attrBool(wrap, "data-close-on-hover-out");

    toggle.id = `dropdown_toggle_${wrapIndex}`;
    content.id = `dropdown_content_${wrapIndex}`;
    toggle.setAttribute("aria-controls", content.id);
    toggle.setAttribute("aria-expanded", "false");
    content.setAttribute("aria-labelledby", toggle.id);
    if (CAN_PORTAL) {
      // "manual", not "auto": the outside-click and Escape handlers below stay
      // authoritative, and light-dismiss can't race them. The panel stays a DOM
      // descendant of its wrap, so wrap.contains(target) keeps working — the
      // top layer changes where it paints, not where it lives.
      content.setAttribute("popover", "manual");
      // No inline display:none — that would beat the UA's
      // [popover]:not(:popover-open) rule and showPopover() could never
      // reveal it.
    } else {
      content.style.display = "none";
    }
    content.style.transformOrigin = "top";

    /** @type {Animation | null} */
    let currentAnimation = null;

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    // The panel's unconstrained size. Width is measured once per open, while
    // the panel is still in normal flow, and then pinned inline — it never
    // changes after that (see portalOpen()). Height is measured once at open
    // too, but reposition() below refreshes it on every later call: content
    // can change height while the panel stays open (Finsweet toggling
    // fs-list-emptyfacet="hide" is the motivating case), and the clamp has to
    // track that, not just the size at open time.
    let naturalSize = { width: 0, height: 0 };
    // Whether the last placement had to clamp. Decides the resting overflow.
    let clamped = false;
    // Whether THIS open has EVER clamped. Reset to false at the top of each
    // open(); once flipped true, it never reverts until the panel closes.
    //
    // Why this exists: re-measuring `naturalSize.height` from `scrollHeight`
    // on every reposition() (above) is correct and necessary, but it opens a
    // feedback path on platforms with space-consuming ("classic") scrollbars
    // for any panel containing a WIDTH-driven child (an `aspect-ratio` box,
    // an `<img width="100%">`, a video embed): clamp -> `overflow: auto`
    // shows a scrollbar -> child's available width shrinks by the scrollbar's
    // width -> child gets shorter -> new scrollHeight now fits under
    // max-height -> unclamp -> scrollbar goes away -> child widens -> child
    // gets taller again -> clamps again -> forever, once per animation frame,
    // with no browser-visible "ResizeObserver loop" warning (the callback
    // defers to rAF, so Chrome never attributes it to the observer).
    //
    // The fix is to stop the scrollbar itself from ever coming and going
    // once it's appeared once: after the first clamp this open, the resting
    // overflow forces `scroll` instead of `auto` (see restingOverflow()
    // below) even while unclamped, so the gutter — and therefore
    // content.clientWidth, and therefore the width-driven child's height —
    // stays constant for the rest of the open. That converges by
    // construction (the feedback path is severed) rather than by tuning a
    // numeric hysteresis margin. The trade is a reserved-but-unused
    // scrollbar track if the panel later shrinks back below the clamp —
    // a visible but minor cost, and worth it for a fix that can't
    // re-oscillate under some other geometry.
    let gutterReserved = false;

    // Single formula for the resting (non-tween) `overflow` value. Called
    // from both reposition() (every post-settle recompute) and open()'s
    // tween-completion callback (the very first write, before any
    // post-settle reposition() has run) so the two call sites can't drift
    // apart into different rules.
    const restingOverflow = () =>
      clamped ? "auto" : gutterReserved ? "scroll" : "";

    // Writes geometry ONLY — never `height`. A reposition landing mid-tween
    // therefore can't fight the animation: the tween finishes to its original
    // target and max-height clamps the result if the space shrank underneath.
    const reposition = () => {
      if (!CAN_PORTAL || !isOpen()) return;
      // Re-measure the natural height from scrollHeight before placing.
      // scrollHeight reports the full content height even while the panel is
      // currently clamped and scrolling (unlike offsetHeight, which would
      // read the capped box back) — so this is the correct way to notice
      // content that grew or shrank since the last call, without re-running
      // the expensive display:block/height:auto remeasure portalOpen() does.
      // Guarded on `!currentAnimation`: mid-tween, `content`'s height is the
      // animation's own transient value, not the settled natural size, so
      // reading it here would feed a wrong number into place(). Width is
      // deliberately left untouched — it's pinned inline on purpose (see
      // naturalSize's declaration above) and never changes after open.
      if (!currentAnimation) naturalSize.height = content.scrollHeight;
      const { placement, top, left, maxHeight } = place({
        anchor: toggle.getBoundingClientRect(),
        panel: naturalSize,
        viewport: viewportBox(),
        gap: GAP_PX,
        inset: INSET_PX,
      });
      content.style.top = `${top}px`;
      content.style.left = `${left}px`;
      content.style.maxHeight = `${maxHeight}px`;
      // Anchor the scale/slide at the toggle, whichever side we landed on.
      content.style.transformOrigin = placement === "bottom" ? "top" : "bottom";
      wrap.setAttribute("data-dropdown-placement", placement);
      content.setAttribute("data-dropdown-placement", placement);
      clamped = maxHeight < naturalSize.height;
      if (clamped) gutterReserved = true;
      // Keep the RESTING overflow in sync with `clamped` (and, once latched,
      // `gutterReserved`) even after the panel has settled open. reposition()
      // is the only place either can change post-settle (the tracking loop
      // calls it on scroll/resize/sheet-drag, and the ResizeObserver calls it
      // on content-driven height changes), so it's the single correct place
      // to react to that change too — anywhere else would mean re-deriving
      // "did clamped change" from scratch.
      // Guarded on `!currentAnimation` so this never fights animateTo's own
      // `overflow: hidden`, which owns the property for the ~200ms tween; the
      // tween's onDone callback sets the resting value once currentAnimation
      // is already null, so there's no gap where both would try to write it.
      if (!currentAnimation) content.style.overflow = restingOverflow();
      return maxHeight;
    };

    // Measures in normal flow, hands the panel to the top layer, positions it.
    // Returns the height the open tween should animate to.
    //
    // The measure-first order matters: Webflow may author the panel's width as
    // a percentage of .explorer_filter_dropdown, and once the panel is fixed
    // that percentage would resolve against the viewport instead. So we read
    // the width while the cascade still resolves it correctly, then pin it.
    const portalOpen = () => {
      content.style.visibility = "hidden";
      content.style.display = "block";
      content.style.height = "auto";
      content.style.maxHeight = "none";
      naturalSize = {
        width: content.offsetWidth,
        height: content.scrollHeight,
      };

      // Clearing inline display hands visibility back to the UA's
      // [popover]:not(:popover-open) rule, so showPopover() takes effect.
      content.style.display = "";
      content.style.visibility = "";
      if (!content.matches(":popover-open")) content.showPopover();

      content.style.width = `${naturalSize.width}px`;
      // `?? naturalSize.height` is belt-and-braces: open() sets aria-expanded
      // before calling this, so reposition()'s isOpen() guard always passes.
      const maxHeight = reposition() ?? naturalSize.height;
      // Tween to the CLAMPED height. Animating to the natural height under a
      // smaller max-height would render as an instant jump, not an animation.
      return Math.min(naturalSize.height, maxHeight);
    };

    // Undoes portalOpen. Leaves the tween's own inline state to
    // clearInlineState().
    const portalClose = () => {
      if (!CAN_PORTAL) return;
      if (content.matches(":popover-open")) content.hidePopover();
      content.style.width = "";
      content.style.top = "";
      content.style.left = "";
      content.style.maxHeight = "";
      content.style.transformOrigin = "top";
      wrap.removeAttribute("data-dropdown-placement");
      content.removeAttribute("data-dropdown-placement");
    };

    // Snapshot whatever the in-flight animation is currently rendering, commit
    // those values to inline style, then cancel — lets the next animation
    // resume from the visible state instead of snapping to a default.
    const snapshotAndStop = () => {
      if (!currentAnimation) return null;
      try {
        currentAnimation.commitStyles();
      } catch (_) {
        /* commitStyles fails if the element is detached — ignore */
      }
      currentAnimation.cancel();
      currentAnimation = null;
      return {
        height: parseFloat(content.style.height) || 0,
        opacity: content.style.opacity || OPEN_OPACITY,
        transform: content.style.transform || OPEN_TRANSFORM,
      };
    };

    const animateTo = (from, to, onDone) => {
      // Clip during the animation only — children that should overflow
      // (submenus, focus rings) need to escape once the dropdown is open.
      content.style.overflow = "hidden";
      // Inline-style the from state so a mid-flight cancel reverts cleanly.
      content.style.height = `${from.height}px`;
      content.style.opacity = from.opacity;
      content.style.transform = from.transform;

      const anim = content.animate(
        [
          {
            height: `${from.height}px`,
            opacity: from.opacity,
            transform: from.transform,
          },
          {
            height: `${to.height}px`,
            opacity: to.opacity,
            transform: to.transform,
          },
        ],
        { duration: DURATION_MS, easing: EASING, fill: "forwards" },
      );
      currentAnimation = anim;
      anim.onfinish = () => {
        if (currentAnimation !== anim) return;
        currentAnimation = null;
        onDone();
        // Release the forwards fill so the element renders from inline+cascade
        // again — otherwise height stays locked to the value measured at
        // animation start, clipping any content that grew afterward.
        anim.cancel();
      };
    };

    const clearInlineState = () => {
      content.style.height = "";
      content.style.opacity = "";
      content.style.transform = "";
    };

    const open = () => {
      if (isOpen()) return;
      // Fresh open, fresh gutter-freeze latch — a panel that clamped on a
      // previous open must not start this one with the gutter already
      // reserved.
      gutterReserved = false;
      // Only one dropdown open at a time — sidesteps z-index conflicts when
      // two open menus would otherwise stack by document order.
      if (activeDropdown && activeDropdown.wrap !== wrap)
        activeDropdown.close();
      // Lift above any peer that's still animating closed so it can't
      // overlap visually during the parallel close/open.
      zCounter += 1;
      wrap.style.zIndex = String(Z_BASE + zCounter);
      wrap.classList.add("is-active");
      toggle.setAttribute("aria-expanded", "true");

      const from = snapshotAndStop() || {
        height: 0,
        opacity: CLOSED_OPACITY,
        transform: CLOSED_TRANSFORM,
      };
      let toHeight;
      if (CAN_PORTAL) {
        toHeight = portalOpen();
      } else {
        content.style.display = "block";
        content.style.height = "auto";
        toHeight = content.scrollHeight;
      }

      activeDropdown = {
        wrap,
        toggle,
        content,
        close,
        reposition,
        focusableItems: /** @type {HTMLElement[]} */ ([
          ...content.querySelectorAll(FOCUSABLE_ITEM_SELECTOR),
        ]),
      };
      startTracking();

      animateTo(
        from,
        { height: toHeight, opacity: OPEN_OPACITY, transform: OPEN_TRANSFORM },
        () => {
          clearInlineState();
          // A clamped panel keeps scrolling internally. An unclamped one lets
          // descendants (focus rings, submenus) overflow, as before — unless
          // this open has clamped before, in which case restingOverflow()
          // keeps the gutter reserved (see gutterReserved's declaration).
          content.style.overflow = restingOverflow();
          if (activeDropdown?.content === content) observePanel(activeDropdown);
        },
      );
    };

    const close = () => {
      if (!isOpen()) return;
      wrap.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
      // Detach synchronously, not in the tween's callback — a fast reopen would
      // otherwise let the old close's callback tear down the new panel's
      // tracking. Not repositioning during the ~200ms close tween is fine.
      if (activeDropdown && activeDropdown.wrap === wrap) {
        stopTracking();
        activeDropdown = null;
      }

      const from = snapshotAndStop() || {
        height: content.getBoundingClientRect().height,
        opacity: OPEN_OPACITY,
        transform: OPEN_TRANSFORM,
      };

      animateTo(
        from,
        { height: 0, opacity: CLOSED_OPACITY, transform: CLOSED_TRANSFORM },
        () => {
          clearInlineState();
          if (CAN_PORTAL) portalClose();
          else content.style.display = "none";
          content.style.overflow = "";
          wrap.style.zIndex = "";
          if (allClosed()) zCounter = 0;
        },
      );
    };

    toggle.addEventListener("click", () => {
      isOpen() ? close() : open();
    });

    if (openOnHoverIn) wrap.addEventListener("mouseenter", open);
    if (closeOnHoverOut) wrap.addEventListener("mouseleave", close);
  });
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDropdown, { once: true });
} else {
  initDropdown();
}
