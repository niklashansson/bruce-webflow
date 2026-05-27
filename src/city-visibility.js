/**
 * City Visibility
 *
 * Toggles visibility of any element marked `data-city-show="<slug-or-name>[,...]"`
 * based on the active city resolved by src/city.js.
 *
 * ── Required CSS (Webflow site-wide custom code, set up once) ─────
 *   .is-city-hidden { display: none !important; }
 *   body:not(.is-city-ready) [data-city-show]:not([data-city-show=""]) {
 *     display: none;
 *   }
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
 */

import { shouldShow } from "./city-visibility-decide.js";

const ATTR = "data-city-show";
const HIDE_CLASS = "is-city-hidden";
const READY_CLASS = "is-city-ready";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** Dedupe warnings: one warning per (attr value, unknown token) pair. */
const warnedValues = new Set();

/**
 * @param {HTMLElement} el
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 */
function applyVisibility(el, activeSlug, cities) {
  const attr = el.getAttribute(ATTR);
  const { visible, unknownValues } = shouldShow(attr, activeSlug, cities);
  el.classList.toggle(HIDE_CLASS, !visible);

  for (const v of unknownValues) {
    const key = `${attr}|${v}`;
    if (warnedValues.has(key)) continue;
    warnedValues.add(key);
    console.warn(
      `[bruce.city-visibility] data-city-show="${attr}" — value "${v}" matched no known city.`,
      "Known cities:",
      cities.map((c) => ({ slug: c.slug, name: c.name })),
    );
  }
}

/**
 * Sweep every `[data-city-show]` element in the document. Sets the
 * `is-city-ready` body class once a sweep completes with a non-null slug,
 * which drops the global pre-hide rule.
 */
function sweep() {
  const api = /** @type {any} */ (window).bruce?.city;
  if (!api) return;
  const activeSlug = api.get();
  const cities = api.all();

  document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
    applyVisibility(/** @type {HTMLElement} */ (el), activeSlug, cities);
  });

  if (activeSlug) {
    document.body.classList.add(READY_CLASS);
  }
}

// ── Debounced re-sweep ───────────────────────────────────────
// A burst of mutations or simultaneous onChange + insert triggers one pass.

let pendingRafId = 0;
const scheduleSweep = () => {
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    sweep();
  });
};

// ── MutationObserver: catch late inserts ─────────────────────
// Cheap pre-filter (matches + querySelector only, no walk) — same pattern
// as src/city.js's observer. Webflow pages mutate constantly; expensive
// per-node walks would dominate the main thread.

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches?.(`[${ATTR}]`) || el.querySelector?.(`[${ATTR}]`)) {
        scheduleSweep();
        return;
      }
    }
  }
});

// ── Boot ─────────────────────────────────────────────────────
// Subscribes to city.onChange, runs an initial sweep, then arms the
// observer + safety-pass timers. Called at most once per page load.

const boot = () => {
  const api = /** @type {any} */ (window).bruce?.city;
  api?.onChange?.(() => sweep());

  sweep(); // may run with null slug → all data-city-show get is-city-hidden,
  // body.is-city-ready stays unset, pre-hide remains. onChange or a safety
  // pass will re-run once city.js resolves.

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
