/**
 * Tab Component
 *
 * Accessible tab pattern with optional autoplay, accordion mode, and
 * Finsweet CMS integration. No external dependencies.
 *
 * Autoplay drives a `--progress` custom property (0→1) on `.tab_wrap` via
 * requestAnimationFrame, so any CSS keyed off that variable updates each
 * frame. Panel switches and accordion-variant content toggle instantly —
 * style transitions live in CSS, not here.
 *
 * Usage in Webflow:
 *   <div class="tab_wrap"
 *        data-loop-controls="True|False"        (default False)
 *        data-pause-on-hover="True|False"        (default False)
 *        data-autoplay-duration="5"              (seconds; 0 = off)
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

// ── Init a single tab component ──────────────────────────────

/**
 * @param {HTMLElement} tabWrap
 * @param {number} componentIndex
 */
function initComponent(tabWrap, componentIndex) {
  if (tabWrap.dataset.scriptInitialized) return;

  // ── Props ──────────────────────────────────────────────
  const loopControls = attrBool(tabWrap, "data-loop-controls");
  const pauseOnHover = attrBool(tabWrap, "data-pause-on-hover");
  let autoplay = attrNum(tabWrap, "data-autoplay-duration", 0);

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

  // Per-button accordion content slot (null for non-accordion variants).
  /** @type {Array<HTMLElement | null>} */
  const accordionContents = buttonWraps.map((wrap) => {
    if (wrap.getAttribute("data-wf--tab-link--variant") !== "accordion")
      return null;
    const content = /** @type {HTMLElement | null} */ (
      wrap.querySelector("[data-tab-link-content]")
    );
    if (!content) return null;
    content.style.display = "none";
    return content;
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
  /** @type {{play: () => void, pause: () => void, restart: () => void} | null} */
  let autoplayTl = null;
  // True when the user has explicitly paused autoplay via the toggle button.
  // (Name reflects intent — `updateAuto` keeps the cycle paused while this is true.)
  let userPaused = true;

  // Mark initialized after DOM restructuring but before behavior wiring
  // (so re-entry calls from MutationObservers bail out)
  tabWrap.dataset.scriptInitialized = "true";

  /**
   * Activate a tab by index.
   *
   * @param {number} index
   * @param {boolean} [focus]
   */
  const makeActive = (index, focus = false) => {
    if (index === activeIndex) return;

    const previousIndex = activeIndex;

    /** @param {number} i @param {boolean} isActive */
    const setButtonActive = (i, isActive) => {
      const btn = buttonItems[i];
      btn.classList.toggle("is-active", isActive);
      if (buttonWraps[i] !== btn)
        buttonWraps[i].classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
      if (accordionContents[i]) {
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
    } else {
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

    // Toggle accordion-variant content visibility
    if (previousIndex !== -1 && accordionContents[previousIndex]) {
      /** @type {HTMLElement} */ (accordionContents[previousIndex]).style.display = "none";
    }
    if (accordionContents[index]) {
      /** @type {HTMLElement} */ (accordionContents[index]).style.display = "block";
    }

    // Swap panels — instant; any visible transition belongs in CSS
    if (previousIndex !== -1 && panelItems[previousIndex]) {
      panelItems[previousIndex].style.display = "none";
    }
    if (panelItems[index]) panelItems[index].style.display = "block";

    // Reset autoplay progress on user-driven changes — clicking a tab restarts
    // the timer for the new tab. `userPaused` blocks the restart so a cycle
    // the user has explicitly paused stays paused.
    if (autoplayTl && !userPaused) autoplayTl.restart();

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
  makeActive(0);

  // ── Autoplay (rAF-driven; no external deps) ────────────
  if (autoplay !== 0) {
    const durationMs = autoplay * 1000;
    let rafId = 0;
    let cycleStart = 0; // performance.now() when current playing segment started
    let elapsedBeforePause = 0; // ms accumulated from prior playing segments in this cycle
    let isPlaying = false;

    /** @param {number} p */
    const setProgress = (p) => {
      tabWrap.style.setProperty("--progress", String(p));
    };

    /** @param {number} now */
    const tick = (now) => {
      if (!isPlaying) return;
      const elapsed = elapsedBeforePause + (now - cycleStart);
      if (elapsed >= durationMs) {
        setProgress(1);
        isPlaying = false;
        rafId = 0;
        elapsedBeforePause = 0;
        // Advance the tab; `makeActive` will call restart() if state allows.
        updateIndex(1, false);
        return;
      }
      setProgress(elapsed / durationMs);
      rafId = requestAnimationFrame(tick);
    };

    const startCycle = () => {
      if (rafId) cancelAnimationFrame(rafId);
      elapsedBeforePause = 0;
      cycleStart = performance.now();
      isPlaying = true;
      setProgress(0);
      rafId = requestAnimationFrame(tick);
    };

    const pauseCycle = () => {
      if (!isPlaying) return;
      isPlaying = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      elapsedBeforePause += performance.now() - cycleStart;
    };

    const resumeCycle = () => {
      if (isPlaying) return;
      // If the previous cycle had already completed before pause, start fresh
      if (elapsedBeforePause >= durationMs) {
        startCycle();
        return;
      }
      cycleStart = performance.now();
      isPlaying = true;
      rafId = requestAnimationFrame(tick);
    };

    autoplayTl = {
      play: resumeCycle,
      pause: pauseCycle,
      restart: startCycle,
    };

    startCycle();

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
        autoplayTl?.pause();
      } else {
        autoplayTl?.play();
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
