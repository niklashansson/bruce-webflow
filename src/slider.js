/**
 * Slider Component
 *
 * Swiper-based slider with Finsweet List integration, CMS flattening,
 * and dynamic content support.
 *
 * Usage in Webflow:
 *   <div data-slider="component">
 *     <div class="slider_element"
 *          data-follow-finger="True|False"   (default True)
 *          data-free-mode="True|False"        (default False)
 *          data-mousewheel="True|False"       (default False)
 *          data-slide-to-clicked="True|False" (default False)
 *          data-centered="True|False"         (default False)
 *          data-loop="True|False"             (default False)
 *          data-speed="600"                   (default 600ms)
 *          data-initial-slide="0"             (default 0)
 *     >
 *       <div class="slider_list">
 *         <!-- slides -->
 *       </div>
 *     </div>
 *     <div class="slider_bullet_list"></div>          (optional pagination)
 *     <div data-slider="next"><button></button></div>  (optional)
 *     <div data-slider="previous"><button></button></div>
 *   </div>
 *
 * Loaded globally — Swiper is loaded via CDN in Site Settings.
 */

import {
  attrBool,
  attrNum,
  flattenDisplayContents,
  removeCMSList,
} from "./utils.js";

// ── Module-level constants ───────────────────────────────────
const SLIDER_SELECTOR =
  "[data-slider='component']:not([data-slider='component'] [data-slider='component'])";

// ── Init a single slider component ───────────────────────────

/**
 * @param {HTMLElement} component
 */
function initComponent(component) {
  if (component.dataset.scriptInitialized) return;

  const swiperElement = component.querySelector(".slider_element");
  const swiperWrapper = component.querySelector(".slider_list");
  if (!swiperElement || !swiperWrapper) return;

  // Restructure DOM for Swiper compatibility
  flattenDisplayContents(swiperWrapper);
  removeCMSList(swiperWrapper);

  [...swiperWrapper.children].forEach((el) => el.classList.add("swiper-slide"));
  const slideCount = swiperWrapper.children.length;

  // Empty list — wait for Finsweet/observer to call us again
  if (slideCount === 0) return;

  // Mark initialized only once we're committed (past the empty-list guard)
  component.dataset.scriptInitialized = "true";

  // ── Read configuration attributes ─────────────────────
  const followFinger =
    swiperElement.getAttribute("data-follow-finger") !== "False";
  const freeMode = attrBool(swiperElement, "data-free-mode");
  const mousewheel = attrBool(swiperElement, "data-mousewheel");
  const slideToClickedSlide = attrBool(swiperElement, "data-slide-to-clicked");
  const centeredSlides = attrBool(swiperElement, "data-centered");
  const loop = attrBool(swiperElement, "data-loop");
  const speed = attrNum(swiperElement, "data-speed", 600);
  const initialSlide = Math.min(
    attrNum(swiperElement, "data-initial-slide", 0),
    slideCount - 1,
  );

  // ── Resolve nav + pagination elements ─────────────────
  const paginationEl = component.querySelector(".slider_bullet_list");
  const nextEls = [
    ...component.querySelectorAll("[data-slider='next'] button"),
  ];
  const prevEls = [
    ...component.querySelectorAll("[data-slider='previous'] button"),
  ];

  // ── Build Swiper instance ─────────────────────────────
  // eslint-disable-next-line no-new
  const swiper = new Swiper(swiperElement, {
    slidesPerView: "auto",
    followFinger,
    loop,
    loopAdditionalSlides: loop ? 10 : 0,
    freeMode,
    slideToClickedSlide,
    centeredSlides,
    centeredSlidesBounds: centeredSlides,
    autoHeight: false,
    initialSlide,
    speed,
    mousewheel: { enabled: mousewheel, forceToAxis: true },
    keyboard: { enabled: true, onlyInViewport: true },
    navigation:
      nextEls.length && prevEls.length
        ? { nextEl: nextEls, prevEl: prevEls }
        : false,
    pagination: paginationEl
      ? {
          el: paginationEl,
          bulletActiveClass: "is-active",
          bulletClass: "slider_bullet_item",
          bulletElement: "button",
          clickable: true,
        }
      : false,
    slideActiveClass: "is-active",
    slideDuplicateActiveClass: "is-active",
  });

  // Expose for external access (e.g. coordinating with video state)
  /** @type {any} */ (component)._swiper = swiper;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize all slider components currently in the DOM.
 * Safe to call multiple times — already-initialized components are skipped.
 */
export function initSliders() {
  document.querySelectorAll(SLIDER_SELECTOR).forEach((el) => {
    initComponent(/** @type {HTMLElement} */ (el));
  });
}

/**
 * Initialize a specific slider component. Useful for dynamically inserted
 * components.
 *
 * @param {HTMLElement} element
 */
export function initSlider(element) {
  if (element && element.matches(SLIDER_SELECTOR)) {
    initComponent(element);
  }
}

// ── Finsweet integration ─────────────────────────────────────
// Re-init sliders once Finsweet has populated CMS lists. Uses the global
// FinsweetAttributes queue, which Finsweet processes when its script loads.

/** @type {any} */ (window).FinsweetAttributes ||= [];
/** @type {any} */ (window).FinsweetAttributes.push([
  "list",
  /** @param {Array<{loadingPromise?: Promise<unknown>}>} lists */
  (lists) => {
    Promise.all(lists.map((l) => l.loadingPromise || Promise.resolve())).then(
      initSliders,
    );
  },
]);

// ── MutationObserver: catch dynamic content from other sources ───
// Handles cases where slides appear via non-Finsweet means (manual JS,
// Webflow CMS pagination, etc.). Debounced via rAF to avoid thrashing
// during bulk DOM inserts.

let mutationRafId = 0;
let pendingMutations = false;

const processMutations = () => {
  mutationRafId = 0;
  if (!pendingMutations) return;
  pendingMutations = false;
  initSliders();
};

const scheduleMutationProcess = () => {
  pendingMutations = true;
  if (mutationRafId) return;
  mutationRafId = requestAnimationFrame(processMutations);
};

const mutationObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);

      // Quick check: is this a CMS item, or does it contain one?
      const isDynItem =
        el.matches?.(".w-dyn-item") || el.querySelector?.(".w-dyn-item");
      if (!isDynItem) continue;

      // Is it inside or containing an un-initialized slider?
      const slider =
        el.closest?.(SLIDER_SELECTOR) || el.querySelector?.(SLIDER_SELECTOR);
      if (
        slider &&
        !(/** @type {HTMLElement} */ (slider).dataset.scriptInitialized)
      ) {
        scheduleMutationProcess();
        return;
      }
    }
  }
});

mutationObserver.observe(document.body, { childList: true, subtree: true });

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSliders, { once: true });
} else {
  initSliders();
}
