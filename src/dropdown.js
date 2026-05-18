/**
 * Dropdown Component
 *
 * Single togglable dropdown region with an animated open/close, click-outside
 * dismissal, Escape key support, and ArrowUp/ArrowDown navigation through
 * focusable items inside the content panel.
 *
 * Per-wrap data attributes (all optional, all on the wrap):
 *   - data-open-on-hover-in="True"     mouseenter on the wrap opens it
 *   - data-close-on-hover-out="True"   mouseleave on the wrap closes it
 *
 * Optional integrations (detected at runtime):
 *   - ScrollTrigger.refresh() after open/close so pinned sections re-measure
 *
 * Webflow markup (style with whatever classes you want):
 *   <div data-dropdown-element="wrap"
 *        data-open-on-hover-in="True"
 *        data-close-on-hover-out="True">
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

// Dynamic stacking — each open bumps the wrap above any already-animating
// peers so the newly-opening dropdown always sits on top of the one still
// closing underneath it. Counter resets to 0 when every dropdown is closed.
const Z_BASE = 1000;
let zCounter = 0;

/**
 * @typedef {{ wrap: HTMLElement, toggle: HTMLElement, close: () => void, focusableItems: HTMLElement[] }} ActiveDropdown
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

const allClosed = () => activeDropdown === null;

// ── Init ─────────────────────────────────────────────────────

/** Initialize all dropdown wraps. Safe to call multiple times. */
export function initDropdown() {
  attachDocumentListeners();

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
    content.style.display = "none";
    content.style.transformOrigin = "top";

    const refresh = () => {
      if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
    };

    /** @type {Animation | null} */
    let currentAnimation = null;

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

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    const open = () => {
      if (isOpen()) return;
      // Only one dropdown open at a time — sidesteps z-index conflicts when
      // two open menus would otherwise stack by document order.
      if (activeDropdown && activeDropdown.wrap !== wrap) activeDropdown.close();
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
      content.style.display = "block";
      content.style.height = "auto";
      const toHeight = content.scrollHeight;

      activeDropdown = {
        wrap,
        toggle,
        close,
        focusableItems: /** @type {HTMLElement[]} */ ([
          ...content.querySelectorAll(FOCUSABLE_ITEM_SELECTOR),
        ]),
      };

      animateTo(
        from,
        { height: toHeight, opacity: OPEN_OPACITY, transform: OPEN_TRANSFORM },
        () => {
          clearInlineState();
          // Let descendants overflow once the dropdown is settled open.
          content.style.overflow = "";
          refresh();
        },
      );
    };

    const close = () => {
      if (!isOpen()) return;
      wrap.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
      if (activeDropdown && activeDropdown.wrap === wrap) activeDropdown = null;

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
          content.style.display = "none";
          wrap.style.zIndex = "";
          if (allClosed()) zCounter = 0;
          refresh();
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
