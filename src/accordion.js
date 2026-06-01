/**
 * Accordion Component
 *
 * Expandable items inside an accordion list, animated open/closed with the
 * Web Animations API. Each item pairs a toggle with a content slot.
 *
 * Per-list data attributes (read as strings; defaults shown):
 *   - data-close-previous="True"          close the prior item when opening another
 *   - data-close-on-second-click="True"   clicking an open item closes it
 *   - data-open-on-hover="False"          open on mouseenter as well as click
 *   - data-open-by-default="<n>"          open the n-th item (1-indexed) on init
 *
 * On boot the list is normalized so animations measure real children:
 *   - `.u-display-contents` wrappers are unwrapped in place
 *   - A `.w-dyn-list` is collapsed to its non-`.w-condition-invisible` children
 *
 * Webflow markup (style with whatever classes you want):
 *   <div data-accordion-element="list"
 *        data-close-previous="True"
 *        data-close-on-second-click="True"
 *        data-open-on-hover="False"
 *        data-open-by-default="1">
 *     <div data-accordion-element="item">
 *       <button data-accordion-element="toggle">…</button>
 *       <div data-accordion-element="content">…</div>
 *     </div>
 *   </div>
 *
 * Nested accordions work — each item is scoped to its own list.
 */

import {
  attrBool,
  attrNum,
  flattenDisplayContents,
  removeCMSList,
} from "./utils.js";

const A = {
  list: '[data-accordion-element="list"]',
  item: '[data-accordion-element="item"]',
  toggle: '[data-accordion-element="toggle"]',
  content: '[data-accordion-element="content"]',
};

const DURATION_MS = 300;
const EASING = "ease-in-out";

// ── Init ─────────────────────────────────────────────────────

/** Initialize all accordion lists. Safe to call multiple times. */
export function initAccordion() {
  document.querySelectorAll(A.list).forEach((listEl, listIndex) => {
    const list = /** @type {HTMLElement} */ (listEl);
    if (list.dataset.scriptInitialized) return;

    const closePrevious = attrBool(list, "data-close-previous", true);
    const closeOnSecondClick = attrBool(
      list,
      "data-close-on-second-click",
      true,
    );
    const openOnHover = attrBool(list, "data-open-on-hover");
    const openByDefault = attrNum(list, "data-open-by-default", 0);

    let previousIndex = null;
    /** @type {Array<() => void>} */
    const closeFunctions = [];

    flattenDisplayContents(list);
    removeCMSList(list);

    // Scope to items that belong to THIS list — skip items inside any nested list.
    const items = [...list.querySelectorAll(A.item)].filter(
      (el) => el.closest(A.list) === list,
    );

    // Nothing to wire yet — leave the list uninitialized so a later init pass
    // (e.g. a modal mount re-running initAccordion) can wire it once it has items.
    if (items.length === 0) return;
    list.dataset.scriptInitialized = "true";

    items.forEach((item, itemIndex) => {
      // Same scope discipline for toggle/content so a nested list's elements
      // don't get wired to this item.
      const button = [...item.querySelectorAll(A.toggle)].find(
        (el) => el.closest(A.item) === item,
      );
      const content = [...item.querySelectorAll(A.content)].find(
        (el) => el.closest(A.item) === item,
      );

      if (!button || !content) {
        console.warn("Missing elements:", item);
        return;
      }

      button.setAttribute("aria-expanded", "false");
      button.setAttribute("id", `accordion_button_${listIndex}_${itemIndex}`);
      content.setAttribute("id", `accordion_content_${listIndex}_${itemIndex}`);
      button.setAttribute("aria-controls", content.id);
      content.setAttribute("aria-labelledby", button.id);
      const contentEl = /** @type {HTMLElement} */ (content);
      contentEl.style.display = "none";
      contentEl.style.overflow = "hidden";

      /** @type {Animation | null} */
      let currentAnimation = null;

      // Commit the in-flight animation's current value to inline style, then
      // cancel it — lets the next animation resume from where this one was
      // visually, rather than snapping back to the underlying inline value.
      const stopCurrent = () => {
        if (!currentAnimation) return 0;
        try {
          currentAnimation.commitStyles();
        } catch (_) {
          /* commitStyles fails if the element is detached — ignore */
        }
        currentAnimation.cancel();
        currentAnimation = null;
        return parseFloat(contentEl.style.height) || 0;
      };

      const animateTo = (fromPx, toPx, onDone) => {
        contentEl.style.height = `${fromPx}px`;
        const anim = contentEl.animate(
          [{ height: `${fromPx}px` }, { height: `${toPx}px` }],
          { duration: DURATION_MS, easing: EASING, fill: "forwards" },
        );
        currentAnimation = anim;
        anim.onfinish = () => {
          if (currentAnimation !== anim) return;
          currentAnimation = null;
          // fill:forwards keeps the final keyframe applied at the animation
          // layer after finish, which overrides inline style. That freezes the
          // element at a fixed px height — invisible for leaf items but it
          // blocks a parent from growing when a nested accordion opens inside
          // it. Commit the final value to inline, then drop the animation
          // effect, so onDone's `style.height = ""` actually reaches `auto`.
          try {
            anim.commitStyles();
          } catch (_) {
            /* commitStyles fails on detached elements — ignore */
          }
          anim.cancel();
          onDone();
        };
      };

      const closeAccordion = () => {
        if (!item.classList.contains("is-active")) return;
        item.classList.remove("is-active");
        button.setAttribute("aria-expanded", "false");

        const from = currentAnimation
          ? stopCurrent()
          : contentEl.getBoundingClientRect().height;

        animateTo(from, 0, () => {
          contentEl.style.height = "";
          contentEl.style.display = "none";
        });
      };
      closeFunctions[itemIndex] = closeAccordion;

      const openAccordion = (instant = false) => {
        if (
          closePrevious &&
          previousIndex !== null &&
          previousIndex !== itemIndex
        ) {
          closeFunctions[previousIndex]?.();
        }
        previousIndex = itemIndex;
        button.setAttribute("aria-expanded", "true");
        item.classList.add("is-active");

        const from = stopCurrent();
        contentEl.style.display = "block";

        if (instant) {
          contentEl.style.height = "";
          return;
        }

        // Measure the natural target height, then restore the starting height
        // before the animation begins so there's no visible flash.
        contentEl.style.height = "auto";
        const to = contentEl.scrollHeight;

        animateTo(from, to, () => {
          contentEl.style.height = "";
        });
      };

      if (openByDefault === itemIndex + 1) openAccordion(true);

      button.addEventListener("click", () => {
        if (item.classList.contains("is-active") && closeOnSecondClick) {
          closeAccordion();
          previousIndex = null;
        } else {
          openAccordion();
        }
      });
      if (openOnHover)
        button.addEventListener("mouseenter", () => openAccordion());
    });
  });
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAccordion, { once: true });
} else {
  initAccordion();
}
