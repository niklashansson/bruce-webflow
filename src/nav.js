/**
 * Nav Component
 *
 * Three independent nav behaviors:
 *   1. Banner dismissal — persists via sessionStorage, applies hide class
 *      synchronously on script load to prevent FOUC
 *   2. Skip-to-main link — focuses <main> for accessibility
 *   3. Scroll state — adds is-scroll-top / is-scroll-up / is-scroll-down
 *      classes based on direction, with a distance threshold
 *      to prevent flicker from jitter
 *
 * Usage in Webflow:
 *   <div class="nav_component">
 *     <a class="nav_skip_wrap" href="#main">Skip to content</a>
 *     <div class="nav_banner">
 *       <button class="nav_banner_close_wrap">×</button>
 *     </div>
 *   </div>
 *   <main>...</main>
 *
 * Optional per-component threshold override:
 *   <div class="nav_component" data-scroll-threshold="20">
 *
 * Banner dismissal persists for the session via sessionStorage key
 * 'hide-nav-banner'.
 *
 */

import { attrNum } from "./utils.js";

// ── Module-level constants ───────────────────────────────────
const BANNER_STORAGE_KEY = "hide-nav-banner";
const BANNER_HIDE_CLASS = "hide-nav-banner";
const SCROLL_TRIGGER_THRESHOLD = 100;
const DEFAULT_DIRECTION_THRESHOLD = 16; // px to scroll before flipping direction

// ── Pre-DOM banner hide (FOUC prevention) ────────────────────
// Run synchronously at script load so the hide class is on <html>
// before the banner paints. For maximum FOUC protection, also place
// this snippet inline in Webflow Site Settings → Custom Code → <head>.
try {
  if (sessionStorage.getItem(BANNER_STORAGE_KEY) === "true") {
    document.documentElement.classList.add(BANNER_HIDE_CLASS);
  }
} catch (_) {
  /* storage blocked — banner will show; not fatal */
}

// ── Banner close ─────────────────────────────────────────────

function initBannerClose() {
  document.querySelectorAll(".nav_banner_close_wrap").forEach((button) => {
    const el = /** @type {HTMLElement} */ (button);
    if (el.dataset.scriptInitialized) return;
    el.dataset.scriptInitialized = "true";

    button.addEventListener("click", () => {
      try {
        sessionStorage.setItem(BANNER_STORAGE_KEY, "true");
      } catch (_) {
        /* storage blocked — class still applies for this page view */
      }
      document.documentElement.classList.add(BANNER_HIDE_CLASS);
    });
  });
}

// ── Skip link ────────────────────────────────────────────────

function initSkipLink() {
  const target = document.querySelector("main");
  if (!target) return;

  document.querySelectorAll(".nav_skip_wrap").forEach((link) => {
    const el = /** @type {HTMLElement} */ (link);
    if (el.dataset.scriptInitialized) return;
    el.dataset.scriptInitialized = "true";

    link.addEventListener("click", () => {
      // tabindex=-1 makes <main> programmatically focusable without
      // adding it to the natural tab order
      target.setAttribute("tabindex", "-1");
      /** @type {HTMLElement} */ (target).focus();
      // Clean up after focus moves away so the DOM isn't permanently mutated
      target.addEventListener(
        "blur",
        () => target.removeAttribute("tabindex"),
        { once: true },
      );
    });
  });
}

// ── Scroll state ─────────────────────────────────────────────

function initScrollState() {
  const components = document.querySelectorAll(".nav_component");
  if (!components.length) return;

  // Initial state based on current scroll position
  const initialAtTop = window.scrollY <= SCROLL_TRIGGER_THRESHOLD;
  components.forEach((c) => {
    c.classList.add(initialAtTop ? "is-scroll-top" : "is-scroll-down");
  });

  // ── Per-component state ────────────────────────────────
  /** @typedef {{ el: HTMLElement, threshold: number, committed: -1 | 0 | 1, pivotY: number }} NavState */
  /** @type {NavState[]} */
  const states = [];

  components.forEach((component) => {
    const el = /** @type {HTMLElement} */ (component);
    if (el.dataset.scriptInitialized) return;
    el.dataset.scriptInitialized = "true";

    states.push({
      el,
      threshold: attrNum(
        el,
        "data-scroll-threshold",
        DEFAULT_DIRECTION_THRESHOLD,
      ),
      committed: initialAtTop ? 0 : 1,
      pivotY: window.scrollY,
    });
  });

  if (!states.length) return;

  // ── Shared scroll handler (one listener for all nav components) ──
  let ticking = false;

  const update = () => {
    ticking = false;
    const currentY = window.scrollY;

    for (const state of states) {
      // Top-of-page: above the trigger threshold → enforce is-scroll-top
      if (currentY <= SCROLL_TRIGGER_THRESHOLD) {
        if (state.committed !== 0) {
          state.el.classList.remove("is-scroll-up", "is-scroll-down");
          state.el.classList.add("is-scroll-top");
          state.committed = 0;
          state.pivotY = currentY;
        }
        continue;
      }

      // Past trigger point — measure delta against pivot
      const delta = currentY - state.pivotY;
      if (Math.abs(delta) < state.threshold) continue;

      const newDirection = delta > 0 ? 1 : -1;
      if (newDirection !== state.committed) {
        state.committed = newDirection;
        state.el.classList.toggle("is-scroll-up", newDirection === -1);
        state.el.classList.toggle("is-scroll-down", newDirection === 1);
        state.el.classList.remove("is-scroll-top");
      }
      state.pivotY = currentY;
    }
  };

  // rAF-throttled scroll listener — one rAF call per frame max,
  // regardless of how many scroll events fire
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize all nav behaviors. Safe to call multiple times —
 * already-initialized elements are skipped via dataset flag.
 */
export function initNav() {
  initBannerClose();
  initSkipLink();
  initScrollState();
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNav, { once: true });
} else {
  initNav();
}
