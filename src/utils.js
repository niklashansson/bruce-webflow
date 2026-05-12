/**
 * Shared utilities for Webflow custom-script components.
 *
 * Centralized here so behavioral fixes (e.g. how to detect a
 * Finsweet-managed list, what counts as a truthy Webflow attribute)
 * stay consistent across all components.
 */

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
 * Unwrap `.u-display-contents` wrappers inside a slot, but stop if
 * the wrapper is a Finsweet-managed CMS list — Finsweet keeps
 * references to those elements and breaks if we mutate them.
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
 * untouched.
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
