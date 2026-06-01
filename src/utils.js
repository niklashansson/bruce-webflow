/**
 * Shared utilities for Webflow custom-script components.
 *
 * Centralized here so behavioral fixes (e.g. how to detect a
 * Finsweet-managed list, what counts as a truthy Webflow attribute)
 * stay consistent across all components.
 */

// Marks a list that Finsweet's `fs-list` owns. The CMS-flatten helpers must
// NOT mutate such lists: Finsweet enumerates the collection from this live
// DOM, so deleting its nodes corrupts pagination/filtering (e.g. an
// `fs-list-nest` accordion, or any list sharing a page with a results list).
export const FINSWEET_SELECTORS =
  "[fs-list-element], [fs-list-nest], [fs-list-instance]";

/**
 * Parses a Webflow boolean attribute. Webflow emits "True"/"False"
 * literals; we also accept lowercase for hand-authored markup.
 *
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {boolean} [defaultValue]
 */
export function attrBool(el, attr, defaultValue = false) {
  const v = el.getAttribute(attr);
  if (v === null) return defaultValue;
  return v === "True" || v === "true";
}

/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {number} defaultValue
 */
export function attrNum(el, attr, defaultValue) {
  const v = parseFloat(el.getAttribute(attr) || "");
  return Number.isFinite(v) ? v : defaultValue;
}

/**
 * Unwrap `.u-display-contents` wrappers inside a slot, but stop at a Webflow
 * CMS list wrapper (`.w-dyn-list`) or any Finsweet-managed list — Finsweet
 * keeps references to those elements and breaks if we mutate them.
 *
 * @param {HTMLElement | null} slot
 */
export function flattenDisplayContents(slot) {
  if (!slot) return;
  let child = slot.firstElementChild;
  while (child && child.classList.contains("u-display-contents")) {
    const isCMSList = child.classList.contains("w-dyn-list");
    const hasFinsweet =
      child.hasAttribute("fs-list-element") ||
      child.querySelector(FINSWEET_SELECTORS);
    if (isCMSList || hasFinsweet) break;
    while (child.firstChild) slot.insertBefore(child.firstChild, child);
    slot.removeChild(child);
    child = slot.firstElementChild;
  }
}

/**
 * Flatten a static Webflow CMS list into its parent slot, hoisting
 * each item's first visible child up. Leaves Finsweet-managed lists
 * untouched — deleting their nodes corrupts Finsweet's enumeration.
 *
 * @param {HTMLElement | null} slot
 */
export function removeCMSList(slot) {
  if (!slot) return;

  const dynList = Array.from(slot.children).find((child) =>
    child.classList.contains("w-dyn-list"),
  );
  if (!dynList) return;

  const dynListIsFinsweet =
    dynList.hasAttribute("fs-list-element") ||
    dynList.querySelector(FINSWEET_SELECTORS);
  if (dynListIsFinsweet) return;

  const nestedItems = dynList.querySelector(".w-dyn-items")?.children;
  if (!nestedItems) return;

  const staticWrapper = [...slot.children];
  [...nestedItems].forEach((el) => {
    const c = [...el.children].find(
      (child) => !child.classList.contains("w-condition-invisible"),
    );
    if (c) slot.appendChild(c);
  });
  staticWrapper.forEach((el) => el.remove());
}
