/**
 * Tab Component
 *
 * Accessible tab pattern with optional autoplay, slide transitions,
 * accordion mode, and Finsweet CMS integration.
 *
 * Usage in Webflow:
 *   <div class="tab_wrap"
 *        data-loop-controls="True|False"        (default False)
 *        data-slide-tabs="True|False"            (default False)
 *        data-pause-on-hover="True|False"        (default False)
 *        data-autoplay-duration="5"              (seconds; 0 = off)
 *        data-duration="0.3"                     (transition seconds)
 *        data-tab-component-id="features"        (optional, for deep linking)
 *   >
 *     <div class="tab_button_list">
 *       <div data-wf--tab-link--variant="default|accordion"
 *            data-tab-item-id="overview">
 *         <button>...</button>
 *         <div data-tab-link-content>...</div>  (accordion variant only)
 *       </div>
 *     </div>
 *     <div class="tab_content_list">
 *       <div>panel content</div>
 *     </div>
 *     <div data-tab="previous"><button></button></div>  (optional)
 *     <div data-tab="next"><button></button></div>       (optional)
 *     <div data-tab-button="toggle"><button></button></div>  (optional autoplay toggle)
 *   </div>
 *
 * Deep linking: ?tab-id=features-overview activates that tab on load.
 *
 * Loaded globally — GSAP loaded via CDN in Site Settings (optional;
 * graceful fallback to instant transitions when absent).
 */

import {
  attrBool,
  attrNum,
  flattenDisplayContents,
  removeCMSList,
} from "./utils.js";

// ── Module-level constants ───────────────────────────────────
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// ── Helpers ──────────────────────────────────────────────────

/** @param {string} value */
function slugify(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}

/** Check whether GSAP is available as a global. */
function hasGsap() {
  return typeof (/** @type {any} */ (window).gsap) !== "undefined";
}

/** Check whether ScrollTrigger is available. */
function hasScrollTrigger() {
  return typeof (/** @type {any} */ (window).ScrollTrigger) !== "undefined";
}

// ── Init a single tab component ──────────────────────────────

/**
 * @param {HTMLElement} tabWrap
 * @param {number} componentIndex
 */
