/**
 * City Visibility
 *
 * Toggles elements marked with one of four attributes based on the active
 * city resolved by src/city-context.js:
 *   data-city-show="<slug-or-name>[,...]"   visible only for those cities
 *   data-city-hide="<slug-or-name>[,...]"   hidden for those cities
 *   data-city-none                          visible only when neutral
 *   data-city-any                           visible only when a city is active
 *
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   html:not(.wf-design-mode) body:not(.is-city-ready)
 *     :is([data-city-show],[data-city-hide],[data-city-none],[data-city-any]) {
 *     display: none;
 *   }
 *
 * The !important defeats Webflow class-driven display:flex/grid/block (same
 * external-CSS precedence lesson as the bottom-sheet component). Pre-hide uses
 * display:none to avoid empty flex/grid slots during the boot window.
 *
 * ── Ready flag ────────────────────────────────────────────────────
 * is-city-ready is set after the first sweep that runs from a *resolved*
 * context. city-context fires onChange once on initial resolution — even for a
 * neutral (null) result — and replays it to late subscribers, so a neutral
 * page still reveals its data-city-none content. If the context never resolves
 * (registry missing) the flag stays unset and only generic content shows
 * (fail-closed neutral baseline).
 *
 * Late inserts (dynamic CMS) are caught by a narrow MutationObserver and
 * safety-pass timers at [500, 1500, 3500] ms.
 */

import { decideVisibility } from "./city-visibility-decide.js";

const SELECTOR =
  "[data-city-show],[data-city-hide],[data-city-none],[data-city-any]";
const HIDE_CLASS = "is-city-hidden";
const READY_CLASS = "is-city-ready";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** Dedupe warnings: one per (attr value, unknown token). */
const warnedValues = new Set();

function readAttrs(el) {
  return {
    show: el.getAttribute("data-city-show"),
    hide: el.getAttribute("data-city-hide"),
    none: el.hasAttribute("data-city-none"),
    any: el.hasAttribute("data-city-any"),
  };
}

function applyVisibility(el, activeSlug, cities) {
  const attrs = readAttrs(el);
  const { visible, unknownValues } = decideVisibility(attrs, activeSlug, cities);
  el.classList.toggle(HIDE_CLASS, !visible);

  for (const v of unknownValues) {
    const key = `${attrs.show ?? ""}|${attrs.hide ?? ""}|${v}`;
    if (warnedValues.has(key)) continue;
    warnedValues.add(key);
    console.warn(
      `[bruce.city-visibility] value "${v}" matched no known city.`,
      "Known cities:",
      cities.map((c) => ({ slug: c.slug, name: c.name })),
    );
  }
}

let lastResolved = false;

function sweep() {
  const cityApi = /** @type {any} */ (window).bruce?.city;
  if (!cityApi) return;
  const activeSlug = cityApi.get();
  const cities = cityApi.all();

  document
    .querySelectorAll(SELECTOR)
    .forEach((el) => applyVisibility(el, activeSlug, cities));

  // Only flag ready once the context has actually resolved. We learn that via
  // the onChange callback (set lastResolved there); a MutationObserver-driven
  // sweep before resolution must not reveal content.
  if (lastResolved) document.body.classList.add(READY_CLASS);
}

let pendingRafId = 0;
const scheduleSweep = () => {
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    sweep();
  });
};

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches?.(SELECTOR) || el.querySelector?.(SELECTOR)) {
        scheduleSweep();
        return;
      }
    }
  }
});

const boot = () => {
  const cityApi = /** @type {any} */ (window).bruce?.city;
  // onChange replays the current state immediately if already resolved, so this
  // both handles "resolved before us" and "resolves after us".
  cityApi?.onChange?.(() => {
    lastResolved = true;
    sweep();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      if (!document.body.classList.contains(READY_CLASS)) sweep();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
