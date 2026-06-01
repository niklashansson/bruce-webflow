/**
 * Slider Component
 *
 * Swiper-based slider with static CMS flattening. Slides come from
 * server-rendered Webflow Collection Lists and are initialized once at load.
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

import { attrBool, attrNum, flattenDisplayContents } from "./utils.js";

// ── Module-level constants ───────────────────────────────────
const SLIDER_SELECTOR =
  "[data-slider='component']:not([data-slider='component'] [data-slider='component'])";

// ── CMS → Swiper slides (non-destructive) ────────────────────

/**
 * Feed Swiper its slides without destroying the Webflow CMS list.
 *
 * Swiper needs the slides to be direct children of `.slider_list`, but the
 * slides come from a Webflow Collection List nested as
 * `.w-dyn-list > .w-dyn-items > .w-dyn-item > <card>`. An earlier approach
 * hoisted the cards out and DELETED that collection-list shell — which
 * silently corrupted any Finsweet `fs-list` elsewhere on the page: Finsweet
 * enumerates the collection from the live CMS DOM, and removing these nodes
 * made it mis-count and pull the slider's items into the paginated results
 * list (see the studios city pages).
 *
 * Instead we CLONE each card into the wrapper for Swiper to render, and keep
 * the original collection list intact in the DOM — hidden and moved out of
 * the Swiper wrapper — so Finsweet still reads it exactly as authored.
 *
 * @param {HTMLElement} swiperWrapper the `.slider_list`
 * @param {HTMLElement} component the slider component root
 */
function cloneCMSItemsAsSlides(swiperWrapper, component) {
  const dynList = swiperWrapper.querySelector(".w-dyn-list");
  if (!dynList) return; // static slides — already direct children

  dynList.querySelectorAll(".w-dyn-item").forEach((item) => {
    const card = [...item.children].find(
      (child) => !child.classList.contains("w-condition-invisible"),
    );
    if (card) swiperWrapper.appendChild(card.cloneNode(true));
  });

  // Preserve the original list for Finsweet: keep it in the DOM, intact, but
  // out of the Swiper wrapper and hidden so it doesn't render as a stray slide.
  dynList.setAttribute("aria-hidden", "true");
  dynList.style.display = "none";
  component.appendChild(dynList);
}

// ── Init a single slider component ───────────────────────────

/**
 * @param {HTMLElement} component
 */
function initComponent(component) {
  if (component.dataset.scriptInitialized) return;

  const swiperElement = component.querySelector(".slider_element");
  const swiperWrapper = component.querySelector(".slider_list");
  if (!swiperElement || !swiperWrapper) return;

  // Restructure DOM for Swiper compatibility. Clone CMS items into the wrapper
  // and preserve the original collection list (see cloneCMSItemsAsSlides).
  flattenDisplayContents(swiperWrapper);
  cloneCMSItemsAsSlides(swiperWrapper, component);

  [...swiperWrapper.children].forEach((el) => el.classList.add("swiper-slide"));
  const slideCount = swiperWrapper.children.length;

  // Nothing to show — skip empty lists.
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

// ── Auto-boot ────────────────────────────────────────────────
// Slider content is static (server-rendered Webflow Collection Lists), so a
// single init at DOMContentLoaded is sufficient.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSliders, { once: true });
} else {
  initSliders();
}