function initComponent(tabWrap, componentIndex) {
  if (tabWrap.dataset.scriptInitialized) return;

  // ── Props ──────────────────────────────────────────────
  const loopControls = attrBool(tabWrap, "data-loop-controls");
  const slideTabs = attrBool(tabWrap, "data-slide-tabs");
  const pauseOnHover = attrBool(tabWrap, "data-pause-on-hover");
  let autoplay = attrNum(tabWrap, "data-autoplay-duration", 0);
  const duration = attrNum(tabWrap, "data-duration", 0.3);

  // ── Required DOM ───────────────────────────────────────
  const buttonList = /** @type {HTMLElement | null} */ (
    tabWrap.querySelector(".tab_button_list")
  );
  const panelList = /** @type {HTMLElement | null} */ (
    tabWrap.querySelector(".tab_content_list")
  );
  if (!buttonList || !panelList) {
    console.warn(
      "Tab component missing .tab_button_list or .tab_content_list:",
      tabWrap,
    );
    return;
  }

  // ── Optional controls ──────────────────────────────────
  const previousButton = /** @type {HTMLButtonElement | null} */ (
    tabWrap.querySelector("[data-tab='previous'] button")
  );
  const nextButton = /** @type {HTMLButtonElement | null} */ (
    tabWrap.querySelector("[data-tab='next'] button")
  );
  const toggleWrap = /** @type {HTMLElement | null} */ (
    tabWrap.querySelector("[data-tab-button='toggle']")
  );
  const toggleButton = /** @type {HTMLButtonElement | null} */ (
    tabWrap.querySelector("[data-tab-button='toggle'] button")
  );

  // ── Restructure DOM ────────────────────────────────────
  flattenDisplayContents(buttonList);
  flattenDisplayContents(panelList);
  removeCMSList(buttonList);
  removeCMSList(panelList);

  // ── Resolve buttons + wraps ────────────────────────────
  /** @type {HTMLElement[]} */
  const buttonItems = Array.from(buttonList.children).map(
    (child) =>
      /** @type {HTMLElement} */ (child.querySelector("button") || child),
  );

  /** @type {HTMLElement[]} */
  const buttonWraps = buttonItems.map((btn) => {
    let wrap = btn;
    while (wrap.parentElement && wrap.parentElement !== buttonList) {
      wrap = wrap.parentElement;
    }
    return wrap;
  });

  // Strip ARIA from wraps (only the inner buttons own the roles)
  buttonWraps.forEach((wrap, i) => {
    if (wrap !== buttonItems[i]) {
      wrap.removeAttribute("role");
      wrap.removeAttribute("aria-selected");
      wrap.removeAttribute("aria-controls");
      wrap.removeAttribute("tabindex");
    }
  });

  /** @type {HTMLElement[]} */
  const panelItems = Array.from(panelList.children).map(
    (c) => /** @type {HTMLElement} */ (c),
  );

  if (!buttonItems.length || !panelItems.length) {
    console.warn("Tab component has no buttons or panels:", tabWrap);
    return;
  }

  // ── Accordion timelines (only built if GSAP present) ──
  /** @type {Array<any | null>} */
  const accordionTimelines = buttonWraps.map((wrap) => {
    if (wrap.getAttribute("data-wf--tab-link--variant") !== "accordion")
      return null;
    const content = /** @type {HTMLElement | null} */ (
      wrap.querySelector("[data-tab-link-content]")
    );
    if (!content || !hasGsap()) return null;

    const gsap = /** @type {any} */ (window).gsap;
    content.style.display = "none";
    content.style.overflow = "hidden";

    const tl = gsap.timeline({
      paused: true,
      defaults: { duration, ease: "power1.inOut" },
      onComplete: () => {
        if (hasScrollTrigger())
          /** @type {any} */ (window).ScrollTrigger.refresh();
      },
      onReverseComplete: () => {
        if (hasScrollTrigger())
          /** @type {any} */ (window).ScrollTrigger.refresh();
      },
    });
    tl.set(content, { display: "block" });
    tl.fromTo(
      content,
      { height: 0, opacity: 0 },
      { height: "auto", opacity: 1 },
    );
    return tl;
  });

  // ── Initial ARIA setup ─────────────────────────────────
  buttonList.setAttribute("role", "tablist");
  panelList.removeAttribute("role");
  panelItems.forEach((panel) => {
    panel.style.display = "none";
    panel.setAttribute("role", "tabpanel");
  });
  buttonItems.forEach((btn) => btn.setAttribute("role", "tab"));

  // ── State ──────────────────────────────────────────────
  let activeIndex = -1;
  /** @type {any | null} */
  let currentTl = null;
  /** @type {any | null} */
  let autoplayTl = null;
  // True when the user has explicitly paused autoplay via the toggle button.
  // (Name reflects intent — `updateAuto` keeps the timeline paused while this is true.)
  let userPaused = true;

  // Mark initialized after DOM restructuring but before behavior wiring
  // (so re-entry calls from MutationObservers bail out)
  tabWrap.dataset.scriptInitialized = "true";

  /**
   * Activate a tab by index.
   *
   * @param {number} index
   * @param {boolean} [focus]
   * @param {boolean} [animate]
   */
  const makeActive = (index, focus = false, animate = true) => {
    if (index === activeIndex && !currentTl) return;

    const gsap = /** @type {any} */ (window).gsap;
    const useGsap = hasGsap();

    if (currentTl) {
      currentTl.kill();
      currentTl = null;
    }

    // Force-clean any panel left mid-animation
    panelItems.forEach((panel, i) => {
      if (i !== index && i !== activeIndex) {
        panel.style.display = "none";
        panel.style.opacity = "";
        if (slideTabs) {
          panel.style.position = "";
          panel.style.top = "";
          panel.style.left = "";
          panel.style.width = "";
          if (useGsap)
            gsap.set(panel, { xPercent: 0, clearProps: "transform" });
        }
      }
    });

    const previousIndex = activeIndex;

    /** @param {number} i @param {boolean} isActive */
    const setButtonActive = (i, isActive) => {
      const btn = buttonItems[i];
      btn.classList.toggle("is-active", isActive);
      if (buttonWraps[i] !== btn)
        buttonWraps[i].classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
      if (accordionTimelines[i]) {
        btn.setAttribute("aria-expanded", isActive ? "true" : "false");
      }
    };

    // First activation: seed every button into a known state.
    // Subsequent switches: only touch the two indices that changed.
    if (previousIndex === -1) {
      buttonItems.forEach((_, i) => setButtonActive(i, i === index));
      panelItems.forEach((panel, i) =>
        panel.classList.toggle("is-active", i === index),
      );
    } else if (previousIndex !== index) {
      setButtonActive(previousIndex, false);
      setButtonActive(index, true);
      panelItems[previousIndex]?.classList.toggle("is-active", false);
      panelItems[index]?.classList.toggle("is-active", true);
    }

    // Update prev/next disabled state
    if (nextButton)
      nextButton.disabled = index === buttonItems.length - 1 && !loopControls;
    if (previousButton) previousButton.disabled = index === 0 && !loopControls;

    if (focus) buttonItems[index].focus();

    // Drive accordion timelines (collapse previous, expand current)
    if (
      previousIndex !== -1 &&
      accordionTimelines[previousIndex] &&
      previousIndex !== index
    ) {
      if (animate) accordionTimelines[previousIndex].reverse();
      else accordionTimelines[previousIndex].progress(0).pause();
    }
    if (accordionTimelines[index]) {
      if (animate) accordionTimelines[index].play();
      else accordionTimelines[index].progress(1).pause();
    }

    // Panel transition
    const previousPanel = panelItems[activeIndex];
    const currentPanel = panelItems[index];
    const direction = activeIndex > index ? -1 : 1;

    if (useGsap && animate && activeIndex !== index) {
      // Restart autoplay progress visual if it was waiting
      if (
        autoplayTl &&
        !userPaused &&
        typeof autoplayTl.restart === "function"
      ) {
        autoplayTl.restart();
      }

      currentTl = gsap.timeline({
        onComplete: () => {
          currentTl = null;
          if (hasScrollTrigger())
            /** @type {any} */ (window).ScrollTrigger.refresh();
        },
        defaults: { duration, ease: "power1.out" },
      });

      if (slideTabs) {
        currentTl.set(currentPanel, { display: "block", position: "relative" });
        if (previousPanel) {
          currentTl.set(previousPanel, {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
          });
          currentTl.fromTo(
            previousPanel,
            { xPercent: 0 },
            { xPercent: -120 * direction },
          );
        }
        currentTl.fromTo(
          currentPanel,
          { xPercent: 120 * direction },
          { xPercent: 0 },
          "<",
        );
        if (previousPanel) currentTl.set(previousPanel, { display: "none" });
      } else {
        if (previousPanel) {
          currentTl.to(previousPanel, { opacity: 0 });
          currentTl.set(previousPanel, { display: "none" });
        }
        currentTl.set(currentPanel, { display: "block" });
        currentTl.fromTo(currentPanel, { opacity: 0 }, { opacity: 1 });
      }
    } else {
      if (previousPanel) previousPanel.style.display = "none";
      if (currentPanel) currentPanel.style.display = "block";
    }

    // Scroll active button into view (only if button list is horizontally scrollable)
    if (buttonList.scrollWidth > buttonList.clientWidth) {
      buttonList.scrollTo({
        left: buttonWraps[index].offsetLeft,
        behavior: "smooth",
      });
    }

    activeIndex = index;
  };

  // ── Navigation ────────────────────────────────────────
  /** @param {number} delta @param {boolean} [focus] */
  const updateIndex = (delta, focus = false) =>
    makeActive(
      (activeIndex + delta + buttonItems.length) % buttonItems.length,
      focus,
      true,
    );

  nextButton?.addEventListener("click", () => updateIndex(1));
  previousButton?.addEventListener("click", () => updateIndex(-1));

  // ── Per-button setup: IDs, click, keyboard, deep-link ──
  const tabIdAttr = tabWrap.getAttribute("data-tab-component-id");
  const tabId = tabIdAttr ? slugify(tabIdAttr) : String(componentIndex + 1);
  const deepLinkId = new URLSearchParams(location.search).get("tab-id");

  buttonItems.forEach((btn, index) => {
    const itemIdAttr = btn.getAttribute("data-tab-item-id");
    const itemId = itemIdAttr ? slugify(itemIdAttr) : String(index + 1);

    const buttonId = `tab-button-${tabId}-${itemId}`;
    const panelId = `tab-panel-${tabId}-${itemId}`;

    btn.setAttribute("id", buttonId);
    btn.setAttribute("aria-controls", panelId);
    panelItems[index]?.setAttribute("id", panelId);
    panelItems[index]?.setAttribute("aria-labelledby", buttonId);

    // Deep linking via ?tab-id=tabId-itemId
    if (deepLinkId === `${tabId}-${itemId}`) {
      // Defer activation until after initial makeActive(0) below
      queueMicrotask(() => {
        makeActive(index);
        autoplay = 0; // stop autoplay on deep-link
        tabWrap.scrollIntoView({ behavior: "smooth", block: "start" });

        const url = new URL(location.href);
        url.searchParams.delete("tab-id");
        history.replaceState({}, "", url);
      });
    }

    btn.addEventListener("click", () => makeActive(index));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        updateIndex(1, true);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        updateIndex(-1, true);
      } else if (e.key === "Home") {
        e.preventDefault();
        makeActive(0, true);
      } else if (e.key === "End") {
        e.preventDefault();
        makeActive(buttonItems.length - 1, true);
      }
    });
  });

  // Activate first tab (or wait for deep-link microtask)
  makeActive(0, false, false);

  // ── Autoplay ──────────────────────────────────────────
  if (autoplay !== 0 && hasGsap()) {
    const gsap = /** @type {any} */ (window).gsap;

    autoplayTl = gsap.timeline({ repeat: -1 }).fromTo(
      tabWrap,
      { "--progress": 0 },
      {
        "--progress": 1,
        ease: "none",
        duration: autoplay,
        onComplete: () => updateIndex(1, false),
      },
    );

    let isHovered = false;
    let hasFocusInside = false;
    let prefersReducedMotion = false;
    let inView = true;

    const updateAuto = () => {
      if (
        prefersReducedMotion ||
        !inView ||
        userPaused ||
        isHovered ||
        hasFocusInside
      ) {
        autoplayTl.pause();
      } else {
        autoplayTl.play();
      }
    };

    const setButton = () => {
      userPaused = !userPaused;
      toggleButton?.setAttribute("aria-pressed", !userPaused ? "true" : "false");
      toggleWrap?.classList.toggle("is-pressed", !userPaused);
      if (!userPaused) {
        isHovered = false;
        hasFocusInside = false;
        prefersReducedMotion = false;
      }
      updateAuto();
    };

    setButton();
    toggleButton?.addEventListener("click", () => setButton());

    /** @param {MediaQueryList | MediaQueryListEvent} e */
    const handleMotionChange = (e) => {
      prefersReducedMotion = e.matches;
      updateAuto();
      userPaused = !e.matches;
      setButton();
    };

    const motionMQ = window.matchMedia(REDUCED_MOTION_QUERY);
    handleMotionChange(motionMQ);
    motionMQ.addEventListener("change", handleMotionChange);

    if (pauseOnHover) {
      tabWrap.addEventListener("mouseenter", () => {
        isHovered = true;
        updateAuto();
      });
      tabWrap.addEventListener("mouseleave", () => {
        hasFocusInside = false;
        isHovered = false;
        updateAuto();
      });
    }

    tabWrap.addEventListener("focusin", () => {
      hasFocusInside = true;
      updateAuto();
    });
    tabWrap.addEventListener("focusout", (e) => {
      const related = /** @type {Element | null} */ (e.relatedTarget);
      if (!related || !tabWrap.contains(related)) {
        hasFocusInside = false;
        updateAuto();
      }
    });

    new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        updateAuto();
      },
      { threshold: 0 },
    ).observe(tabWrap);
  }

  // Expose for external access
  /** @type {any} */ (tabWrap)._tab = {
    makeActive,
    updateIndex,
    get activeIndex() {
      return activeIndex;
    },
  };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize all tab components currently in the DOM.
 * Safe to call multiple times — already-initialized components are skipped.
 */
export function initTabs() {
  document.querySelectorAll(".tab_wrap").forEach((el, i) => {
    initComponent(/** @type {HTMLElement} */ (el), i);
  });
}

/**
 * Initialize a specific tab component.
 * @param {HTMLElement} element
 */
export function initTab(element) {
  if (element && element.classList.contains("tab_wrap")) {
    // Use 0 as index — only matters as fallback when data-tab-component-id is absent
    initComponent(element, 0);
  }
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTabs, { once: true });
} else {
  initTabs();
}
