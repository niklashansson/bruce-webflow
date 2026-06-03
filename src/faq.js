/**
 * FAQ Component
 *
 * Assembles a two-level FAQ accordion from two sibling Webflow collection
 * lists, then hands interaction off to accordion.js. A Webflow Component
 * cannot contain a nested collection list, so FAQ Sections and FAQ Items are
 * bound as separate (non-nested) lists and stitched together here at runtime.
 *
 * Markup (per component):
 *   <div data-faq-element="component">
 *     <!-- FAQ Sections list (sorted by section order) -->
 *     <div data-faq-element="sections" data-accordion-element="list">
 *       <div data-accordion-element="item">
 *         <button data-accordion-element="toggle">{{ Section Name }}</button>
 *         <div data-accordion-element="content">
 *           <div data-faq-element="target" data-faq-section="{{ Section Slug }}"
 *                data-accordion-element="list"></div>
 *         </div>
 *       </div>
 *     </div>
 *     <!-- FAQ Items list (sorted by item order) -->
 *     <div data-faq-element="source">
 *       <div data-accordion-element="item"
 *            data-faq-section="{{ Item → Section → Slug }}">
 *         <button data-accordion-element="toggle">{{ Question }}</button>
 *         <div data-accordion-element="content">{{ Answer }}</div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Per-component attribute (optional):
 *   - data-faq-keep-empty="True"   keep sections that receive zero items
 *                                  (default: such sections are removed)
 *
 * faq.js performs no animation — it moves item nodes into their section's
 * target, prunes empty sections, removes the source list, then calls
 * initAccordion(), which wires both accordion levels.
 */

import { attrBool } from "./utils.js";
import { planFaqNesting } from "./faq-plan.js";
import { initAccordion } from "./accordion.js";

const F = {
  component: '[data-faq-element="component"]',
  source: '[data-faq-element="source"]',
  target: '[data-faq-element="target"]',
  section: "data-faq-section",
  keepEmpty: "data-faq-keep-empty",
};

/** Build all FAQ components on the page, then (re)init accordions. */
export function initFaq() {
  let restructured = false;

  document.querySelectorAll(F.component).forEach((componentEl) => {
    const component = /** @type {HTMLElement} */ (componentEl);
    if (component.dataset.scriptInitialized) return;

    const sourceList = component.querySelector(F.source);
    const targetEls = [...component.querySelectorAll(F.target)];
    // Not ready yet (e.g. CMS still rendering) — leave for a later pass.
    if (!sourceList || targetEls.length === 0) return;

    component.dataset.scriptInitialized = "true";
    restructured = true;

    // Each source item is the [data-accordion-element="item"] carrying the
    // section slug. Querying within sourceList excludes the targets, which
    // also carry data-faq-section but live in the sections list.
    const itemEls = [...sourceList.querySelectorAll(`[${F.section}]`)];

    const targetSlugs = targetEls.map(
      (el) => el.getAttribute(F.section) || "",
    );
    const itemSlugs = itemEls.map((el) => el.getAttribute(F.section) || "");

    const { groups, orphanItemIndexes } = planFaqNesting(
      targetSlugs,
      itemSlugs,
    );

    // Move each item into its section's target, preserving item order. Moving
    // the item node itself (not its .w-dyn-item wrapper) keeps accordion.js's
    // `closest(list) === list` scoping correct for the nested list.
    groups.forEach((group, groupIndex) => {
      const target = targetEls[groupIndex];
      group.itemIndexes.forEach((itemIndex) => {
        target.appendChild(itemEls[itemIndex]);
      });
    });

    // Items whose slug matches no section: drop them, warn for content fixes.
    orphanItemIndexes.forEach((itemIndex) => {
      console.warn(
        `[faq] item references unknown section "${itemSlugs[itemIndex]}"`,
        itemEls[itemIndex],
      );
      itemEls[itemIndex].remove();
    });

    // Remove sections that received no items, unless told to keep them.
    if (!attrBool(component, F.keepEmpty)) {
      groups.forEach((group, groupIndex) => {
        if (group.itemIndexes.length > 0) return;
        const target = targetEls[groupIndex];
        const sectionItem = target?.closest('[data-accordion-element="item"]');
        (sectionItem?.closest(".w-dyn-item") || sectionItem)?.remove();
      });
    }

    // Drop the now-empty source list (its outer .w-dyn-list wrapper too).
    (sourceList.closest(".w-dyn-list") || sourceList).remove();
  });

  // Wire both accordion levels. initAccordion is idempotent (guards each list
  // with data-script-initialized) and skips empty lists, so this is safe even
  // if accordion.js already booted the (then-empty) section list.
  if (restructured) initAccordion();
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFaq, { once: true });
} else {
  initFaq();
}
