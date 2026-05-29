// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (
  modules,
  entry,
  mainEntry,
  parcelRequireName,
  externals,
  distDir,
  publicUrl,
  devServer
) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var importMap = previousRequire.i || {};
  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        if (externals[name]) {
          return externals[name];
        }
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        globalObject
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      if (res === false) {
        return {};
      }
      // Synthesize a module to follow re-exports.
      if (Array.isArray(res)) {
        var m = {__esModule: true};
        res.forEach(function (v) {
          var key = v[0];
          var id = v[1];
          var exp = v[2] || v[0];
          var x = newRequire(id);
          if (key === '*') {
            Object.keys(x).forEach(function (key) {
              if (
                key === 'default' ||
                key === '__esModule' ||
                Object.prototype.hasOwnProperty.call(m, key)
              ) {
                return;
              }

              Object.defineProperty(m, key, {
                enumerable: true,
                get: function () {
                  return x[key];
                },
              });
            });
          } else if (exp === '*') {
            Object.defineProperty(m, key, {
              enumerable: true,
              value: x,
            });
          } else {
            Object.defineProperty(m, key, {
              enumerable: true,
              get: function () {
                if (exp === 'default') {
                  return x.__esModule ? x.default : x;
                }
                return x[exp];
              },
            });
          }
        });
        return m;
      }
      return newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.require = nodeRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.distDir = distDir;
  newRequire.publicUrl = publicUrl;
  newRequire.devServer = devServer;
  newRequire.i = importMap;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  // Only insert newRequire.load when it is actually used.
  // The code in this file is linted against ES5, so dynamic import is not allowed.
  // INSERT_LOAD_HERE

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });
    }
  }
})({"8lqZg":[function(require,module,exports,__globalThis) {
var _navJs = require("./nav.js");
var _announcementsJs = require("./announcements.js");
var _modalJs = require("./modal.js");
var _accordionJs = require("./accordion.js");
var _collapsibleJs = require("./collapsible.js");
var _dropdownJs = require("./dropdown.js");
var _variablesJs = require("./variables.js");
var _cityJs = require("./city.js");
var _cityVisibilityJs = require("./city-visibility.js");
var _locationJs = require("./location.js");
var _studiosSearchRedirectJs = require("./studios-search-redirect.js");
var _tabJs = require("./tab.js");
var _visualVideoJs = require("./visual-video.js");

},{"./nav.js":"i5JEn","./announcements.js":"2rNzt","./modal.js":"3xjKI","./accordion.js":"0392A","./collapsible.js":"fkbji","./dropdown.js":"6GCUi","./variables.js":"1KIEs","./city.js":"alcnd","./city-visibility.js":"fwmRP","./location.js":"WOwQU","./studios-search-redirect.js":"eacga","./tab.js":"1ivZR","./visual-video.js":"2alcq"}],"i5JEn":[function(require,module,exports,__globalThis) {
/**
 * Nav Component
 *
 * Two independent nav behaviors:
 *   1. Skip-to-main link — focuses <main> for accessibility
 *   2. Scroll state — adds is-scroll-top / is-scroll-up / is-scroll-down
 *      classes based on direction, with a distance threshold
 *      to prevent flicker from jitter. Opt-in per component via
 *      data-hide-on-scroll.
 *
 * Usage in Webflow:
 *   <div class="nav_component">
 *     <a class="nav_skip_wrap" href="#main">Skip to content</a>
 *   </div>
 *   <main>...</main>
 *
 * Enable scroll state on a nav:
 *   <div class="nav_component" data-hide-on-scroll>
 *
 * Optional per-component threshold override:
 *   <div class="nav_component" data-hide-on-scroll data-scroll-threshold="20">
 *
 *
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Public API ───────────────────────────────────────────────
/**
 * Initialize all nav behaviors. Safe to call multiple times —
 * already-initialized elements are skipped via dataset flag.
 */ parcelHelpers.export(exports, "initNav", ()=>initNav);
var _utilsJs = require("./utils.js");
// ── Module-level constants ───────────────────────────────────
const SCROLL_TRIGGER_THRESHOLD = 100;
const DEFAULT_DIRECTION_THRESHOLD = 16; // px to scroll before flipping direction
// ── Skip link ────────────────────────────────────────────────
function initSkipLink() {
    const target = document.querySelector("main");
    if (!target) return;
    document.querySelectorAll(".nav_skip_wrap").forEach((link)=>{
        const el = /** @type {HTMLElement} */ link;
        if (el.dataset.scriptInitialized) return;
        el.dataset.scriptInitialized = "true";
        link.addEventListener("click", ()=>{
            // tabindex=-1 makes <main> programmatically focusable without
            // adding it to the natural tab order
            target.setAttribute("tabindex", "-1");
            /** @type {HTMLElement} */ target.focus();
            // Clean up after focus moves away so the DOM isn't permanently mutated
            target.addEventListener("blur", ()=>target.removeAttribute("tabindex"), {
                once: true
            });
        });
    });
}
// ── Scroll state ─────────────────────────────────────────────
function initScrollState() {
    const components = document.querySelectorAll(".nav_component[data-hide-on-scroll]");
    if (!components.length) return;
    // Initial state based on current scroll position
    const initialAtTop = window.scrollY <= SCROLL_TRIGGER_THRESHOLD;
    components.forEach((c)=>{
        c.classList.add(initialAtTop ? "is-scroll-top" : "is-scroll-down");
    });
    // ── Per-component state ────────────────────────────────
    /** @typedef {{ el: HTMLElement, threshold: number, committed: -1 | 0 | 1, pivotY: number }} NavState */ /** @type {NavState[]} */ const states = [];
    components.forEach((component)=>{
        const el = /** @type {HTMLElement} */ component;
        if (el.dataset.scriptInitialized) return;
        el.dataset.scriptInitialized = "true";
        states.push({
            el,
            threshold: (0, _utilsJs.attrNum)(el, "data-scroll-threshold", DEFAULT_DIRECTION_THRESHOLD),
            committed: initialAtTop ? 0 : 1,
            pivotY: window.scrollY
        });
    });
    if (!states.length) return;
    // ── Shared scroll handler (one listener for all nav components) ──
    let ticking = false;
    const update = ()=>{
        ticking = false;
        const currentY = window.scrollY;
        for (const state of states){
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
    const onScroll = ()=>{
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, {
        passive: true
    });
}
function initNav() {
    initSkipLink();
    initScrollState();
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNav, {
    once: true
});
else initNav();

},{"./utils.js":"en4he","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"en4he":[function(require,module,exports,__globalThis) {
/**
 * Shared utilities for Webflow custom-script components.
 *
 * Centralized here so behavioral fixes (e.g. how to detect a
 * Finsweet-managed list, what counts as a truthy Webflow attribute)
 * stay consistent across all components.
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "FINSWEET_SELECTORS", ()=>FINSWEET_SELECTORS);
/**
 * Parses a Webflow boolean attribute. Webflow emits "True"/"False"
 * literals; we also accept lowercase for hand-authored markup.
 *
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {boolean} [defaultValue]
 */ parcelHelpers.export(exports, "attrBool", ()=>attrBool);
/**
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {number} defaultValue
 */ parcelHelpers.export(exports, "attrNum", ()=>attrNum);
/**
 * Unwrap `.u-display-contents` wrappers inside a slot, but stop if
 * the wrapper is a Finsweet-managed CMS list — Finsweet keeps
 * references to those elements and breaks if we mutate them.
 *
 * @param {HTMLElement | null} slot
 */ parcelHelpers.export(exports, "flattenDisplayContents", ()=>flattenDisplayContents);
/**
 * Flatten a static Webflow CMS list into its parent slot, hoisting
 * each item's first visible child up. Leaves Finsweet-managed lists
 * untouched.
 *
 * @param {HTMLElement | null} slot
 */ parcelHelpers.export(exports, "removeCMSList", ()=>removeCMSList);
const FINSWEET_SELECTORS = "[fs-list-element], [fs-list-nest], [fs-list-instance]";
function attrBool(el, attr, defaultValue = false) {
    const v = el.getAttribute(attr);
    if (v === null) return defaultValue;
    return v === "True" || v === "true";
}
function attrNum(el, attr, defaultValue) {
    const v = parseFloat(el.getAttribute(attr) || "");
    return Number.isFinite(v) ? v : defaultValue;
}
function flattenDisplayContents(slot) {
    if (!slot) return;
    let child = slot.firstElementChild;
    while(child && child.classList.contains("u-display-contents")){
        const isCMSList = child.classList.contains("w-dyn-list");
        const hasFinsweet = child.hasAttribute("fs-list-element") || child.querySelector(FINSWEET_SELECTORS);
        if (isCMSList || hasFinsweet) break;
        while(child.firstChild)slot.insertBefore(child.firstChild, child);
        slot.removeChild(child);
        child = slot.firstElementChild;
    }
}
function removeCMSList(slot) {
    if (!slot) return;
    const dynList = Array.from(slot.children).find((child)=>child.classList.contains("w-dyn-list"));
    if (!dynList) return;
    const dynListIsFinsweet = dynList.hasAttribute("fs-list-element") || dynList.querySelector(FINSWEET_SELECTORS);
    if (dynListIsFinsweet) return;
    const nestedItems = dynList.querySelector(".w-dyn-items")?.children;
    if (!nestedItems) return;
    const staticWrapper = [
        ...slot.children
    ];
    [
        ...nestedItems
    ].forEach((el)=>{
        const c = [
            ...el.children
        ].find((child)=>!child.classList.contains("w-condition-invisible"));
        if (c) slot.appendChild(c);
    });
    staticWrapper.forEach((el)=>el.remove());
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"4PAvJ":[function(require,module,exports,__globalThis) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, '__esModule', {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === 'default' || key === '__esModule' || Object.prototype.hasOwnProperty.call(dest, key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"2rNzt":[function(require,module,exports,__globalThis) {
/**
 * Per-slug session-scoped dismissal for CMS announcement items.
 * Marks dismissed items with `data-announcement-dismissed`; project CSS
 * owns visibility and any parent collapse (e.g. via `:has()`).
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/** Initialize announcement dismissal (idempotent). */ parcelHelpers.export(exports, "initAnnouncements", ()=>initAnnouncements);
const DISMISSED_STORAGE_KEY = "dismissed-announcements";
const ANNOUNCEMENT_SLUG_ATTR = "data-announcement-slug";
const DISMISSED_ATTR = "data-announcement-dismissed";
const ITEM_SELECTOR = '[data-announcement-element="item"]';
const DISMISS_SELECTOR = '[data-announcement-element="dismiss"]';
/** @returns {Set<string>} */ function readDismissedSlugs() {
    try {
        const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((s)=>typeof s === "string")) : new Set();
    } catch (_) {
        return new Set();
    }
}
/** @param {Set<string>} set */ function writeDismissedSlugs(set) {
    try {
        sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([
            ...set
        ]));
    } catch (_) {
    /* storage blocked — dismissal still applies for this page view */ }
}
const dismissedSlugs = readDismissedSlugs();
// Must run before DOM paint so dismissed items never flash.
(function injectDismissedHideStyles() {
    if (!dismissedSlugs.size) return;
    const rules = [
        ...dismissedSlugs
    ].map((slug)=>`[${ANNOUNCEMENT_SLUG_ATTR}="${CSS.escape(slug)}"]{display:none !important;}`).join("");
    const style = document.createElement("style");
    style.setAttribute("data-announcement-hide", "");
    style.textContent = rules;
    (document.head || document.documentElement).appendChild(style);
})();
function initAnnouncements() {
    document.querySelectorAll(ITEM_SELECTOR).forEach(initItem);
}
/** @param {Element} item */ function initItem(item) {
    const el = /** @type {HTMLElement} */ item;
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
    dismissButton.addEventListener("click", ()=>{
        dismissedSlugs.add(slug);
        writeDismissedSlugs(dismissedSlugs);
        el.setAttribute(DISMISSED_ATTR, "");
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAnnouncements, {
    once: true
});
else initAnnouncements();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"3xjKI":[function(require,module,exports,__globalThis) {
/**
 * Modal Component
 *
 * Activates `<dialog data-modal-element="dialog">` elements with Web Animations
 * API open/close animations. The `data-wf--modal--variant` attribute picks the
 * animation style — "side-panel", "full-screen", or default (centered).
 *
 * Triggers:
 *   - Elements: [data-modal-trigger="<id>"]
 *   - Anchors:  a[href="#<id>"]
 *   - URL:      ?modal-id=<id> on initial load (param is stripped after open)
 *
 * Optional integrations (detected at runtime — no hard dependency):
 *   - lenis for scroll-lock
 *
 * Exposes a global registry at `window.bruce.modal`:
 *   open(id), closeAll(), list (per-id { open, close })
 *
 * Webflow markup (style with whatever classes you want):
 *   <dialog data-modal-element="dialog"
 *           data-modal-target="my-id"
 *           data-wf--modal--variant="side-panel">
 *     <div data-modal-element="backdrop" data-modal-close></div>
 *     <div data-modal-element="content">
 *       <div data-modal-element="slot">…</div>
 *     </div>
 *   </dialog>
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Init ─────────────────────────────────────────────────────
/** Initialize all modal dialogs. Safe to call multiple times. */ parcelHelpers.export(exports, "initModals", ()=>initModals);
const M = {
    dialog: '[data-modal-element="dialog"]',
    backdrop: '[data-modal-element="backdrop"]',
    content: '[data-modal-element="content"]',
    slot: '[data-modal-element="slot"]'
};
const VARIANT = {
    SIDE_PANEL: "side-panel",
    FULL_SCREEN: "full-screen"
};
const EASING_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
// Per-variant animation specs in the OPEN direction. Each entry pairs an
// element with the keyframes that take it from its closed pose to its open
// pose. Closing reverses the same animations in place via playbackRate.
function buildSpecs(variant, backdrop, content, slot) {
    if (variant === VARIANT.SIDE_PANEL) return [
        backdrop && {
            el: backdrop,
            kf: [
                {
                    opacity: 0
                },
                {
                    opacity: 1
                }
            ],
            opts: {
                duration: 300,
                easing: EASING_OUT
            }
        },
        content && {
            el: content,
            kf: [
                {
                    transform: "translateX(100%)"
                },
                {
                    transform: "translateX(0)"
                }
            ],
            opts: {
                duration: 300,
                easing: EASING_OUT
            }
        }
    ].filter(Boolean);
    if (variant === VARIANT.FULL_SCREEN) return [
        // Backdrop stays hidden for full-screen — the content covers the viewport.
        backdrop && {
            el: backdrop,
            kf: [
                {
                    opacity: 0
                },
                {
                    opacity: 0
                }
            ],
            opts: {
                duration: 200
            }
        },
        content && {
            el: content,
            kf: [
                {
                    opacity: 0
                },
                {
                    opacity: 1
                }
            ],
            opts: {
                duration: 200,
                easing: EASING_OUT
            }
        },
        slot && {
            el: slot,
            kf: [
                {
                    opacity: 0,
                    transform: "translateY(2rem)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0)"
                }
            ],
            opts: {
                duration: 200,
                delay: 100,
                easing: EASING_OUT
            }
        }
    ].filter(Boolean);
    // default — centered. Subtle fade + small rise from below.
    return [
        backdrop && {
            el: backdrop,
            kf: [
                {
                    opacity: 0
                },
                {
                    opacity: 1
                }
            ],
            opts: {
                duration: 300,
                easing: EASING_OUT
            }
        },
        content && {
            el: content,
            kf: [
                {
                    opacity: 0,
                    transform: "translateY(8px) scale(0.97)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0) scale(1)"
                }
            ],
            opts: {
                duration: 300,
                easing: EASING_OUT
            }
        }
    ].filter(Boolean);
}
// ── Global registry ──────────────────────────────────────────
/** @type {any} */ window.bruce ||= {};
const modalSystem = /** @type {any} */ window.bruce.modal ??= {
    list: {},
    open (id) {
        this.list[id]?.open?.();
    },
    closeAll () {
        Object.values(this.list).forEach((m)=>m.close?.());
    }
};
// ── Delegated trigger click ──────────────────────────────────
// One document-level listener routes every [data-modal-trigger] / a[href="#id"]
// click to the matching modal — adding a per-modal listener inside initModals
// would multiply work on every page click.
let triggerListenerAttached = false;
function attachTriggerListener() {
    if (triggerListenerAttached) return;
    triggerListenerAttached = true;
    document.addEventListener("click", (e)=>{
        const target = /** @type {Element | null} */ e.target;
        if (!target) return;
        const trigger = target.closest("[data-modal-trigger], a[href^='#']");
        if (!trigger) return;
        const id = trigger.getAttribute("data-modal-trigger") || trigger.getAttribute("href")?.slice(1);
        if (!id || !modalSystem.list[id]) return;
        if (trigger.tagName === "A") e.preventDefault();
        modalSystem.open(id);
    });
}
function initModals() {
    attachTriggerListener();
    document.querySelectorAll(M.dialog).forEach((modal)=>{
        const el = /** @type {HTMLDialogElement} */ modal;
        if (el.dataset.scriptInitialized) return;
        el.dataset.scriptInitialized = "true";
        const modalId = el.getAttribute("data-modal-target");
        const variant = el.getAttribute("data-wf--modal--variant");
        const contentEl = /** @type {HTMLElement | null} */ el.querySelector(M.content);
        // Anchor the default-variant scale to the bottom edge so the content
        // rises upward into place. No effect on translate-only variants.
        if (contentEl) contentEl.style.transformOrigin = "center bottom";
        const specs = buildSpecs(variant, el.querySelector(M.backdrop), contentEl, el.querySelector(M.slot));
        const scrollResetEls = el.querySelectorAll("[data-modal-scroll]");
        let lastFocusedElement;
        /** @type {Animation[]} */ let animations = [];
        /** @type {"open" | "close" | null} */ let direction = null;
        // Bumped on every playClose so any stacked `.finished` handler from an
        // earlier call can detect that it's stale and bail — prevents resetModal
        // from running twice (duplicate modal-close events, duplicate focus).
        let closeToken = 0;
        const playOpen = ()=>{
            if (direction === "open") return;
            if (direction === "close") {
                animations.forEach((a)=>{
                    a.playbackRate = 1;
                });
                direction = "open";
                return;
            }
            animations = specs.map((s)=>s.el.animate(s.kf, {
                    ...s.opts,
                    fill: "forwards"
                }));
            direction = "open";
        };
        const playClose = (onComplete)=>{
            if (direction === "close") return; // an in-flight close handler will finish it
            if (direction === "open") animations.forEach((a)=>{
                a.playbackRate = -1;
            });
            else animations = specs.map((s)=>s.el.animate([
                    s.kf[1],
                    s.kf[0]
                ], {
                    ...s.opts,
                    fill: "forwards"
                }));
            direction = "close";
            if (animations.length === 0) {
                onComplete();
                return;
            }
            const myToken = ++closeToken;
            Promise.all(animations.map((a)=>a.finished.catch(()=>null))).then(()=>{
                if (myToken !== closeToken || direction !== "close") return;
                // Call onComplete (which hides the dialog) BEFORE cancelling so the
                // user never sees the brief frame where animation effects are
                // released but the dialog is still visible.
                onComplete();
                animations.forEach((a)=>a.cancel());
                animations = [];
                direction = null;
            });
        };
        function resetModal() {
            if (typeof lenis !== "undefined" && lenis.start) lenis.start();
            else document.body.style.overflow = "";
            el.close();
            if (lastFocusedElement) lastFocusedElement.focus();
            window.dispatchEvent(new CustomEvent("modal-close", {
                detail: {
                    modal: el
                }
            }));
        }
        function openModal() {
            if (typeof lenis !== "undefined" && lenis.stop) lenis.stop();
            else document.body.style.overflow = "hidden";
            lastFocusedElement = document.activeElement;
            el.showModal();
            playOpen();
            scrollResetEls.forEach((s)=>s.scrollTop = 0);
            window.dispatchEvent(new CustomEvent("modal-open", {
                detail: {
                    modal: el
                }
            }));
        }
        function closeModal() {
            playClose(resetModal);
        }
        // Open via ?modal-id=… on initial load, then strip the param.
        if (modalId && new URLSearchParams(location.search).get("modal-id") === modalId) {
            openModal();
            const url = new URL(location.href);
            url.searchParams.delete("modal-id");
            history.replaceState({}, "", url);
        }
        el.addEventListener("cancel", (e)=>{
            e.preventDefault();
            closeModal();
        });
        el.addEventListener("click", (e)=>{
            if (/** @type {Element} */ e.target.closest("[data-modal-close]")) closeModal();
        });
        if (modalId) modalSystem.list[modalId] = {
            open: openModal,
            close: closeModal
        };
    });
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initModals, {
    once: true
});
else initModals();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"0392A":[function(require,module,exports,__globalThis) {
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
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Init ─────────────────────────────────────────────────────
/** Initialize all accordion lists. Safe to call multiple times. */ parcelHelpers.export(exports, "initAccordion", ()=>initAccordion);
var _utilsJs = require("./utils.js");
const A = {
    list: '[data-accordion-element="list"]',
    item: '[data-accordion-element="item"]',
    toggle: '[data-accordion-element="toggle"]',
    content: '[data-accordion-element="content"]'
};
const DURATION_MS = 300;
const EASING = "ease-in-out";
function initAccordion() {
    document.querySelectorAll(A.list).forEach((listEl, listIndex)=>{
        const list = /** @type {HTMLElement} */ listEl;
        if (list.dataset.scriptInitialized) return;
        const closePrevious = (0, _utilsJs.attrBool)(list, "data-close-previous", true);
        const closeOnSecondClick = (0, _utilsJs.attrBool)(list, "data-close-on-second-click", true);
        const openOnHover = (0, _utilsJs.attrBool)(list, "data-open-on-hover");
        const openByDefault = (0, _utilsJs.attrNum)(list, "data-open-by-default", 0);
        let previousIndex = null;
        /** @type {Array<() => void>} */ const closeFunctions = [];
        (0, _utilsJs.flattenDisplayContents)(list);
        (0, _utilsJs.removeCMSList)(list);
        // Scope to items that belong to THIS list — skip items inside any nested list.
        const items = [
            ...list.querySelectorAll(A.item)
        ].filter((el)=>el.closest(A.list) === list);
        // Don't mark the list initialized if it has no items yet. An `fs-list-nest`
        // target is in the DOM at DOMContentLoaded but empty until Finsweet
        // hydrates it — marking it now would make the re-init hook below skip the
        // list once items finally arrive, leaving nested accordions unwired.
        if (items.length === 0) return;
        list.dataset.scriptInitialized = "true";
        items.forEach((item, itemIndex)=>{
            // Same scope discipline for toggle/content so a nested list's elements
            // don't get wired to this item.
            const button = [
                ...item.querySelectorAll(A.toggle)
            ].find((el)=>el.closest(A.item) === item);
            const content = [
                ...item.querySelectorAll(A.content)
            ].find((el)=>el.closest(A.item) === item);
            if (!button || !content) {
                console.warn("Missing elements:", item);
                return;
            }
            button.setAttribute("aria-expanded", "false");
            button.setAttribute("id", `accordion_button_${listIndex}_${itemIndex}`);
            content.setAttribute("id", `accordion_content_${listIndex}_${itemIndex}`);
            button.setAttribute("aria-controls", content.id);
            content.setAttribute("aria-labelledby", button.id);
            const contentEl = /** @type {HTMLElement} */ content;
            contentEl.style.display = "none";
            contentEl.style.overflow = "hidden";
            /** @type {Animation | null} */ let currentAnimation = null;
            // Commit the in-flight animation's current value to inline style, then
            // cancel it — lets the next animation resume from where this one was
            // visually, rather than snapping back to the underlying inline value.
            const stopCurrent = ()=>{
                if (!currentAnimation) return 0;
                try {
                    currentAnimation.commitStyles();
                } catch (_) {
                /* commitStyles fails if the element is detached — ignore */ }
                currentAnimation.cancel();
                currentAnimation = null;
                return parseFloat(contentEl.style.height) || 0;
            };
            const animateTo = (fromPx, toPx, onDone)=>{
                contentEl.style.height = `${fromPx}px`;
                const anim = contentEl.animate([
                    {
                        height: `${fromPx}px`
                    },
                    {
                        height: `${toPx}px`
                    }
                ], {
                    duration: DURATION_MS,
                    easing: EASING,
                    fill: "forwards"
                });
                currentAnimation = anim;
                anim.onfinish = ()=>{
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
                    /* commitStyles fails on detached elements — ignore */ }
                    anim.cancel();
                    onDone();
                };
            };
            const closeAccordion = ()=>{
                if (!item.classList.contains("is-active")) return;
                item.classList.remove("is-active");
                button.setAttribute("aria-expanded", "false");
                const from = currentAnimation ? stopCurrent() : contentEl.getBoundingClientRect().height;
                animateTo(from, 0, ()=>{
                    contentEl.style.height = "";
                    contentEl.style.display = "none";
                });
            };
            closeFunctions[itemIndex] = closeAccordion;
            const openAccordion = (instant = false)=>{
                if (closePrevious && previousIndex !== null && previousIndex !== itemIndex) closeFunctions[previousIndex]?.();
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
                animateTo(from, to, ()=>{
                    contentEl.style.height = "";
                });
            };
            if (openByDefault === itemIndex + 1) openAccordion(true);
            button.addEventListener("click", ()=>{
                if (item.classList.contains("is-active") && closeOnSecondClick) {
                    closeAccordion();
                    previousIndex = null;
                } else openAccordion();
            });
            if (openOnHover) button.addEventListener("mouseenter", ()=>openAccordion());
        });
    });
}
// ── Finsweet integration ─────────────────────────────────────
// Re-init accordions once Finsweet has populated CMS lists. Without this,
// nested accordions hydrated via fs-list-nest never get wired — the outer
// list is in the DOM at DOMContentLoaded, the inner ones aren't.
/** @type {any} */ window.FinsweetAttributes ||= [];
/** @type {any} */ window.FinsweetAttributes.push([
    "list",
    /** @param {Array<{loadingPromise?: Promise<unknown>}>} lists */ (lists)=>{
        Promise.all(lists.map((l)=>l.loadingPromise || Promise.resolve())).then(initAccordion);
    }
]);
// ── MutationObserver: catch dynamic content from other sources ───
// Handles cases where accordion lists appear via non-Finsweet means
// (manual JS, Webflow CMS pagination, modal mounts, etc.). Debounced via
// rAF to coalesce bulk DOM inserts. The init's `data-script-initialized`
// guard already skips lists that are already wired.
let mutationRafId = 0;
let pendingMutations = false;
const processMutations = ()=>{
    mutationRafId = 0;
    if (!pendingMutations) return;
    pendingMutations = false;
    initAccordion();
};
const scheduleMutationProcess = ()=>{
    pendingMutations = true;
    if (mutationRafId) return;
    mutationRafId = requestAnimationFrame(processMutations);
};
const TRIGGER_SELECTOR = `${A.list}, ${A.item}`;
const mutationObserver = new MutationObserver((mutations)=>{
    for (const m of mutations)for (const node of m.addedNodes){
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ node;
        // Match items OR lists, on self OR descendants. Finsweet's `fs-list-nest`
        // injects ITEMS into an already-existing list, so listening for new
        // lists alone misses that case — and a `closest()` check would
        // short-circuit on the outer already-initialized list.
        const trigger = el.matches?.(TRIGGER_SELECTOR) || el.querySelector?.(TRIGGER_SELECTOR);
        if (trigger) {
            scheduleMutationProcess();
            return;
        }
    }
});
mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
});
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAccordion, {
    once: true
});
else initAccordion();

},{"./utils.js":"en4he","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"fkbji":[function(require,module,exports,__globalThis) {
/**
 * Collapsible Component
 *
 * Independent expand/collapse region. Each `.collapsible_wrap` owns a single
 * `.collapsible_trigger` and a single `.collapsible_content`. Clicking the
 * trigger toggles the content with a Web Animations API height tween.
 *
 * For grouped expand/collapse with "close previous" behavior, use
 * `accordion.js` instead — this module intentionally has no group logic.
 *
 * Per-wrap data attributes (all optional, all on `.collapsible_wrap`):
 *   - data-open-by-default="True"   start in the open state (no animation)
 *   - data-open-on-hover="True"     mouseenter on trigger also opens
 *                                    (close still requires a click)
 *   - data-duration="<seconds>"     override animation duration (default 0.3)
 *   - data-collapsible-id="<key>"   broadcast the `is-active` class onto every
 *                                    `[data-component="collapsible"]
 *                                     [data-collapsible-id="<key>"]` element
 *                                    on the page (one-way mirror, for styling)
 *
 * Nesting: a `.collapsible_wrap` inside another wrap's `.collapsible_content`
 * works — each wrap resolves only its own direct trigger and content, so
 * nested triggers don't toggle the outer wrap.
 *
 * Webflow markup:
 *   <div class="collapsible_wrap"
 *        data-open-by-default="True"
 *        data-open-on-hover="True"
 *        data-duration="0.4"
 *        data-collapsible-id="faq-1">
 *     <button class="collapsible_trigger">…</button>
 *     <div class="collapsible_content">…</div>
 *   </div>
 *
 *   <!-- anywhere else on the page -->
 *   <div data-component="collapsible" data-collapsible-id="faq-1">…</div>
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Init ─────────────────────────────────────────────────────
/** Initialize all `.collapsible_wrap` elements. Safe to call multiple times. */ parcelHelpers.export(exports, "initCollapsible", ()=>initCollapsible);
var _utilsJs = require("./utils.js");
// ── Module-level constants ───────────────────────────────────
const DEFAULT_DURATION_S = 0.3;
const EASING = "ease-in-out";
function initCollapsible() {
    document.querySelectorAll(".collapsible_wrap").forEach((wrapEl, wrapIndex)=>{
        const wrap = /** @type {HTMLElement} */ wrapEl;
        if (wrap.dataset.scriptInitialized) return;
        wrap.dataset.scriptInitialized = "true";
        // Resolve the trigger/content that belong to THIS wrap — skip any
        // descendants that live inside a nested .collapsible_wrap.
        const own = (selector)=>[
                ...wrap.querySelectorAll(selector)
            ].find((el)=>el.closest(".collapsible_wrap") === wrap);
        const trigger = /** @type {HTMLElement | undefined} */ own(".collapsible_trigger");
        const content = /** @type {HTMLElement | undefined} */ own(".collapsible_content");
        if (!trigger || !content) {
            console.warn("Missing elements:", wrap);
            return;
        }
        const openByDefault = (0, _utilsJs.attrBool)(wrap, "data-open-by-default");
        const openOnHover = (0, _utilsJs.attrBool)(wrap, "data-open-on-hover");
        const rawDuration = (0, _utilsJs.attrNum)(wrap, "data-duration", DEFAULT_DURATION_S);
        const durationMs = (rawDuration > 0 ? rawDuration : DEFAULT_DURATION_S) * 1000;
        trigger.id = `collapsible_trigger_${wrapIndex}`;
        content.id = `collapsible_content_${wrapIndex}`;
        trigger.setAttribute("aria-controls", content.id);
        content.setAttribute("aria-labelledby", trigger.id);
        trigger.setAttribute("aria-expanded", "false");
        content.style.display = "none";
        content.style.overflow = "hidden";
        // Re-query on each transition so mirrors injected later (CMS, modals,
        // etc.) still pick up state changes. Selector is built once at init.
        const mirrorId = wrap.getAttribute("data-collapsible-id");
        const mirrorSelector = mirrorId ? `[data-component="collapsible"][data-collapsible-id="${CSS.escape(mirrorId)}"]` : null;
        const getMirrors = ()=>mirrorSelector ? document.querySelectorAll(mirrorSelector) : [];
        /** @type {Animation | null} */ let currentAnimation = null;
        // Commit the in-flight animation's current value to inline style, then
        // cancel it — lets the next animation resume from where this one was
        // visually, rather than snapping back to the underlying inline value.
        const stopCurrent = ()=>{
            if (!currentAnimation) return 0;
            try {
                currentAnimation.commitStyles();
            } catch (_) {
            /* commitStyles fails if the element is detached — ignore */ }
            currentAnimation.cancel();
            currentAnimation = null;
            return parseFloat(content.style.height) || 0;
        };
        const animateTo = (fromPx, toPx, onDone)=>{
            content.style.height = `${fromPx}px`;
            const anim = content.animate([
                {
                    height: `${fromPx}px`
                },
                {
                    height: `${toPx}px`
                }
            ], {
                duration: durationMs,
                easing: EASING,
                fill: "forwards"
            });
            currentAnimation = anim;
            anim.onfinish = ()=>{
                if (currentAnimation !== anim) return;
                currentAnimation = null;
                onDone();
            };
        };
        const open = (instant = false)=>{
            wrap.classList.add("is-active");
            trigger.setAttribute("aria-expanded", "true");
            getMirrors().forEach((m)=>m.classList.add("is-active"));
            const from = stopCurrent();
            content.style.display = "block";
            if (instant) {
                content.style.height = "";
                return;
            }
            content.style.height = "auto";
            const to = content.scrollHeight;
            animateTo(from, to, ()=>{
                content.style.height = "";
            });
        };
        const close = ()=>{
            if (!wrap.classList.contains("is-active")) return;
            wrap.classList.remove("is-active");
            trigger.setAttribute("aria-expanded", "false");
            getMirrors().forEach((m)=>m.classList.remove("is-active"));
            const from = currentAnimation ? stopCurrent() : content.getBoundingClientRect().height;
            animateTo(from, 0, ()=>{
                content.style.height = "";
                content.style.display = "none";
            });
        };
        const toggle = ()=>{
            if (wrap.classList.contains("is-active")) close();
            else open();
        };
        if (openByDefault) open(true);
        trigger.addEventListener("click", toggle);
        if (openOnHover) trigger.addEventListener("mouseenter", ()=>open());
    });
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initCollapsible, {
    once: true
});
else initCollapsible();

},{"./utils.js":"en4he","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"6GCUi":[function(require,module,exports,__globalThis) {
/**
 * Dropdown Component
 *
 * Single togglable dropdown region with an animated open/close, click-outside
 * dismissal, Escape key support, and ArrowUp/ArrowDown navigation through
 * focusable items inside the content panel.
 *
 * Per-wrap data attributes (all optional, all on the wrap):
 *   - data-open-on-hover-in="true"     mouseenter on the wrap opens it
 *   - data-close-on-hover-out="true"   mouseleave on the wrap closes it
 *
 * Webflow markup (style with whatever classes you want):
 *   <div data-dropdown-element="wrap"
 *        data-open-on-hover-in="true"
 *        data-close-on-hover-out="true">
 *     <button data-dropdown-element="toggle">…</button>
 *     <div data-dropdown-element="content">
 *       <a href="…">Item 1</a>
 *       <a href="…">Item 2</a>
 *     </div>
 *   </div>
 *
 * Nested dropdowns work — each wrap resolves only its own direct toggle and
 * content, so nested toggles don't toggle the outer wrap.
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Init ─────────────────────────────────────────────────────
/** Initialize all dropdown wraps. Safe to call multiple times. */ parcelHelpers.export(exports, "initDropdown", ()=>initDropdown);
var _utilsJs = require("./utils.js");
const A = {
    wrap: '[data-dropdown-element="wrap"]',
    toggle: '[data-dropdown-element="toggle"]',
    content: '[data-dropdown-element="content"]'
};
const DURATION_MS = 200;
const EASING = "ease-out";
const FOCUSABLE_ITEM_SELECTOR = "a, button";
// Visual entry state — alongside the height tween, content fades in, slides
// up from `TRANSLATE_CLOSED` below its resting position, and scales from
// `SCALE_CLOSED`. transform-origin is set to "top" at init so the scale
// anchors under the toggle rather than at the box's center.
const SCALE_CLOSED = 0.97;
const TRANSLATE_CLOSED_PX = 8;
const CLOSED_OPACITY = "0";
const CLOSED_TRANSFORM = `translateY(${TRANSLATE_CLOSED_PX}px) scale(${SCALE_CLOSED})`;
const OPEN_OPACITY = "1";
const OPEN_TRANSFORM = "translateY(0px) scale(1)";
// Dynamic stacking — each open bumps the wrap above any already-animating
// peers so the newly-opening dropdown always sits on top of the one still
// closing underneath it. Counter resets to 0 when every dropdown is closed.
const Z_BASE = 1000;
let zCounter = 0;
/**
 * @typedef {{ wrap: HTMLElement, toggle: HTMLElement, close: () => void, focusableItems: HTMLElement[] }} ActiveDropdown
 */ // Only one dropdown can be open at a time, so a single reference is enough —
// no need to scan a registry on every page click and keystroke.
/** @type {ActiveDropdown | null} */ let activeDropdown = null;
// ── Shared document listeners (attached once) ────────────────
let documentListenersAttached = false;
function attachDocumentListeners() {
    if (documentListenersAttached) return;
    documentListenersAttached = true;
    document.addEventListener("click", (e)=>{
        if (!activeDropdown) return;
        const target = /** @type {Element | null} */ e.target;
        if (target && !activeDropdown.wrap.contains(target)) activeDropdown.close();
    });
    document.addEventListener("keydown", (e)=>{
        if (!activeDropdown) return;
        if (e.key === "Escape") {
            const { toggle, close } = activeDropdown;
            close();
            toggle.focus();
            return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const focused = /** @type {Element | null} */ document.activeElement;
        if (!focused || !activeDropdown.wrap.contains(focused)) return;
        const items = activeDropdown.focusableItems;
        if (!items.length) return;
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const currentIndex = items.indexOf(/** @type {HTMLElement} */ focused);
        const nextIndex = currentIndex === -1 ? step === 1 ? 0 : items.length - 1 : (currentIndex + step + items.length) % items.length;
        items[nextIndex].focus();
    });
}
const allClosed = ()=>activeDropdown === null;
function initDropdown() {
    attachDocumentListeners();
    document.querySelectorAll(A.wrap).forEach((wrapEl, wrapIndex)=>{
        const wrap = /** @type {HTMLElement} */ wrapEl;
        if (wrap.dataset.scriptInitialized) return;
        wrap.dataset.scriptInitialized = "true";
        // Resolve the toggle/content that belong to THIS wrap — skip any
        // descendants that live inside a nested wrap.
        const own = (selector)=>[
                ...wrap.querySelectorAll(selector)
            ].find((el)=>el.closest(A.wrap) === wrap);
        const toggle = /** @type {HTMLElement | undefined} */ own(A.toggle);
        const content = /** @type {HTMLElement | undefined} */ own(A.content);
        if (!toggle || !content) {
            console.warn("Missing elements:", wrap);
            return;
        }
        const openOnHoverIn = (0, _utilsJs.attrBool)(wrap, "data-open-on-hover-in");
        const closeOnHoverOut = (0, _utilsJs.attrBool)(wrap, "data-close-on-hover-out");
        toggle.id = `dropdown_toggle_${wrapIndex}`;
        content.id = `dropdown_content_${wrapIndex}`;
        toggle.setAttribute("aria-controls", content.id);
        toggle.setAttribute("aria-expanded", "false");
        content.setAttribute("aria-labelledby", toggle.id);
        content.style.display = "none";
        content.style.transformOrigin = "top";
        /** @type {Animation | null} */ let currentAnimation = null;
        // Snapshot whatever the in-flight animation is currently rendering, commit
        // those values to inline style, then cancel — lets the next animation
        // resume from the visible state instead of snapping to a default.
        const snapshotAndStop = ()=>{
            if (!currentAnimation) return null;
            try {
                currentAnimation.commitStyles();
            } catch (_) {
            /* commitStyles fails if the element is detached — ignore */ }
            currentAnimation.cancel();
            currentAnimation = null;
            return {
                height: parseFloat(content.style.height) || 0,
                opacity: content.style.opacity || OPEN_OPACITY,
                transform: content.style.transform || OPEN_TRANSFORM
            };
        };
        const animateTo = (from, to, onDone)=>{
            // Clip during the animation only — children that should overflow
            // (submenus, focus rings) need to escape once the dropdown is open.
            content.style.overflow = "hidden";
            // Inline-style the from state so a mid-flight cancel reverts cleanly.
            content.style.height = `${from.height}px`;
            content.style.opacity = from.opacity;
            content.style.transform = from.transform;
            const anim = content.animate([
                {
                    height: `${from.height}px`,
                    opacity: from.opacity,
                    transform: from.transform
                },
                {
                    height: `${to.height}px`,
                    opacity: to.opacity,
                    transform: to.transform
                }
            ], {
                duration: DURATION_MS,
                easing: EASING,
                fill: "forwards"
            });
            currentAnimation = anim;
            anim.onfinish = ()=>{
                if (currentAnimation !== anim) return;
                currentAnimation = null;
                onDone();
                // Release the forwards fill so the element renders from inline+cascade
                // again — otherwise height stays locked to the value measured at
                // animation start, clipping any content that grew afterward.
                anim.cancel();
            };
        };
        const clearInlineState = ()=>{
            content.style.height = "";
            content.style.opacity = "";
            content.style.transform = "";
        };
        const isOpen = ()=>toggle.getAttribute("aria-expanded") === "true";
        const open = ()=>{
            if (isOpen()) return;
            // Only one dropdown open at a time — sidesteps z-index conflicts when
            // two open menus would otherwise stack by document order.
            if (activeDropdown && activeDropdown.wrap !== wrap) activeDropdown.close();
            // Lift above any peer that's still animating closed so it can't
            // overlap visually during the parallel close/open.
            zCounter += 1;
            wrap.style.zIndex = String(Z_BASE + zCounter);
            wrap.classList.add("is-active");
            toggle.setAttribute("aria-expanded", "true");
            const from = snapshotAndStop() || {
                height: 0,
                opacity: CLOSED_OPACITY,
                transform: CLOSED_TRANSFORM
            };
            content.style.display = "block";
            content.style.height = "auto";
            const toHeight = content.scrollHeight;
            activeDropdown = {
                wrap,
                toggle,
                close,
                focusableItems: /** @type {HTMLElement[]} */ [
                    ...content.querySelectorAll(FOCUSABLE_ITEM_SELECTOR)
                ]
            };
            animateTo(from, {
                height: toHeight,
                opacity: OPEN_OPACITY,
                transform: OPEN_TRANSFORM
            }, ()=>{
                clearInlineState();
                // Let descendants overflow once the dropdown is settled open.
                content.style.overflow = "";
            });
        };
        const close = ()=>{
            if (!isOpen()) return;
            wrap.classList.remove("is-active");
            toggle.setAttribute("aria-expanded", "false");
            if (activeDropdown && activeDropdown.wrap === wrap) activeDropdown = null;
            const from = snapshotAndStop() || {
                height: content.getBoundingClientRect().height,
                opacity: OPEN_OPACITY,
                transform: OPEN_TRANSFORM
            };
            animateTo(from, {
                height: 0,
                opacity: CLOSED_OPACITY,
                transform: CLOSED_TRANSFORM
            }, ()=>{
                clearInlineState();
                content.style.display = "none";
                wrap.style.zIndex = "";
                if (allClosed()) zCounter = 0;
            });
        };
        toggle.addEventListener("click", ()=>{
            isOpen() ? close() : open();
        });
        if (openOnHoverIn) wrap.addEventListener("mouseenter", open);
        if (closeOnHoverOut) wrap.addEventListener("mouseleave", close);
    });
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDropdown, {
    once: true
});
else initDropdown();

},{"./utils.js":"en4he","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"1KIEs":[function(require,module,exports,__globalThis) {
/**
 * Variables (Placeholder Replacement)
 *
 * Replaces {{key}} placeholders in text and common attributes across the page.
 * Supports scoped (per-ancestor) and global variables.
 *
 * Two namespaces:
 *   • `$`-prefixed keys (built-in dynamics like {{$year}}) resolve only
 *     against the module-level globals map — never the ancestor chain.
 *   • Everything else: nearest ancestor `data-var-{key}` wins, falling
 *     back to a `[data-variable-key]` element anywhere on the page.
 *
 * Unknown keys are left as-is so typos are visible in the published site.
 *
 * Usage in Webflow:
 *
 *   Global values (place anywhere — typically inside a hidden CMS collection):
 *     <div data-variable-key="company-name" data-variable-value="Bruce Studios"></div>
 *     <div data-variable-key="phone" data-variable-value="+46 31 ..."></div>
 *
 *   Scoped values — must use the data-var-* prefix so generic Webflow data
 *   attributes (data-loop, data-src, ...) can't collide with placeholders:
 *     <div data-var-author-name="Johan Andersson">
 *       <p>{{author-name}}</p>  →  Johan Andersson
 *     </div>
 *
 *   Built-in dynamics — reserved `$` prefix isolates them from user keys:
 *     <p>© {{$year}}</p>
 *
 *   Anywhere in text content:
 *     <p>Welcome to {{company-name}}. © {{$year}}</p>
 *
 *   In attributes (href, src, alt, title, aria-label, placeholder, value):
 *     <a href="mailto:{{email}}">Contact</a>
 *
 * Handles late-arriving content (Finsweet List Nest, async injection) via a
 * debounced re-scan + delayed safety passes.
 *
 * Loaded globally — no external dependencies.
 */ // ── Module-level constants ───────────────────────────────────
// Keys allow `$` so built-in dynamics like {{$year}} live in a reserved
// namespace that can't be shadowed by CMS-defined variables.
// PATTERN is `/g` (used by String.replace); HAS_PATTERN is the same expression
// without `/g` for stateless `.test()` checks — calling `.test()` on a `/g`
// regex advances lastIndex and can return inconsistent results across calls.
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Public API ───────────────────────────────────────────────
/**
 * Initialize variable replacement: load globals + run an initial pass.
 * Safe to call multiple times.
 */ parcelHelpers.export(exports, "initVariables", ()=>initVariables);
/**
 * Manually trigger a re-scan (e.g. after injecting custom dynamic content).
 */ parcelHelpers.export(exports, "refreshVariables", ()=>refreshVariables);
/**
 * Programmatically set a global variable. Useful for runtime values
 * (user state, A/B test variant, geo) that can't live in CMS. Triggers
 * a full-document re-scan, so batch calls when possible.
 *
 * @param {string} key
 * @param {string} value
 */ parcelHelpers.export(exports, "setGlobal", ()=>setGlobal);
const PATTERN = /\{\{\s*([\$\w-]+)\s*\}\}/g;
const HAS_PATTERN = /\{\{\s*[\$\w-]+\s*\}\}/;
const BUILTIN_PREFIX = "$";
const ATTRS = [
    "href",
    "src",
    "alt",
    "title",
    "aria-label",
    "placeholder",
    "value"
];
const ATTR_SELECTOR = ATTRS.map((a)=>`[${a}*="{{"]`).join(",");
const SAFETY_PASS_DELAYS = [
    500,
    1500,
    3500
]; // ms
// Globals are seeded with `$`-prefixed built-ins so user-defined CMS keys
// can never shadow them. Populated further from [data-variable-key] on each
// pass to catch late-loaded items.
/** @type {Record<string, string>} */ const globals = {
    $year: String(new Date().getFullYear())
};
// Originals of text nodes and attributes that ever contained {{...}}. process()
// always substitutes from the stored template, never from the current value —
// so calling setGlobal() after the first pass actually re-renders. Without
// this, the first pass would overwrite the placeholders and any subsequent
// re-scan would find nothing to replace.
/** @type {WeakMap<Text, string>} */ const textTemplates = new WeakMap();
/** @type {Map<Element, Record<string, string>>} */ const attrTemplates = new Map();
/**
 * Load global key/value pairs from any [data-variable-key] element on
 * the page. Idempotent — re-runs on each pass to catch late-loaded items.
 */ function loadGlobals() {
    document.querySelectorAll("[data-variable-key]").forEach((el)=>{
        const key = el.getAttribute("data-variable-key");
        const value = el.getAttribute("data-variable-value");
        // First definition wins. Built-ins ($-prefixed) are seeded first so they
        // can't be silently replaced by a CMS item with the same key.
        if (key && !(key in globals)) globals[key] = value ?? "";
    });
}
/**
 * Resolve a {{key}} reference against scoped + global sources.
 *
 * Reserved-prefix keys (starting with `$`) are built-ins and bypass the
 * ancestor walk — they only resolve against the globals map.
 *
 * @param {string} key
 * @param {Node} node
 * @returns {string | null} The replacement value, or null if unresolved.
 */ function resolve(key, node) {
    if (key.startsWith(BUILTIN_PREFIX)) return key in globals ? globals[key] : null;
    const scopedAttr = `data-var-${key}`;
    /** @type {Element | null} */ let el = node.nodeType === 1 ? /** @type {Element} */ node : node.parentElement;
    while(el){
        if (el.hasAttribute(scopedAttr)) return el.getAttribute(scopedAttr) ?? "";
        el = el.parentElement;
    }
    return key in globals ? globals[key] : null;
}
/**
 * Build a replacer function bound to a specific node for scope resolution.
 *
 * @param {Node} node
 * @returns {(match: string, key: string) => string}
 */ function replacer(node) {
    return (match, key)=>{
        const value = resolve(key, node);
        return value !== null ? value : match; // leave unresolved keys visible
    };
}
// ── Core processing ──────────────────────────────────────────
/**
 * Scan the entire document body and replace any {{key}} placeholders found.
 * Idempotent: nothing without {{...}} is touched, so multiple passes are safe.
 *
 * Always scans from document.body rather than from MutationObserver-supplied
 * subtrees — Finsweet often inserts a parent container, then populates its
 * children in subsequent mutations. A full-body scan sidesteps that race.
 */ function process() {
    // Accept a text node if it currently contains {{...}} (first-pass discovery)
    // OR if it's already tracked (so we revisit it on every re-scan to honour
    // updated globals — without this, a re-scan after substitution would skip
    // the node and setGlobal() couldn't reactively update the page).
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n)=>{
            const tn = /** @type {Text} */ n;
            return HAS_PATTERN.test(n.nodeValue || "") || textTemplates.has(tn) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });
    /** @type {Text[]} */ const textNodes = [];
    let n;
    while(n = walker.nextNode())textNodes.push(/** @type {Text} */ n);
    for (const tn of textNodes){
        let tmpl = textTemplates.get(tn);
        if (tmpl === undefined) {
            tmpl = tn.nodeValue || "";
            textTemplates.set(tn, tmpl);
        }
        const next = tmpl.replace(PATTERN, replacer(tn));
        if (next !== tn.nodeValue) tn.nodeValue = next;
    }
    // Attribute scan: union of elements that currently contain `{{` (first-pass
    // discovery) with elements we've previously tracked (so re-scans pick them
    // up after their attribute has been substituted and no longer matches the
    // `[attr*="{{"]` selector).
    /** @type {Set<Element>} */ const elementsToProcess = new Set(document.querySelectorAll(ATTR_SELECTOR));
    for (const el of attrTemplates.keys())elementsToProcess.add(el);
    for (const el of elementsToProcess){
        let originals = attrTemplates.get(el);
        for (const attr of ATTRS){
            const cur = el.getAttribute(attr);
            if (cur === null) continue;
            if (!originals || !(attr in originals)) {
                if (!cur.includes("{{")) continue;
                if (!originals) {
                    originals = {};
                    attrTemplates.set(el, originals);
                }
                originals[attr] = cur;
            }
            const next = originals[attr].replace(PATTERN, replacer(el));
            if (next !== cur) el.setAttribute(attr, next);
        }
    }
}
// ── Debounced re-process ─────────────────────────────────────
// Any relevant DOM change schedules a single rAF-deferred re-scan, so a
// burst of Finsweet mutations triggers one pass instead of N. `dirty` lets
// the safety-pass timers skip their work on pages that have settled.
let pendingRafId = 0;
let dirty = false;
const runProcess = ()=>{
    loadGlobals(); // in case the globals list itself was Finsweet-managed
    process();
    dirty = false;
};
const scheduleProcess = ()=>{
    dirty = true;
    if (pendingRafId) return;
    pendingRafId = requestAnimationFrame(()=>{
        pendingRafId = 0;
        runProcess();
    });
};
/**
 * Cheap pre-filter for the MutationObserver: only re-process if the added
 * subtree could plausibly affect placeholder resolution. Skips the constant
 * DOM churn from sliders, tabs, video players, etc.
 *
 * @param {Node} node
 */ function subtreeIsRelevant(node) {
    if (node.nodeType === 3) return (node.nodeValue || "").includes("{{");
    if (node.nodeType !== 1) return false;
    const el = /** @type {Element} */ node;
    // Text-content placeholders are the common case.
    if ((el.textContent || "").includes("{{")) return true;
    // Attribute placeholders + new [data-variable-key] definitions are rarer
    // but possible — one CSS engine call each.
    if (el.matches(ATTR_SELECTOR) || el.querySelector(ATTR_SELECTOR)) return true;
    if (el.matches("[data-variable-key]") || el.querySelector("[data-variable-key]")) return true;
    return false;
}
function initVariables() {
    runProcess();
}
function refreshVariables() {
    scheduleProcess();
}
function setGlobal(key, value) {
    globals[key] = value;
    scheduleProcess();
}
// ── MutationObserver: catch late-arriving content ────────────
const mutationObserver = new MutationObserver((mutations)=>{
    for (const m of mutations){
        for (const node of m.addedNodes)if (subtreeIsRelevant(node)) {
            scheduleProcess();
            return;
        }
    }
});
// ── Auto-boot ────────────────────────────────────────────────
const boot = ()=>{
    initVariables();
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    SAFETY_PASS_DELAYS.forEach((ms)=>setTimeout(()=>{
            if (dirty) runProcess();
        }, ms));
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {
    once: true
});
else boot();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"alcnd":[function(require,module,exports,__globalThis) {
/**
 * City Context
 *
 * Tracks the current city (persisted in localStorage). The list of cities and
 * every per-city value is read from a hidden CMS Collection List in the DOM,
 * so editors add cities or new per-city fields without touching code.
 *
 * ── CMS setup ────────────────────────────────────────────────
 * One hidden Collection List, typically placed inside a global Symbol so it
 * ships on every page. Custom attributes are bound directly on the Collection
 * Item (the `.w-dyn-item` element) — no inner wrapper needed:
 *
 *   <div data-city-list style="display:none" aria-hidden="true">
 *     <!-- Collection List → Collection Item, with custom attributes: -->
 *     <!--
 *       data-city-slug="{Slug}"
 *       data-city-name="{Name}"
 *       data-city-default="{Is Default}"
 *       data-city-var-studio-count="{Studio Count}"
 *       data-city-var-phone="{Phone}"
 *     -->
 *   </div>
 *
 * Three reserved attributes per item:
 *   data-city-slug    identifier (required)
 *   data-city-name    display name (required)
 *   data-city-default "True"/"true" marks the fallback city
 *
 * Any other attribute prefixed `data-city-var-` is treated as a per-city
 * variable. The substring after the prefix is the placeholder key, so
 * `data-city-var-studio-count="4"` makes {{studio-count}} render "4"
 * when that city is active.
 *
 * ── Placeholder integration ──────────────────────────────────
 * On activation, every var attribute is pushed into the variables module via
 * setGlobal(). That triggers a debounced re-process, so {{key}} placeholders
 * across the page flip in one rAF. Also seeds two reserved keys:
 *   {{city}}       current city slug
 *   {{city-name}}  display name
 *
 * ── Switcher UI ──────────────────────────────────────────────
 * Any element with data-set-city="<slug>" becomes a switcher:
 *   <button data-set-city="cph">Copenhagen</button>
 * Delegated handlers cover static + Finsweet-injected switchers. The active
 * switcher is flagged with data-city-active="true" for styling.
 *
 * ── Programmatic API ─────────────────────────────────────────
 *   window.bruce.city.get()        → "sto"
 *   window.bruce.city.set("cph")   → switch, persist, re-render
 *   window.bruce.city.all()        → [{slug, name, isDefault, coords, vars}, ...]
 *                                    coords is [lng, lat] if data-city-var-lat
 *                                    and data-city-var-lng are both set, else null.
 *   window.bruce.city.onChange(fn) → subscribe; returns unsubscribe
 *
 * ── Related ──────────────────────────────────────────────────
 * `data-city-show="<slug-or-name>[,...]"` toggles element visibility
 * based on the active city — see src/city-visibility.js.
 */ var _variablesJs = require("./variables.js");
var _utilsJs = require("./utils.js");
const STORAGE_KEY = "bruce-city";
const LIST_SELECTOR = "[data-city-list]";
const VAR_PREFIX = "data-city-var-";
const SAFETY_PASS_DELAYS = [
    500,
    1500,
    3500
];
/** @type {Set<(slug: string) => void>} */ const listeners = new Set();
/** @type {Array<{slug: string, name: string, isDefault: boolean, coords: [number, number] | null, vars: Record<string, string>}>} */ let cities = [];
/** @type {Set<string>} */ let knownVarKeys = new Set();
/** @type {string | null} */ let current = null;
const hasCity = (slug)=>cities.some((c)=>c.slug === slug);
// ── Load city list from CMS ──────────────────────────────────
function loadCities() {
    const next = [];
    const nextVarKeys = new Set();
    document.querySelectorAll(`${LIST_SELECTOR} [data-city-slug]`).forEach((el)=>{
        const slug = el.getAttribute("data-city-slug");
        if (!slug) return;
        /** @type {Record<string, string>} */ const vars = {};
        for (const attr of el.attributes){
            if (!attr.name.startsWith(VAR_PREFIX)) continue;
            const key = attr.name.slice(VAR_PREFIX.length);
            vars[key] = attr.value;
            nextVarKeys.add(key);
        }
        // lat/lng come in as `data-city-var-*` strings; parse once here so
        // consumers get a typed [lng, lat] tuple (Mapbox convention) and a
        // missing-or-invalid pair surfaces as null.
        const lat = parseFloat(vars.lat);
        const lng = parseFloat(vars.lng);
        const coords = isNaN(lat) || isNaN(lng) ? null : [
            lng,
            lat
        ];
        next.push({
            slug,
            name: el.getAttribute("data-city-name") ?? "",
            isDefault: (0, _utilsJs.attrBool)(/** @type {HTMLElement} */ el, "data-city-default"),
            coords,
            vars
        });
    });
    cities = next;
    knownVarKeys = nextVarKeys;
}
// ── Pick the initial city ────────────────────────────────────
// Priority: URL param → persisted choice → page-level override → CMS default → first city.
// URL param wins over the persisted choice so a `?city=<name>` deep link lands
// the map on that city instead of the visitor's saved city. Transient: not
// written back to localStorage. Match is permissive: trim + case-insensitive on
// slug AND name, so editor whitespace in CMS fields and varying URL casing
// don't break the lookup. Every match is returned so studios.js can fit the
// camera to all of them.
//
// Primary format is the clean param from studios-search-redirect.js — repeated
// `city=` keys (`?city=Bergen&city=Oslo`).
function parseFilterValues(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.map(String);
    } catch  {
    // Malformed JSON — fall through to comma-split below.
    }
    return trimmed.split(",");
}
function citiesFromUrl() {
    const sp = new URLSearchParams(location.search);
    let raw = sp.getAll("city");
    const values = raw.map((s)=>s.trim().toLowerCase()).filter(Boolean);
    if (values.length === 0) return [];
    const matched = [];
    const missed = [];
    for (const value of values){
        const match = cities.find((c)=>c.slug.trim().toLowerCase() === value || c.name.trim().toLowerCase() === value);
        if (match) matched.push(match);
        else missed.push(value);
    }
    if (missed.length) console.warn(`[bruce.city] URL city filter \u{2014} these values matched no city:`, missed, "Known cities:", cities.map((c)=>({
            slug: c.slug,
            name: c.name
        })));
    return matched;
}
function cityFromUrl() {
    return citiesFromUrl()[0]?.slug ?? null;
}
function getInitialCity() {
    const fromUrl = cityFromUrl();
    if (fromUrl) return fromUrl;
    let stored = null;
    try {
        stored = localStorage.getItem(STORAGE_KEY);
    } catch  {
    // localStorage can throw in private mode or with strict cookie policies.
    }
    if (stored && hasCity(stored)) return stored;
    const pageDefault = document.body?.dataset.defaultCity;
    if (pageDefault && hasCity(pageDefault)) return pageDefault;
    return cities.find((c)=>c.isDefault)?.slug ?? cities[0]?.slug ?? null;
}
// ── Activation ───────────────────────────────────────────────
// Push the active city's vars into the variables module. Any key declared by
// some other city but missing on this one is emitted as an empty string, so a
// switch doesn't leave stale values from the previous city visible.
function applyCity(slug) {
    const city = cities.find((c)=>c.slug === slug);
    if (!city) return;
    const slugChanged = slug !== current;
    current = slug;
    (0, _variablesJs.setGlobal)("city", city.slug);
    (0, _variablesJs.setGlobal)("city-name", city.name);
    for (const key of knownVarKeys)(0, _variablesJs.setGlobal)(key, city.vars[key] ?? "");
    syncActiveSwitchers();
    // Vars always re-push (Finsweet may reload with fresh CMS data for the same
    // slug); subscribers only fire on an actual slug change.
    if (slugChanged) listeners.forEach((fn)=>{
        try {
            fn(slug);
        } catch (err) {
            console.error("[bruce.city] onChange listener threw", err);
        }
    });
}
function syncActiveSwitchers() {
    document.querySelectorAll("[data-set-city]").forEach((el)=>{
        /** @type {HTMLElement} */ el.dataset.cityActive = el.getAttribute("data-set-city") === current ? "true" : "false";
    });
}
function persist(slug) {
    try {
        localStorage.setItem(STORAGE_KEY, slug);
    } catch  {
    // Same caveat as the read path — best-effort.
    }
}
// ── Boot / re-boot ───────────────────────────────────────────
// Idempotent: safe to call on initial load, after Finsweet renders, and from
// the MutationObserver. Preserves the current slug across re-loads of the
// list so editor-side CMS updates don't reset the user's choice.
function refresh() {
    const previous = current;
    loadCities();
    if (cities.length === 0) return;
    const next = previous && hasCity(previous) ? previous : getInitialCity();
    if (!next) return;
    applyCity(next);
}
// ── Public API ───────────────────────────────────────────────
const api = {
    get () {
        return current;
    },
    /** @param {string} slug */ set (slug) {
        if (slug === current) return;
        if (!hasCity(slug)) {
            console.warn(`[bruce.city] unknown city "${slug}" \u{2014} ignoring`);
            return;
        }
        applyCity(slug);
        persist(slug);
    },
    all () {
        return cities.map((c)=>({
                ...c,
                vars: {
                    ...c.vars
                }
            }));
    },
    // Cities matched by the `?city=<a>,<b>` URL param, in URL order.
    // Empty when the param is absent or matches nothing. studios.js reads this
    // to fit the map camera to the URL-filtered set instead of overriding it
    // back to the visitor's saved city.
    urlSelection () {
        return citiesFromUrl().map((c)=>({
                ...c,
                vars: {
                    ...c.vars
                }
            }));
    },
    /** @param {(slug: string) => void} fn */ onChange (fn) {
        listeners.add(fn);
        return ()=>listeners.delete(fn);
    }
};
/** @type {any} */ window.bruce ||= {};
/** @type {any} */ window.bruce.city = api;
// ── Delegated switcher handlers ──────────────────────────────
// Single document-level listener covers static buttons, Finsweet-injected
// switchers, and anything added later. preventDefault on the click guards
// against anchor switchers navigating to "#".
/** @param {Event} e */ function handleSwitcher(e) {
    const trigger = /** @type {Element | null} */ e.target?.closest?.("[data-set-city]");
    if (!trigger) return;
    e.preventDefault();
    api.set(trigger.getAttribute("data-set-city") ?? "");
}
document.addEventListener("click", handleSwitcher);
// Keyboard activation for non-native triggers (divs with role="button").
// Native <button>/<a> already fire click on Enter/Space, so skip them.
document.addEventListener("keydown", (e)=>{
    if (e.key !== "Enter" && e.key !== " ") return;
    const trigger = /** @type {Element | null} */ e.target?.closest?.("[data-set-city]");
    if (!trigger || trigger.tagName === "BUTTON" || trigger.tagName === "A") return;
    handleSwitcher(e);
});
// ── Finsweet hook: re-load when CMS lists resolve ────────────
/** @type {any} */ window.FinsweetAttributes ||= [];
/** @type {any} */ window.FinsweetAttributes.push([
    "list",
    /** @param {Array<{loadingPromise?: Promise<unknown>}>} lists */ (lists)=>{
        Promise.all(lists.map((l)=>l.loadingPromise || Promise.resolve())).then(refresh);
    }
]);
// ── MutationObserver: catch non-Finsweet late inserts ────────
// Only schedules a refresh if a relevant subtree was added. Debounced via rAF
// so a burst of CMS mutations triggers one re-load.
//
// Pre-filter is intentionally cheap: `matches` only, no subtree walk. Webflow
// pages mutate constantly (sliders, tabs, animations); a `querySelector` on
// every added node would dominate the main thread. Finsweet's own deep inserts
// are handled by the FinsweetAttributes hook below — this observer only needs
// to catch direct inserts of the list wrapper or a city item.
let pendingRafId = 0;
const scheduleRefresh = ()=>{
    if (pendingRafId) return;
    pendingRafId = requestAnimationFrame(()=>{
        pendingRafId = 0;
        refresh();
    });
};
const observer = new MutationObserver((mutations)=>{
    for (const m of mutations)for (const node of m.addedNodes){
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ node;
        if (el.matches?.(LIST_SELECTOR) || el.matches?.("[data-city-slug]")) {
            scheduleRefresh();
            return;
        }
    }
});
// ── Auto-boot ────────────────────────────────────────────────
const boot = ()=>{
    refresh();
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    SAFETY_PASS_DELAYS.forEach((ms)=>setTimeout(()=>{
            if (!current) refresh();
        }, ms));
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {
    once: true
});
else boot();

},{"./variables.js":"1KIEs","./utils.js":"en4he"}],"fwmRP":[function(require,module,exports,__globalThis) {
/**
 * City Visibility
 *
 * Toggles visibility of any element marked `data-city-show="<slug-or-name>[,...]"`
 * based on the active city resolved by src/city.js.
 *
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   html:not(.wf-design-mode) body:not(.is-city-ready)
 *     [data-city-show]:not([data-city-show=""]) {
 *     display: none;
 *   }
 *
 * The html:not(.wf-design-mode) prefix lets editors preview one city
 * at a time in the Webflow Designer via the data-preview-city
 * attribute — see specs/2026-05-27-preview-city-design.md.
 *
 * The !important defeats Webflow class-driven display:flex/grid/block
 * (same external-CSS precedence lesson as the bottom-sheet component).
 * Pre-hide uses display:none rather than visibility:hidden to avoid
 * empty slots in flex/grid sections during the boot window.
 *
 * ── Attribute semantics ───────────────────────────────────────────
 *   data-city-show="cph"          visible only when active city is cph
 *   data-city-show="cph, sto"     visible when active is cph or sto
 *   data-city-show="Copenhagen"   name match works too, case-insensitive
 *   data-city-show=""             always visible (empty value is a no-op)
 *   no attribute                  always visible (normal behavior)
 *
 * Matching is case-insensitive against city.slug AND city.name (same
 * permissive lookup as citiesFromUrl() in src/city.js). Values matching
 * no city leave the element hidden and warn once per (attr, value) pair.
 *
 * ── FOUC ──────────────────────────────────────────────────────────
 * Pre-hide rule keeps non-empty data-city-show elements display:none
 * until <body> gains is-city-ready. This module sets that body class
 * only AFTER its first sweep against a non-null active city, so if
 * city.js fails to boot the pre-hide stays in place (fail-closed).
 *
 * Late inserts (Finsweet, dynamic CMS) are caught by a narrow
 * MutationObserver and safety-pass timers at [500, 1500, 3500] ms,
 * matching the convention in src/city.js and src/variables.js.
 */ var _cityVisibilityDecideJs = require("./city-visibility-decide.js");
const ATTR = "data-city-show";
const HIDE_CLASS = "is-city-hidden";
const READY_CLASS = "is-city-ready";
const SAFETY_PASS_DELAYS = [
    500,
    1500,
    3500
];
/** Dedupe warnings: one warning per (attr value, unknown token) pair. */ const warnedValues = new Set();
/**
 * @param {HTMLElement} el
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 */ function applyVisibility(el, activeSlug, cities) {
    const attr = el.getAttribute(ATTR);
    const { visible, unknownValues } = (0, _cityVisibilityDecideJs.shouldShow)(attr, activeSlug, cities);
    el.classList.toggle(HIDE_CLASS, !visible);
    for (const v of unknownValues){
        const key = `${attr}|${v}`;
        if (warnedValues.has(key)) continue;
        warnedValues.add(key);
        console.warn(`[bruce.city-visibility] data-city-show="${attr}" \u{2014} value "${v}" matched no known city.`, "Known cities:", cities.map((c)=>({
                slug: c.slug,
                name: c.name
            })));
    }
}
/**
 * Sweep every `[data-city-show]` element in the document. Sets the
 * `is-city-ready` body class once a sweep completes with a non-null slug,
 * which drops the global pre-hide rule.
 */ function sweep() {
    const api = /** @type {any} */ window.bruce?.city;
    if (!api) return;
    const activeSlug = api.get();
    const cities = api.all();
    document.querySelectorAll(`[${ATTR}]`).forEach((el)=>{
        applyVisibility(/** @type {HTMLElement} */ el, activeSlug, cities);
    });
    if (activeSlug) document.body.classList.add(READY_CLASS);
}
// ── Debounced re-sweep ───────────────────────────────────────
// A burst of mutations or simultaneous onChange + insert triggers one pass.
let pendingRafId = 0;
const scheduleSweep = ()=>{
    if (pendingRafId) return;
    pendingRafId = requestAnimationFrame(()=>{
        pendingRafId = 0;
        sweep();
    });
};
// ── MutationObserver: catch late inserts ─────────────────────
// Cheap pre-filter (matches + querySelector only, no walk) — same pattern
// as src/city.js's observer. Webflow pages mutate constantly; expensive
// per-node walks would dominate the main thread.
const observer = new MutationObserver((mutations)=>{
    for (const m of mutations)for (const node of m.addedNodes){
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ node;
        if (el.matches?.(`[${ATTR}]`) || el.querySelector?.(`[${ATTR}]`)) {
            scheduleSweep();
            return;
        }
    }
});
// ── Boot ─────────────────────────────────────────────────────
// Subscribes to city.onChange, runs an initial sweep, then arms the
// observer + safety-pass timers. Called at most once per page load.
const boot = ()=>{
    const api = /** @type {any} */ window.bruce?.city;
    api?.onChange?.(()=>sweep());
    sweep(); // may run with null slug → all data-city-show get is-city-hidden,
    // body.is-city-ready stays unset, pre-hide remains. onChange or a safety
    // pass will re-run once city.js resolves.
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    SAFETY_PASS_DELAYS.forEach((ms)=>setTimeout(()=>{
            if (!document.body.classList.contains(READY_CLASS)) sweep();
        }, ms));
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {
    once: true
});
else boot();

},{"./city-visibility-decide.js":"dWhxv"}],"dWhxv":[function(require,module,exports,__globalThis) {
/**
 * Pure decision helper for the city-visibility module (city-visibility.js).
 * Framework-free (no DOM, no globals) so the "is this element visible in the
 * active city" rules live in one unit-testable place — mirroring the
 * studios-city-select.js / studios-city-filter.js split.
 */ /**
 * Decide whether an element should be visible given its `data-city-show`
 * attribute value and the currently-active city slug.
 *
 * Returns `{ visible, unknownValues }` so the caller can warn once per
 * unknown value rather than per element.
 *
 * Semantics:
 *   - null/empty/whitespace-only attribute → always visible (no-op).
 *   - comma-separated values, each trimmed.
 *   - non-empty attribute but null active slug → hidden (fails closed
 *     while city.js is still resolving).
 *   - case-insensitive match against city.slug AND city.name (mirrors
 *     citiesFromUrl() in src/city.js so editors can use either).
 *   - tokens that match no city are listed in `unknownValues`.
 *
 * @param {string | null} attrValue
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 * @returns {{ visible: boolean, unknownValues: string[] }}
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "shouldShow", ()=>shouldShow);
function shouldShow(attrValue, activeSlug, cities) {
    const raw = (attrValue ?? "").trim();
    if (raw === "") return {
        visible: true,
        unknownValues: []
    };
    const tokens = raw.split(",").map((t)=>t.trim().toLowerCase()).filter(Boolean);
    if (tokens.length === 0) return {
        visible: true,
        unknownValues: []
    };
    if (!activeSlug) return {
        visible: false,
        unknownValues: []
    };
    const activeLower = activeSlug.toLowerCase();
    let visible = false;
    const unknownValues = [];
    for (const t of tokens){
        const match = cities.find((c)=>c.slug.toLowerCase() === t || c.name.toLowerCase() === t);
        if (!match) {
            unknownValues.push(t);
            continue;
        }
        if (match.slug.toLowerCase() === activeLower) visible = true;
    }
    return {
        visible,
        unknownValues
    };
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"WOwQU":[function(require,module,exports,__globalThis) {
/**
 * Location
 *
 * Browser geolocation, centralized so multiple modules can share the
 * permission prompt and session cache. Pure browser-API wrapper — no
 * dependency on Mapbox or any other library.
 *
 * ── Public API ───────────────────────────────────────────────
 *   window.bruce.location.requestUserLocation()
 *     Always issues a fresh geolocation request. Resolves [lng, lat]
 *     on success, null on denial / timeout / unavailable. Updates the
 *     last-known cache on success.
 *
 *   window.bruce.location.getInitialUserLocation()
 *     Shared session-scoped promise. First call kicks off the request;
 *     subsequent calls reuse the same in-flight or settled promise.
 *     Use this to coordinate boot-time location reads across modules
 *     without double-prompting.
 *
 *   window.bruce.location.getLastKnown()
 *     Synchronous accessor. Returns the most recent successful coord,
 *     or null. Never triggers a prompt, never throws. A later failed
 *     request does NOT wipe a previously-cached success.
 *
 * Each function is also exported as an ES module named export.
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// Browser geolocation → [lng, lat] or null on denial / timeout / unavailable.
// External timeout guards against stuck permission prompts (the native
// `timeout` option only counts time after permission is granted).
parcelHelpers.export(exports, "requestUserLocation", ()=>requestUserLocation);
// Shared across modules so the permission prompt only fires once per session.
parcelHelpers.export(exports, "getInitialUserLocation", ()=>getInitialUserLocation);
parcelHelpers.export(exports, "getLastKnown", ()=>getLastKnown);
const USER_LOCATION_TIMEOUT = 8000;
/** @type {[number, number] | null} */ let lastKnown = null;
/** @type {Promise<[number, number] | null> | null} */ let initialLocationPromise = null;
function requestUserLocation() {
    return new Promise((resolve)=>{
        if (!navigator.geolocation) return resolve(null);
        let settled = false;
        const finish = (result)=>{
            if (settled) return;
            settled = true;
            if (result) lastKnown = result;
            resolve(result);
        };
        const timer = setTimeout(()=>finish(null), USER_LOCATION_TIMEOUT);
        navigator.geolocation.getCurrentPosition((pos)=>{
            clearTimeout(timer);
            finish([
                pos.coords.longitude,
                pos.coords.latitude
            ]);
        }, ()=>{
            clearTimeout(timer);
            finish(null);
        }, {
            timeout: USER_LOCATION_TIMEOUT,
            maximumAge: 60000,
            enableHighAccuracy: false
        });
    });
}
function getInitialUserLocation() {
    if (!initialLocationPromise) initialLocationPromise = requestUserLocation();
    return initialLocationPromise;
}
function getLastKnown() {
    return lastKnown;
}
/** @type {any} */ window.bruce ||= {};
/** @type {any} */ window.bruce.location = {
    requestUserLocation,
    getInitialUserLocation,
    getLastKnown
};

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"eacga":[function(require,module,exports,__globalThis) {
/**
 * Studios Search Redirect (off-page searchbar)
 *
 * The studios searchbar (free-text query + filter dropdowns) appears on pages
 * where `studios.js` does NOT run. On those pages the searchbar has nothing to
 * filter, so this module turns it into a redirect: it collects the typed query
 * plus every checked filter and sends the visitor to the search page with all
 * of it applied via URL params. Active-filter count badges are reflected via
 * the shared `studios-filter-count` util.
 *
 * On the live search page (`/s`) this module no-ops entirely — the searchbar
 * there is owned by `studios.js` + Finsweet, which drives the same count util.
 *
 * ── Webflow markup ───────────────────────────────────────────
 * Author the off-page searchbar as a form marked `data-studios-search`:
 *
 *   <form data-studios-search action="/s">
 *     <input type="search"   name="q">                       <!-- free text  -->
 *     <input type="radio"    name="tier"     value="BASE">    <!-- single group -->
 *     <input type="checkbox" name="city"     value="Bergen">  <!-- multi group  -->
 *     <input type="checkbox" name="category" value="Yoga">    <!-- multi group  -->
 *     <button type="submit">Search</button>
 *   </form>
 *
 *   - `data-studios-search` on the <form> is the bind marker.
 *   - `action` is the redirect path (defaults to `/s` if absent/empty).
 *   - Each filter input's `name` is the Finsweet field key (`city`, `category`,
 *     `tier` — i.e. the checkbox `fs-list-field` on the search page); its
 *     `value` is the filter value. Selection state is native `:checked`.
 *   - Single-value group → `radio`; multi-value group → `checkbox`.
 *   - Enter-to-submit and accessibility come from the native form.
 *   - Count badges / active-state styling: see `studios-filter-count.js` for
 *     the `data-search-count` / `data-search-group` hooks.
 *   - Optional clear controls: `[data-search-clear]` clears all groups,
 *     `[data-search-clear="city_equal"]` clears one. See "Clearing" below.
 *
 * ── URL format ───────────────────────────────────────────────
 * Clean, shareable params: each selected value is a `key=value` pair, with
 * repeated keys for multi-select — `/s?q=boxing&city=Bergen&city=Oslo&category=Yoga`.
 * The free-text query is a trimmed `q`. Empty groups and an empty query are
 * omitted; submitting with nothing set redirects to the bare action. On the
 * search page, `studios.js` reads these and applies them to the Finsweet
 * filters (which then takes over the URL in its own format).
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * Serialize a searchbar form's fields into a clean URL query string (no leading
 * "?", already URL-encoded). Pure — depends only on its FormData argument.
 *
 * Each filter input's `name` is the Finsweet field key (`city`, `category`,
 * `tier`); multiple selected values become repeated keys
 * (`city=Bergen&city=Oslo`). The free-text query is `q`, trimmed and omitted
 * when empty. `studios.js` reads these on the search page and applies them to
 * the Finsweet filters.
 *
 * @param {FormData} formData
 * @returns {string}
 */ parcelHelpers.export(exports, "buildSearchQuery", ()=>buildSearchQuery);
/** Initialize all off-page redirect forms. Safe to call multiple times. */ parcelHelpers.export(exports, "initStudiosSearchRedirect", ()=>initStudiosSearchRedirect);
var _studiosFilterCountJs = require("./studios-filter-count.js");
const FORM_SELECTOR = "form[data-studios-search]";
const LIVE_COMPONENT_SELECTOR = '[data-studios-element="component"]';
const CLEAR_SELECTOR = "[data-search-clear]";
const QUERY_FIELD = "q";
const DEFAULT_ACTION = "/s";
function buildSearchQuery(formData) {
    const params = new URLSearchParams();
    const query = (formData.get(QUERY_FIELD) ?? "").toString().trim();
    if (query) params.set(QUERY_FIELD, query);
    // Append every non-query field's checked values in DOM order, so the URL is
    // stable and readable. Repeated keys carry multi-select groups.
    for (const [key, value] of formData.entries()){
        if (key === QUERY_FIELD) continue;
        params.append(key, value.toString());
    }
    return params.toString();
}
/** @param {HTMLFormElement} form */ function handleSubmit(form, event) {
    event.preventDefault();
    const action = form.getAttribute("action") || DEFAULT_ACTION;
    const query = buildSearchQuery(new FormData(form));
    window.location.assign(query ? `${action}?${query}` : action);
}
// ── Clearing ─────────────────────────────────────────────────
// A click on `[data-search-clear]` unchecks filter options and refreshes the
// counts. Empty value clears every group; `data-search-clear="city_equal"`
// clears just that group. The text query is never touched. preventDefault keeps
// a clear button/link from submitting the form.
/**
 * @param {HTMLFormElement} form
 * @param {Element} trigger
 */ function handleClear(form, trigger) {
    const group = trigger.getAttribute("data-search-clear");
    const selector = group ? `input[name="${CSS.escape(group)}"]` : "input[type=checkbox], input[type=radio]";
    form.querySelectorAll(selector).forEach((el)=>{
        const input = /** @type {HTMLInputElement} */ el;
        if (input.type === "checkbox" || input.type === "radio") input.checked = false;
    });
    // Programmatic `.checked` changes don't fire `change`, so refresh directly.
    (0, _studiosFilterCountJs.updateFilterCounts)(form);
}
function initStudiosSearchRedirect() {
    // The live search page owns its searchbar (Finsweet + studios.js).
    if (document.querySelector(LIVE_COMPONENT_SELECTOR)) return;
    document.querySelectorAll(FORM_SELECTOR).forEach((el)=>{
        const form = /** @type {HTMLFormElement} */ el;
        if (form.dataset.searchRedirectInit) return;
        form.dataset.searchRedirectInit = "true";
        form.addEventListener("submit", (event)=>handleSubmit(form, event));
        form.addEventListener("change", ()=>(0, _studiosFilterCountJs.updateFilterCounts)(form));
        form.addEventListener("click", (event)=>{
            const target = event.target;
            if (!(target instanceof Element)) return;
            const trigger = target.closest(CLEAR_SELECTOR);
            if (!trigger) return;
            event.preventDefault();
            handleClear(form, trigger);
        });
        (0, _studiosFilterCountJs.updateFilterCounts)(form);
    });
}
// ── Auto-boot ────────────────────────────────────────────────
// Guarded so the module stays importable in Node (unit tests) where there is
// no `document`.
if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStudiosSearchRedirect, {
        once: true
    });
    else initStudiosSearchRedirect();
}

},{"./studios-filter-count.js":"km8B3","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"km8B3":[function(require,module,exports,__globalThis) {
/**
 * Studios Filter Count
 *
 * Shared count/state reflection for the studios searchbar, used by both the
 * off-page redirect searchbar (`studios-search-redirect.js`) and the live
 * search page, where `studios.js` drives it from its Finsweet `afterRender` hook.
 *
 * Reflects the current filter selection of a form into the DOM so Webflow can
 * style "has active filters" UI (e.g. a count badge) without custom JS:
 *
 *   - The form gets `data-has-filters="true|false"` and `data-filter-count`
 *     for the TOTAL number of checked filter options.
 *   - `[data-search-group="city_equal"]` elements get the same two attributes
 *     scoped to that one group — style each dropdown toggle independently.
 *   - `[data-search-count]` elements get their textContent set to the count:
 *     the total when the attribute is empty, or a group's count when it names
 *     one (`data-search-count="city_equal"`).
 *
 * Pure, no auto-boot — consumers decide when to call updateFilterCounts and on
 * which events (change, init, Finsweet afterRender).
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * Tally checked filter inputs by group. Pure — takes the list of `name`s of
 * the checked inputs (in DOM order) and returns the total plus a per-name count.
 *
 * @param {string[]} names
 * @returns {{ total: number, byGroup: Map<string, number> }}
 */ parcelHelpers.export(exports, "tallyCheckedFilters", ()=>tallyCheckedFilters);
/**
 * Reflect a form's current filter selection into the DOM hooks above.
 * @param {HTMLFormElement} form
 */ parcelHelpers.export(exports, "updateFilterCounts", ()=>updateFilterCounts);
const QUERY_FIELD = "q";
const COUNT_SELECTOR = "[data-search-count]";
const GROUP_STATE_SELECTOR = "[data-search-group]";
function tallyCheckedFilters(names) {
    const byGroup = new Map();
    for (const name of names)byGroup.set(name, (byGroup.get(name) ?? 0) + 1);
    return {
        total: names.length,
        byGroup
    };
}
function updateFilterCounts(form) {
    // The same filter option can appear several times inside one form (e.g. the
    // search page renders the filters in a modal, the nav searchbar, AND the
    // toolbar, all kept in sync by Finsweet). Dedupe by name+value so a value
    // selected across those copies counts once, not once per copy.
    const seen = new Set();
    const names = [];
    for (const el of form.querySelectorAll("input:checked")){
        const input = /** @type {HTMLInputElement} */ el;
        if (!input.name || input.name === QUERY_FIELD) continue;
        const key = `${input.name} ${input.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(input.name);
    }
    const { total, byGroup } = tallyCheckedFilters(names);
    form.dataset.hasFilters = total > 0 ? "true" : "false";
    form.dataset.filterCount = String(total);
    form.querySelectorAll(GROUP_STATE_SELECTOR).forEach((el)=>{
        const group = el.getAttribute("data-search-group") || "";
        const count = byGroup.get(group) ?? 0;
        const node = /** @type {HTMLElement} */ el;
        node.dataset.hasFilters = count > 0 ? "true" : "false";
        node.dataset.filterCount = String(count);
    });
    form.querySelectorAll(COUNT_SELECTOR).forEach((el)=>{
        const group = el.getAttribute("data-search-count");
        el.textContent = String(group ? byGroup.get(group) ?? 0 : total);
    });
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"1ivZR":[function(require,module,exports,__globalThis) {
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
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Public API ───────────────────────────────────────────────
/**
 * Initialize all tab components currently in the DOM.
 * Safe to call multiple times — already-initialized components are skipped.
 */ parcelHelpers.export(exports, "initTabs", ()=>initTabs);
/**
 * Initialize a specific tab component.
 * @param {HTMLElement} element
 */ parcelHelpers.export(exports, "initTab", ()=>initTab);
var _utilsJs = require("./utils.js");
// ── Module-level constants ───────────────────────────────────
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// ── Helpers ──────────────────────────────────────────────────
/** @param {string} value */ function slugify(value) {
    return value.toLowerCase().replaceAll(" ", "-");
}
// ── Init a single tab component ──────────────────────────────
/**
 * @param {HTMLElement} tabWrap
 * @param {number} componentIndex
 */ function initComponent(tabWrap, componentIndex) {
    if (tabWrap.dataset.scriptInitialized) return;
    // ── Props ──────────────────────────────────────────────
    const loopControls = (0, _utilsJs.attrBool)(tabWrap, "data-loop-controls");
    const pauseOnHover = (0, _utilsJs.attrBool)(tabWrap, "data-pause-on-hover");
    let autoplay = (0, _utilsJs.attrNum)(tabWrap, "data-autoplay-duration", 0);
    // ── Required DOM ───────────────────────────────────────
    const buttonList = /** @type {HTMLElement | null} */ tabWrap.querySelector(".tab_button_list");
    const panelList = /** @type {HTMLElement | null} */ tabWrap.querySelector(".tab_content_list");
    if (!buttonList || !panelList) {
        console.warn("Tab component missing .tab_button_list or .tab_content_list:", tabWrap);
        return;
    }
    // ── Optional controls ──────────────────────────────────
    const previousButton = /** @type {HTMLButtonElement | null} */ tabWrap.querySelector("[data-tab='previous'] button");
    const nextButton = /** @type {HTMLButtonElement | null} */ tabWrap.querySelector("[data-tab='next'] button");
    const toggleWrap = /** @type {HTMLElement | null} */ tabWrap.querySelector("[data-tab-button='toggle']");
    const toggleButton = /** @type {HTMLButtonElement | null} */ tabWrap.querySelector("[data-tab-button='toggle'] button");
    // ── Restructure DOM ────────────────────────────────────
    (0, _utilsJs.flattenDisplayContents)(buttonList);
    (0, _utilsJs.flattenDisplayContents)(panelList);
    (0, _utilsJs.removeCMSList)(buttonList);
    (0, _utilsJs.removeCMSList)(panelList);
    // ── Resolve buttons + wraps ────────────────────────────
    /** @type {HTMLElement[]} */ const buttonItems = Array.from(buttonList.children).map((child)=>/** @type {HTMLElement} */ child.querySelector("button") || child);
    /** @type {HTMLElement[]} */ const buttonWraps = buttonItems.map((btn)=>{
        let wrap = btn;
        while(wrap.parentElement && wrap.parentElement !== buttonList)wrap = wrap.parentElement;
        return wrap;
    });
    // Strip ARIA from wraps (only the inner buttons own the roles)
    buttonWraps.forEach((wrap, i)=>{
        if (wrap !== buttonItems[i]) {
            wrap.removeAttribute("role");
            wrap.removeAttribute("aria-selected");
            wrap.removeAttribute("aria-controls");
            wrap.removeAttribute("tabindex");
        }
    });
    /** @type {HTMLElement[]} */ const panelItems = Array.from(panelList.children).map((c)=>/** @type {HTMLElement} */ c);
    if (!buttonItems.length || !panelItems.length) {
        console.warn("Tab component has no buttons or panels:", tabWrap);
        return;
    }
    // Per-button accordion content slot (null for non-accordion variants).
    /** @type {Array<HTMLElement | null>} */ const accordionContents = buttonWraps.map((wrap)=>{
        if (wrap.getAttribute("data-wf--tab-link--variant") !== "accordion") return null;
        const content = /** @type {HTMLElement | null} */ wrap.querySelector("[data-tab-link-content]");
        if (!content) return null;
        content.style.display = "none";
        return content;
    });
    // ── Initial ARIA setup ─────────────────────────────────
    buttonList.setAttribute("role", "tablist");
    panelList.removeAttribute("role");
    panelItems.forEach((panel)=>{
        panel.style.display = "none";
        panel.setAttribute("role", "tabpanel");
    });
    buttonItems.forEach((btn)=>btn.setAttribute("role", "tab"));
    // ── State ──────────────────────────────────────────────
    let activeIndex = -1;
    /** @type {{play: () => void, pause: () => void, restart: () => void} | null} */ let autoplayTl = null;
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
   */ const makeActive = (index, focus = false)=>{
        if (index === activeIndex) return;
        const previousIndex = activeIndex;
        /** @param {number} i @param {boolean} isActive */ const setButtonActive = (i, isActive)=>{
            const btn = buttonItems[i];
            btn.classList.toggle("is-active", isActive);
            if (buttonWraps[i] !== btn) buttonWraps[i].classList.toggle("is-active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
            btn.setAttribute("tabindex", isActive ? "0" : "-1");
            if (accordionContents[i]) btn.setAttribute("aria-expanded", isActive ? "true" : "false");
        };
        // First activation: seed every button into a known state.
        // Subsequent switches: only touch the two indices that changed.
        if (previousIndex === -1) {
            buttonItems.forEach((_, i)=>setButtonActive(i, i === index));
            panelItems.forEach((panel, i)=>panel.classList.toggle("is-active", i === index));
        } else {
            setButtonActive(previousIndex, false);
            setButtonActive(index, true);
            panelItems[previousIndex]?.classList.toggle("is-active", false);
            panelItems[index]?.classList.toggle("is-active", true);
        }
        // Update prev/next disabled state
        if (nextButton) nextButton.disabled = index === buttonItems.length - 1 && !loopControls;
        if (previousButton) previousButton.disabled = index === 0 && !loopControls;
        if (focus) buttonItems[index].focus();
        // Toggle accordion-variant content visibility
        if (previousIndex !== -1 && accordionContents[previousIndex]) /** @type {HTMLElement} */ accordionContents[previousIndex].style.display = "none";
        if (accordionContents[index]) /** @type {HTMLElement} */ accordionContents[index].style.display = "block";
        // Swap panels — instant; any visible transition belongs in CSS
        if (previousIndex !== -1 && panelItems[previousIndex]) panelItems[previousIndex].style.display = "none";
        if (panelItems[index]) panelItems[index].style.display = "block";
        // Reset autoplay progress on user-driven changes — clicking a tab restarts
        // the timer for the new tab. `userPaused` blocks the restart so a cycle
        // the user has explicitly paused stays paused.
        if (autoplayTl && !userPaused) autoplayTl.restart();
        // Scroll active button into view (only if button list is horizontally scrollable)
        if (buttonList.scrollWidth > buttonList.clientWidth) buttonList.scrollTo({
            left: buttonWraps[index].offsetLeft,
            behavior: "smooth"
        });
        activeIndex = index;
    };
    // ── Navigation ────────────────────────────────────────
    /** @param {number} delta @param {boolean} [focus] */ const updateIndex = (delta, focus = false)=>makeActive((activeIndex + delta + buttonItems.length) % buttonItems.length, focus);
    nextButton?.addEventListener("click", ()=>updateIndex(1));
    previousButton?.addEventListener("click", ()=>updateIndex(-1));
    // ── Per-button setup: IDs, click, keyboard, deep-link ──
    const tabIdAttr = tabWrap.getAttribute("data-tab-component-id");
    const tabId = tabIdAttr ? slugify(tabIdAttr) : String(componentIndex + 1);
    const deepLinkId = new URLSearchParams(location.search).get("tab-id");
    buttonItems.forEach((btn, index)=>{
        const itemIdAttr = btn.getAttribute("data-tab-item-id");
        const itemId = itemIdAttr ? slugify(itemIdAttr) : String(index + 1);
        const buttonId = `tab-button-${tabId}-${itemId}`;
        const panelId = `tab-panel-${tabId}-${itemId}`;
        btn.setAttribute("id", buttonId);
        btn.setAttribute("aria-controls", panelId);
        panelItems[index]?.setAttribute("id", panelId);
        panelItems[index]?.setAttribute("aria-labelledby", buttonId);
        // Deep linking via ?tab-id=tabId-itemId
        if (deepLinkId === `${tabId}-${itemId}`) // Defer activation until after initial makeActive(0) below
        queueMicrotask(()=>{
            makeActive(index);
            autoplay = 0; // stop autoplay on deep-link
            tabWrap.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            const url = new URL(location.href);
            url.searchParams.delete("tab-id");
            history.replaceState({}, "", url);
        });
        btn.addEventListener("click", ()=>makeActive(index));
        btn.addEventListener("keydown", (e)=>{
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
        /** @param {number} p */ const setProgress = (p)=>{
            tabWrap.style.setProperty("--progress", String(p));
        };
        /** @param {number} now */ const tick = (now)=>{
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
        const startCycle = ()=>{
            if (rafId) cancelAnimationFrame(rafId);
            elapsedBeforePause = 0;
            cycleStart = performance.now();
            isPlaying = true;
            setProgress(0);
            rafId = requestAnimationFrame(tick);
        };
        const pauseCycle = ()=>{
            if (!isPlaying) return;
            isPlaying = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
            elapsedBeforePause += performance.now() - cycleStart;
        };
        const resumeCycle = ()=>{
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
            restart: startCycle
        };
        startCycle();
        let isHovered = false;
        let hasFocusInside = false;
        let prefersReducedMotion = false;
        let inView = true;
        const updateAuto = ()=>{
            if (prefersReducedMotion || !inView || userPaused || isHovered || hasFocusInside) autoplayTl?.pause();
            else autoplayTl?.play();
        };
        const setButton = ()=>{
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
        toggleButton?.addEventListener("click", ()=>setButton());
        /** @param {MediaQueryList | MediaQueryListEvent} e */ const handleMotionChange = (e)=>{
            prefersReducedMotion = e.matches;
            updateAuto();
            userPaused = !e.matches;
            setButton();
        };
        const motionMQ = window.matchMedia(REDUCED_MOTION_QUERY);
        handleMotionChange(motionMQ);
        motionMQ.addEventListener("change", handleMotionChange);
        if (pauseOnHover) {
            tabWrap.addEventListener("mouseenter", ()=>{
                isHovered = true;
                updateAuto();
            });
            tabWrap.addEventListener("mouseleave", ()=>{
                hasFocusInside = false;
                isHovered = false;
                updateAuto();
            });
        }
        tabWrap.addEventListener("focusin", ()=>{
            hasFocusInside = true;
            updateAuto();
        });
        tabWrap.addEventListener("focusout", (e)=>{
            const related = /** @type {Element | null} */ e.relatedTarget;
            if (!related || !tabWrap.contains(related)) {
                hasFocusInside = false;
                updateAuto();
            }
        });
        new IntersectionObserver((entries)=>{
            inView = entries[0].isIntersecting;
            updateAuto();
        }, {
            threshold: 0
        }).observe(tabWrap);
    }
    // Expose for external access
    /** @type {any} */ tabWrap._tab = {
        makeActive,
        updateIndex,
        get activeIndex () {
            return activeIndex;
        }
    };
}
function initTabs() {
    document.querySelectorAll(".tab_wrap").forEach((el, i)=>{
        initComponent(/** @type {HTMLElement} */ el, i);
    });
}
function initTab(element) {
    if (element && element.classList.contains("tab_wrap")) // Use 0 as index — only matters as fallback when data-tab-component-id is absent
    initComponent(element, 0);
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTabs, {
    once: true
});
else initTabs();

},{"./utils.js":"en4he","@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"2alcq":[function(require,module,exports,__globalThis) {
/**
 * Visual Video Component
 *
 * Plyr-based video player with:
 * - Lazy-loading (IntersectionObserver + Swiper-aware deferral)
 * - Aspect-ratio-aware cover sizing across all Lumos variants
 * - State broadcasting to opt-in parent scopes via [data-video="component"]
 * - Source-aspect override for vertical content (Shorts, Reels)
 *
 * Usage in Webflow:
 *   <div class="video_wrap"
 *        data-src="https://youtu.be/..."
 *        data-source-aspect="16/9"   (optional, defaults to 16:9)
 *        data-autoplay                (optional)
 *        data-muted                   (optional, implied by autoplay)
 *        data-loop                    (optional)
 *        data-controls="none|minimal|full"  (default: full)
 *        data-captions="https://.../captions.vtt"  (optional)
 *   >
 *     <div class="video_player"></div>
 *     <div class="video_poster">
 *       <img class="video_poster_image" src="..." />
 *     </div>
 *   </div>
 *
 * Optional parent scope (e.g. on a testimonial card):
 *   <div data-video="component"> ... </div>
 *
 * The scope receives data-video-state="idle|playing|paused|ended"
 * and can style its children accordingly.
 */ // ── Module-level constants ───────────────────────────────────
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// ── Public API ───────────────────────────────────────────────
/**
 * Initialize all .video_wrap components currently in the DOM.
 * Safe to call multiple times — already-initialized components are skipped.
 */ parcelHelpers.export(exports, "initVisualVideos", ()=>initVisualVideos);
/**
 * Initialize a specific .video_wrap element. Useful for dynamically inserted
 * components (e.g. after fetching CMS items via Finsweet List Load).
 *
 * @param {HTMLElement} element
 */ parcelHelpers.export(exports, "initVisualVideo", ()=>initVisualVideo);
const DEFAULT_ASPECT = 16 / 9;
const LAZY_ROOT_MARGIN = "200px";
const SWIPER_ACTIVE_CLASSES = [
    "swiper-slide-active",
    "swiper-slide-visible",
    "swiper-slide-next",
    "swiper-slide-prev"
];
const CONTROLS_MAP = {
    full: [
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen"
    ],
    minimal: [
        "play",
        "progress",
        "mute",
        "fullscreen"
    ],
    none: []
};
// Pre-compiled regexes
const RE_YOUTUBE = /youtube\.com|youtu\.be/;
const RE_VIMEO = /vimeo\.com/;
const RE_YT_ID = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^?&#]+)/;
const RE_VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/;
// ── Types ────────────────────────────────────────────────────
/** @typedef {'youtube' | 'vimeo' | 'html5'} Provider */ /** @typedef {'idle' | 'playing' | 'paused' | 'ended'} VideoState */ // ── Helpers ──────────────────────────────────────────────────
/**
 * @param {string} url
 * @returns {Provider}
 */ function detectProvider(url) {
    if (RE_YOUTUBE.test(url)) return "youtube";
    if (RE_VIMEO.test(url)) return "vimeo";
    return "html5";
}
/**
 * @param {string} url
 * @param {Provider} prov
 * @returns {string}
 */ function extractEmbedId(url, prov) {
    if (prov === "youtube") return (url.match(RE_YT_ID) || [])[1] || "";
    if (prov === "vimeo") return (url.match(RE_VIMEO_ID) || [])[1] || "";
    return url;
}
/**
 * Parses a "W/H" aspect string into a number.
 * @param {string | null} str
 * @param {number} fallback
 * @returns {number}
 */ function parseAspect(str, fallback) {
    if (!str || !str.includes("/")) return fallback;
    const parts = str.split("/");
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    return w > 0 && h > 0 ? w / h : fallback;
}
/**
 * @param {string} src
 * @returns {string}
 */ function getMimeType(src) {
    const ext = src.split(".").pop().split("?")[0].toLowerCase();
    if (ext === "webm") return "video/webm";
    if (ext === "ogg") return "video/ogg";
    return "video/mp4";
}
/**
 * @param {HTMLElement} slide
 * @returns {boolean}
 */ function isSwiperSlideActive(slide) {
    for (const cls of SWIPER_ACTIVE_CLASSES){
        if (slide.classList.contains(cls)) return true;
    }
    return false;
}
// ── Init a single component ──────────────────────────────────
/**
 * @param {HTMLElement} component
 */ function initComponent(component) {
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = "true";
    const playerWrapper = component.querySelector(".video_player");
    if (!playerWrapper) {
        console.warn("Visual Video: .video_player element missing");
        return;
    }
    const posterEl = component.querySelector(".video_poster");
    const scope = component.closest("[data-video='component']");
    const swiperSlide = component.closest(".swiper-slide");
    // ── Props ──────────────────────────────────────────────
    const src = component.getAttribute("data-src") || "";
    if (!src) return;
    const captions = component.getAttribute("data-captions") || "";
    const autoplay = component.hasAttribute("data-autoplay");
    const muted = component.hasAttribute("data-muted") || autoplay;
    const loop = component.hasAttribute("data-loop");
    const controlsValue = component.getAttribute("data-controls") || "full";
    const controlsList = CONTROLS_MAP[controlsValue] || CONTROLS_MAP.full;
    const provider = detectProvider(src);
    const embedId = extractEmbedId(src, provider);
    let videoAspect = parseAspect(component.getAttribute("data-source-aspect"), DEFAULT_ASPECT);
    // ── State broadcaster ──────────────────────────────────
    /** @type {VideoState | null} */ let currentState = null;
    /** @param {VideoState} state */ const setVideoState = (state)=>{
        if (state === currentState) return; // skip redundant DOM writes
        currentState = state;
        component.setAttribute("data-video-state", state);
        if (scope) scope.setAttribute("data-video-state", state);
    };
    setVideoState(autoplay ? "playing" : "idle");
    // ── Deferred init: choose strategy based on context ────
    // Strategy A: Inside a Swiper slide → init only when slide
    //   becomes active/visible.
    // Strategy B: Standalone → IntersectionObserver with 200px
    //   margin. Init before the user reaches the video.
    let initialized = false;
    const initOnce = ()=>{
        if (initialized) return;
        initialized = true;
        initPlayer();
    };
    if (swiperSlide) {
        if (isSwiperSlideActive(swiperSlide)) initOnce();
        else {
            const slideObserver = new MutationObserver(()=>{
                if (isSwiperSlideActive(swiperSlide)) {
                    initOnce();
                    slideObserver.disconnect();
                }
            });
            slideObserver.observe(swiperSlide, {
                attributes: true,
                attributeFilter: [
                    "class"
                ]
            });
        }
    } else {
        const ioObserver = new IntersectionObserver((entries)=>{
            for (const entry of entries)if (entry.isIntersecting) {
                initOnce();
                ioObserver.disconnect();
                break;
            }
        }, {
            rootMargin: LAZY_ROOT_MARGIN
        });
        ioObserver.observe(component);
    }
    // ── Initialize Plyr ────────────────────────────────────
    function initPlayer() {
        /** @type {HTMLElement} */ let targetEl;
        if (provider === "youtube" || provider === "vimeo") {
            targetEl = document.createElement("div");
            targetEl.dataset.plyrProvider = provider;
            targetEl.dataset.plyrEmbedId = embedId;
        } else {
            targetEl = document.createElement("video");
            targetEl.setAttribute("playsinline", "");
            if (controlsList.length) targetEl.setAttribute("controls", "");
            const sourceEl = document.createElement("source");
            sourceEl.src = src;
            sourceEl.type = getMimeType(src);
            targetEl.appendChild(sourceEl);
            if (captions) {
                const track = document.createElement("track");
                track.kind = "captions";
                track.src = captions;
                track.srclang = "en";
                track.label = "English";
                track.default = true;
                targetEl.appendChild(track);
            }
        }
        playerWrapper.insertBefore(targetEl, playerWrapper.firstChild);
        const player = new Plyr(targetEl, {
            controls: controlsList,
            autoplay,
            muted,
            loop: {
                active: loop
            },
            playsinline: true,
            // ratio omitted — wrap dictates aspect, JS handles cover
            youtube: {
                noCookie: true,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                controls: 0,
                disablekb: 1,
                playsinline: 1,
                fs: 0,
                cc_load_policy: 0,
                hl: "en",
                enablejsapi: 1
            },
            vimeo: {
                byline: false,
                portrait: false,
                title: false,
                transparent: false,
                dnt: true
            }
        });
        // ── Cover sizing ─────────────────────────────────────
        /** @type {HTMLElement | null} */ let mediaEl = null;
        let lastW = 0;
        let lastH = 0;
        let rafId = 0;
        const findMediaEl = ()=>{
            mediaEl = playerWrapper.querySelector("iframe, video");
            return mediaEl;
        };
        const computeAndApply = ()=>{
            rafId = 0;
            if (!mediaEl && !findMediaEl()) return;
            const rect = component.getBoundingClientRect();
            const wW = rect.width;
            const wH = rect.height;
            if (!wW || !wH) return;
            // Skip if dimensions unchanged
            if (wW === lastW && wH === lastH) return;
            lastW = wW;
            lastH = wH;
            const wrapAspect = wW / wH;
            let tW;
            let tH;
            if (wrapAspect > videoAspect) {
                tW = wW;
                tH = wW / videoAspect;
            } else {
                tH = wH;
                tW = wH * videoAspect;
            }
            // Single style write (one reflow)
            mediaEl.style.cssText += `position:absolute;top:50%;left:50%;` + `width:${tW}px;height:${tH}px;` + `max-width:none;transform:translate(-50%,-50%);`;
        };
        // rAF-batched scheduler
        const scheduleApply = ()=>{
            if (rafId) return;
            rafId = requestAnimationFrame(computeAndApply);
        };
        const forceApply = ()=>{
            lastW = 0;
            lastH = 0;
            scheduleApply();
        };
        forceApply(); // also try synchronously, before Plyr signals ready
        player.on("ready", async ()=>{
            findMediaEl();
            forceApply();
            if (!autoplay) setVideoState("idle");
            // Vimeo: ask the embed for real source dimensions so cover-sizing
            // uses the actual aspect, not the declared one.
            if (provider === "vimeo") try {
                const embed = /** @type {any} */ player.embed;
                if (embed && embed.getVideoWidth && embed.getVideoHeight) {
                    const [w, h] = await Promise.all([
                        embed.getVideoWidth(),
                        embed.getVideoHeight()
                    ]);
                    if (w > 0 && h > 0) {
                        videoAspect = w / h;
                        forceApply();
                    }
                }
            } catch (_) {
            /* silent */ }
        });
        // HTML5: auto-detect true source aspect via loadedmetadata
        if (provider === "html5") {
            const v = /** @type {HTMLVideoElement | null} */ playerWrapper.querySelector("video");
            if (v) v.addEventListener("loadedmetadata", ()=>{
                if (v.videoWidth && v.videoHeight) {
                    videoAspect = v.videoWidth / v.videoHeight;
                    forceApply();
                }
            }, {
                once: true
            });
        }
        // ResizeObserver — re-fits on any wrap size change
        const ro = new ResizeObserver(scheduleApply);
        ro.observe(component);
        player.on("playing", ()=>setVideoState("playing"));
        player.on("pause", ()=>setVideoState("paused"));
        player.on("ended", ()=>{
            setVideoState("ended");
            if (posterEl) posterEl.classList.remove("is-active");
        });
        // ── Poster ───────────────────────────────────────────
        if (posterEl) {
            posterEl.addEventListener("click", ()=>player.play(), {
                passive: true
            });
            player.on("playing", ()=>posterEl.classList.add("is-active"));
            if (autoplay) posterEl.classList.add("is-active");
        }
        // ── Cleanup ──────────────────────────────────────────
        player.on("destroy", ()=>{
            ro.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        });
        // Expose Plyr instance for external access
        /** @type {any} */ component._plyr = player;
    }
}
function initVisualVideos() {
    document.querySelectorAll(".video_wrap").forEach((el)=>{
        initComponent(/** @type {HTMLElement} */ el);
    });
}
function initVisualVideo(element) {
    if (element && element.classList.contains("video_wrap")) initComponent(element);
}
// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVisualVideos, {
    once: true
});
else initVisualVideos();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}]},["8lqZg"], "8lqZg", "parcelRequire08d4", {})

//# sourceMappingURL=index.js.map
