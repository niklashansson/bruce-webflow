/**
 * Per-slug session-scoped dismissal for CMS announcement items.
 * Marks dismissed items with `data-announcement-dismissed`; project CSS
 * owns visibility and any parent collapse (e.g. via `:has()`).
 */

const DISMISSED_STORAGE_KEY = "dismissed-announcements";
const ANNOUNCEMENT_SLUG_ATTR = "data-announcement-slug";
const DISMISSED_ATTR = "data-announcement-dismissed";
const ITEM_SELECTOR = '[data-announcement-element="item"]';
const DISMISS_SELECTOR = '[data-announcement-element="dismiss"]';

/** @returns {Set<string>} */
function readDismissedSlugs() {
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((s) => typeof s === "string")) : new Set();
  } catch (_) {
    return new Set();
  }
}

/** @param {Set<string>} set */
function writeDismissedSlugs(set) {
  try {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...set]));
  } catch (_) {
    /* storage blocked — dismissal still applies for this page view */
  }
}

const dismissedSlugs = readDismissedSlugs();

// Must run before DOM paint so dismissed items never flash.
(function injectDismissedHideStyles() {
  if (!dismissedSlugs.size) return;

  const rules = [...dismissedSlugs]
    .map((slug) => `[${ANNOUNCEMENT_SLUG_ATTR}="${CSS.escape(slug)}"]{display:none !important;}`)
    .join("");

  const style = document.createElement("style");
  style.setAttribute("data-announcement-hide", "");
  style.textContent = rules;
  (document.head || document.documentElement).appendChild(style);
})();

/** Initialize announcement dismissal (idempotent). */
export function initAnnouncements() {
  document.querySelectorAll(ITEM_SELECTOR).forEach(initItem);
}

/** @param {Element} item */
function initItem(item) {
  const el = /** @type {HTMLElement} */ (item);
  if (el.dataset.scriptInitialized) return;

  const slug = el.getAttribute(ANNOUNCEMENT_SLUG_ATTR);
  if (!slug) return;

  el.dataset.scriptInitialized = "true";

  if (dismissedSlugs.has(slug)) {
    el.setAttribute(DISMISSED_ATTR, "");
    return;
  }

  const dismissButton = el.querySelector(DISMISS_SELECTOR);
  if (!dismissButton) return;

  dismissButton.addEventListener("click", () => {
    dismissedSlugs.add(slug);
    writeDismissedSlugs(dismissedSlugs);
    el.setAttribute(DISMISSED_ATTR, "");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAnnouncements, { once: true });
} else {
  initAnnouncements();
}
