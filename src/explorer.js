// Explorer — studios list + map for the per-city explorer page
// (`/studios/city/<slug>`). Replaces studios.js once complete; built one piece
// at a time. See docs/superpowers/specs/2026-05-31-explorer-migration-design.md
//
// The explorer page loads index.js (nav, dropdowns, the filter modal, the
// discovery sliders, city context) AND this file. explorer.js owns ONLY the
// Finsweet `explorer-results` list, the count display, filter-count badges,
// the collections-hide behaviour and the entire map mode.
//
// ── Built so far ─────────────────────────────────────────────
// Step 1 (scaffold): bind to the `explorer-results` instance.
// Step 2 (list foundation): count display + loading/filtering/ready/empty
//   state machine.
// Step 3 (filter chrome): filter-count badges + collections-hide-when-filtered.
//   Inbound/outbound URL state is handled NATIVELY by Finsweet
//   (`fs-list-showquery`) — there is no custom deep-link replay here.
// Step 4 (map shell): a Map-button toggle (desktop split / mobile overlay)
//   that lazily loads Mapbox GL on first open, centers on the page's city, and
//   drops a point marker + popup per studio, fitting the camera to the set.
// Step 5 (clustering): supercluster groups nearby studios into count bubbles,
//   re-clustering on pan/zoom; cluster click zooms to break it apart.
// Step 6 (mobile bottom-sheet): on a mobile layout, opening the map re-parents
//   the single results panel into a pure-web-bottom-sheet over the fullscreen
//   map (peek/half/full snaps); the sheet's height pads the camera so framed
//   studios stay above it. Desktop keeps the split.
// Step 7 (interactions): locate (geolocation marker + fly-to), "search this
//   area" (one-shot narrow of the list to the map viewport, button armed on
//   pan), and a mobile body-scroll lock behind the fullscreen overlay. The
//   close affordance is any element carrying data-explorer-element="map-toggle"
//   inside the overlay/sheet (all toggles are bound).

import { MAPBOX_STYLE, loadMapboxGl, loadScriptOnce } from "./mapbox.js";
import { requestUserLocation } from "./location.js";
import { planNearby } from "./nearby-plan.js";

const S = {
  wrap: '[data-explorer-element="wrap"]',
  countMode: "[data-explorer-count-mode]",
  countSlot: "[data-explorer-count-slot]",
  filtersForm: 'form[fs-list-element="filters"]',
  searchGroup: "[data-search-group]",
  searchCount: "[data-search-count]",
  cityLink: 'a[href*="/studios/city/"]',
  // Map
  mapTarget: '[data-explorer-element="map-target"]',
  mapToggle: '[data-explorer-element="map-toggle"]',
  marker: '[data-explorer-element="studio-marker"]',
  popup: '[data-explorer-element="studio-popup"]',
  clusterTemplate: '[data-explorer-element="cluster-template"]',
  userLocationTemplate: '[data-explorer-element="user-location-template"]',
  locate: '[data-explorer-element="locate"]',
  searchArea: '[data-explorer-element="search-area"]',
  count: '[data-explorer-field="count"]',
  lat: '[data-explorer-field="studio-lat"]',
  lng: '[data-explorer-field="studio-lng"]',
  id: '[data-explorer-field="studio-id"]',
  cityList: "[data-city-list]",
  // Mobile bottom-sheet (Step 6)
  sheet: '[data-explorer-element="sheet"]',
  sheetMount: '[data-explorer-element="sheet-mount"]',
  sheetHeader: '[data-explorer-element="sheet-header"]',
  resultsPanel: '[data-explorer-element="results-panel"]',
  // The .w-form wrapper around the filters <form>. Moved whole into the sheet
  // header on a mobile map (so the inputs never leave their form — no Finsweet
  // desync). The Map toggle sits OUTSIDE this, so it stays put.
  filterBar: '[data-explorer-element="filter-bar"]',
  // The "Show exclusive to X" switch — a real Finsweet condition input
  // (fs-list-field="tier" fs-list-operator="equal") inside the filters form.
  exclusiveToggle: '[data-explorer-element="exclusive-toggle"]',
  // The "Show studios in nearby areas" pair, inside the city dropdown. The
  // visible switch carries NO fs-list-* attributes; the hidden source is the
  // real Finsweet condition (fs-list-field="in-metro" fs-list-value="true")
  // and ships checked, so the default view is metro-only. JS keeps them
  // inverted — see syncNearbyToggle.
  nearbyToggle: '[data-explorer-element="nearby-toggle"]',
  nearbySource: '[data-explorer-element="nearby-source"]',
  // A page-level "Clear all" — fs-list-element="clear" with NO fs-list-field.
  // The field-scoped clears (fs-list-field="tier" / "category") clear one
  // dropdown, not the page, and must not reset the nearby scope.
  globalClear: '[fs-list-element="clear"]:not([fs-list-field])',
};

// The free-text search input — counted for "are filters active?" but never as a
// filter-group badge.
const QUERY_FIELD = "q";

// Counts above the threshold collapse to the "over" copy ("Over 1000 studios")
// instead of an exact number. Each locale authors the surrounding copy in
// Designer; JS only writes the number into [data-explorer-count-slot]. Override
// per page with `data-explorer-count-over="<n>"` on .explorer_wrap; otherwise
// this default applies.
const DEFAULT_OVER_COUNT_THRESHOLD = 1000;

function readOverThreshold(wrap) {
  const n = parseInt(wrap.getAttribute("data-explorer-count-over"), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_OVER_COUNT_THRESHOLD;
}

// Cheap filters resolve synchronously and a "filtering" flash would just
// strobe. We only commit to the filtering state if the render hasn't landed
// within this window.
const FILTERING_DELAY_MS = 0;

// A global "Clear all" only produces a Finsweet render (and afterRender) when
// it actually changes something. On a page that's already metro-only and
// otherwise unfiltered, clearing is a no-op for Finsweet, so afterRender never
// fires — this is how long to wait past the live page's
// `fs-list-debounce="200"` before assuming that happened and applying the
// clear ourselves. See bindNearbyClear.
const NEARBY_CLEAR_FALLBACK_MS = 250;

// ── Map config ───────────────────────────────────────────────
// Fallback center if the page city has no coords in [data-city-list] (Oslo).
const DEFAULT_CENTER = [10.7522, 59.9139];
const DEFAULT_ZOOM = 11;
const CITY_ZOOM = 11;
const SINGLE_FEATURE_ZOOM = 13;
const USER_LOCATION_ZOOM = 12;
const FIT_BOUNDS_CONFIG = { duration: 500, maxZoom: 14, padding: 48 };
const MARKER_FADE_DURATION = 250;
const POPUP_CLASS = "explorer-popup";
// dataset key → `data-explorer-map="open|closed"` on .explorer_wrap; CSS reads
// it to show the map (desktop split / mobile overlay) and hide it otherwise.
const MAP_MODE_KEY = "explorerMap";

// Clustering. Supercluster is the only extra CDN dep beyond mapbox-gl; loaded
// lazily alongside it on first map open and kept out of the Webflow <head> so
// neither blocks first paint.
const SUPERCLUSTER_JS_URL =
  "https://unpkg.com/supercluster@8.0.0/dist/supercluster.min.js";
// minPoints 6 → fewer than 6 nearby points stay as individual studio markers
// rather than collapsing into a cluster bubble.
const CLUSTER_CONFIG = { radius: 50, maxZoom: 14, minPoints: 6 };
// Extra zoom beyond supercluster's expansionZoom so a cluster click lands a
// touch past the break-apart point (avoids re-clustering into one bubble).
const CLUSTER_EXPANSION_PADDING = 0.5;

// ── Mobile bottom-sheet (Step 6) ─────────────────────────────
// The pure-web-bottom-sheet custom element tag. Registered in the Webflow
// <head> via `registerSheetElements()` (see the markup contract).
const SHEET_TAG = "bottom-sheet";
// Live sheet height published on .explorer_wrap so CSS / the map padding can
// anchor "just above the sheet".
const SHEET_HEIGHT_VAR = "--explorer-sheet-height";
// Layout breakpoint, mirroring the site's `@container (width < 50em)` split
// point. Below it we treat the layout as "mobile" and the sheet hosts the list;
// at/above it the results stay in the desktop split beside the map. Kept in em
// so the JS threshold tracks the CSS if the base font-size changes.
const LAYOUT_BREAKPOINT_EM = 50;

// Guards against double-init if Finsweet fires its "list" callback more than
// once (e.g. on a re-render).
const initializedInstances = new WeakSet();

// Count display. Author once with three mode slots inside .explorer_count_text:
//   <span data-explorer-count-mode="singular"><span data-explorer-count-slot></span> studio</span>
//   <span data-explorer-count-mode="plural"><span data-explorer-count-slot></span> studios</span>
//   <span data-explorer-count-mode="over">Over <span data-explorer-count-slot></span> studios</span>
// CSS hides every mode by default and reveals the one with `.is-active`, so the
// surrounding copy stays editable per-locale with no JS changes.
function updateCountDisplay(wrap, count, overThreshold) {
  const mode =
    count > overThreshold ? "over" : count === 1 ? "singular" : "plural";
  const slotValue = mode === "over" ? overThreshold : count;

  wrap.querySelectorAll(S.countMode).forEach((modeEl) => {
    const isActive = modeEl.getAttribute("data-explorer-count-mode") === mode;
    modeEl.classList.toggle("is-active", isActive);
    if (!isActive) return;
    const slot = modeEl.querySelector(S.countSlot);
    if (slot) slot.textContent = String(slotValue);
  });
}

// Reflect a filters form's current selection into the DOM so Webflow can style
// the filter chrome with no per-element JS, and so the curated collections can
// hide once the user starts searching:
//   - `[data-search-group]` (each toolbar dropdown) gets `data-has-filters`.
//   - `[data-search-count]` elements get their textContent set to a count —
//     the group's count when the attribute names one (`data-search-count="tier"`),
//     or the grand total when it's empty.
//   - `.explorer_wrap` gets `data-explorer-filtered` so CSS can collapse the
//     discovery section while any filter or the search query is engaged.
//
// Counts are keyed by `fs-list-field` (tier / category) — NOT `name`, since the
// tier inputs carry no name. The same value appears in both the toolbar dropdown
// and the modal, so dedupe by field+value to count each selection once.
function reflectFilters(form) {
  const seen = new Set();
  const byGroup = new Map();
  let total = 0;

  for (const el of form.querySelectorAll("input:checked")) {
    // The exclusive toggle is a refinement of the membership selection, not a
    // filter of its own — it must never count into badges or the total.
    // The nearby source is scope, not a filter: it ships CHECKED, so counting
    // it would pin data-explorer-filtered to "true" forever and permanently
    // hide the discovery collections. (Its visible partner needs no exemption
    // — it carries no fs-list-field, so the guard below already skips it.)
    if (el.matches(S.exclusiveToggle) || el.matches(S.nearbySource)) continue;
    const field = el.getAttribute("fs-list-field");
    if (!field || field === "*") continue;
    const key = `${field} ${el.getAttribute("fs-list-value") ?? el.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byGroup.set(field, (byGroup.get(field) ?? 0) + 1);
    total += 1;
  }

  form.dataset.hasFilters = total > 0 ? "true" : "false";

  form.querySelectorAll(S.searchGroup).forEach((el) => {
    const group = el.getAttribute("data-search-group") || "";
    el.dataset.hasFilters = (byGroup.get(group) ?? 0) > 0 ? "true" : "false";
  });

  form.querySelectorAll(S.searchCount).forEach((el) => {
    const group = el.getAttribute("data-search-count");
    el.textContent = String(group ? (byGroup.get(group) ?? 0) : total);
  });

  // Collections hide on any active checkbox OR a non-empty text query.
  const query = /** @type {HTMLInputElement | null} */ (
    form.querySelector(`input[name="${QUERY_FIELD}"]`)
  );
  const active = total > 0 || !!query?.value.trim();
  const wrap = form.closest(S.wrap);
  if (wrap instanceof HTMLElement) {
    wrap.dataset.explorerFiltered = active ? "true" : "false";
  }
}

// ── Exclusive toggle ─────────────────────────────────────────
// The membership radios (fs-list-field="tiers", operator contain) natively
// filter to the studios INCLUDED in the selected membership. The exclusive
// toggle is a real Finsweet condition input (fs-list-field="tier", operator
// equal) with NO authored fs-list-value: this function keeps that attribute
// pointed at the selected membership and dispatches a change event so
// Finsweet re-reads the condition. tier=X implies X ∈ tiers, so the two
// conditions AND into "exclusive to X" — a strict subset, never a negation.
// Spec: docs/superpowers/specs/2026-07-06-explorer-membership-filter-design.md
const MEMBERSHIP_RADIO = 'input[type="radio"][fs-list-field="tiers"]';

function syncExclusiveToggle(form) {
  // EVERY toggle in the form, not just the first. The shipped page renders the
  // filter bar twice inside the single filters form — a desktop copy and a
  // mobile copy — and only one is visible at a time. A singular querySelector
  // here reached the desktop copy only: the mobile switch kept no
  // fs-list-value, so Finsweet fell back to its raw Webflow `value` ("Value"),
  // and `tier equal Value` matched no studio — the whole mobile layout filtered
  // to zero results the moment the switch was flipped. Same reasoning (and the
  // same mis-authoring guard) as syncNearbyToggle: the selector is a bare
  // attribute match, and a pair landing on the wrapping <label> instead of the
  // <input> must not put `.checked === undefined` into the logic below.
  const toggles = [...form.querySelectorAll(S.exclusiveToggle)].filter(
    (el) => el instanceof HTMLInputElement,
  );
  if (toggles.length === 0) return;

  // All copies share one radio group (same `name`), so this finds the user's
  // selection whichever copy they picked it in.
  const radio = form.querySelector(`${MEMBERSHIP_RADIO}:checked`);
  const selected = radio?.getAttribute("fs-list-value") ?? radio?.value ?? "";

  for (const toggle of toggles) {
    // No membership → no reference for "exclusive"; force the switch off via
    // click (never .checked — that desyncs Finsweet and the Webflow visuals).
    if (!selected && toggle.checked) toggle.click();

    // Rewrite + re-dispatch only when the value really changed. Finsweet
    // re-reads the condition on the form's `fs-list-filteron` event, which
    // DEFAULTS to "input" — a synthetic "change" alone is never heard and the
    // stale tier would keep filtering. Dispatch both so the rewrite lands
    // whichever event the form is authored with; our own form listener hears
    // the "change", re-enters this function, and terminates on this equality
    // check.
    if (toggle.getAttribute("fs-list-value") !== selected) {
      toggle.setAttribute("fs-list-value", selected);
      toggle.dispatchEvent(new Event("input", { bubbles: true }));
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  const wrap = form.closest(S.wrap);
  if (wrap instanceof HTMLElement) {
    if (selected) wrap.dataset.explorerMembership = selected;
    else delete wrap.dataset.explorerMembership;
    wrap.dataset.explorerExclusiveAvailable = selected ? "true" : "false";
    // Any copy being on means exclusive is engaged — the user only ever sees
    // one of them, so reading the first alone left this stuck on "false" for
    // the entire mobile layout.
    wrap.dataset.explorerExclusive =
      selected && toggles.some((el) => el.checked) ? "true" : "false";
  }
}

// ── Nearby-areas toggle ──────────────────────────────────────
// The visible switch reads positively ("Show studios in nearby areas") but the
// underlying Finsweet condition narrows: `in-metro equal true` must be ACTIVE
// while the switch is OFF. A Finsweet input only contributes while checked, so
// one input cannot express that. The state is split across a visible toggle
// and a hidden source that are always inverses, and this function keeps them
// so across every pair inside ONE form (form.querySelectorAll) — which is
// what makes the duplicated desktop/mobile filter bars agree without
// special-casing them, since the shipped markup keeps both copies inside the
// single filters form. refreshFilterForms is what extends this across every
// filters form on the page, if more than one ever exists.
//
// Writes are asymmetric, and deliberately:
//   - sources via .click(), never .checked — .checked desyncs Finsweet's model,
//     and the click's `input` event is what makes Finsweet re-read the
//     condition (fs-list-filteron defaults to "input").
//   - toggles via .checked, never .click() — they are not Finsweet inputs,
//     their visuals are pure CSS :has(:checked), and a click would re-enter
//     this function down the wrong branch.
//
// Spec: docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
let nearbyClearPending = false;
let nearbyClearBound = false;

function syncNearbyToggle(form, origin, clearPending) {
  // Filter to real inputs, matching syncExclusiveToggle's guard: the selectors
  // are bare attribute selectors, and a mis-authored pair (the attribute
  // landed on the wrapping <label> instead of the nested <input>) would
  // otherwise put `.checked === undefined` into the plan below. That never
  // equals a boolean, so the "only click what disagrees" guard never holds
  // and `.click()` fires on every re-entry — unbounded recursion.
  const toggleEls = [...form.querySelectorAll(S.nearbyToggle)].filter(
    (el) => el instanceof HTMLInputElement,
  );
  const sourceEls = [...form.querySelectorAll(S.nearbySource)].filter(
    (el) => el instanceof HTMLInputElement,
  );
  // Zero toggles means nothing to sync, full stop. Zero SOURCES is different —
  // the visible switch is still real, and must still spring back off after
  // the user flips it — so that half of the early return was dropped:
  // planNearby's degenerate-input branch already answers `nearby: false` when
  // `sources` is empty, which is what makes that happen.
  if (toggleEls.length === 0) return;

  const originKind =
    origin instanceof Element
      ? origin.matches(S.nearbyToggle)
        ? "toggle"
        : origin.matches(S.nearbySource)
          ? "source"
          : null
      : null;

  const plan = planNearby({
    toggles: toggleEls.map((el) => el.checked),
    sources: sourceEls.map((el) => el.checked),
    originKind,
    originIndex: originKind === "toggle" ? toggleEls.indexOf(origin) : -1,
    clearPending,
  });

  toggleEls.forEach((el, i) => {
    if (el.checked !== plan.toggles[i]) el.checked = plan.toggles[i];
  });
  // Only click what actually disagrees — this equality guard is what
  // terminates the change → click → change cycle.
  sourceEls.forEach((el, i) => {
    if (el.checked !== plan.sources[i]) el.click();
  });

  const wrap = form.closest(S.wrap);
  if (wrap instanceof HTMLElement) {
    wrap.dataset.explorerNearby = plan.nearby ? "true" : "false";
  }
}

// "Clear all" resets the page to its defaults, and the default is metro-only.
// Finsweet's clear would otherwise leave the source unchecked — a cleared
// state that differs from the initial one. We raise a flag here; whichever
// refreshFilterForms sees it first reads it ONCE and lowers it in the same
// breath (before dispatching to any form), so it never survives past the
// render that consumes it. But that render isn't guaranteed to happen at
// all: Finsweet only re-renders (firing afterRender) when the clear actually
// changes something, and on an already metro-only, otherwise-unfiltered page
// it doesn't — so afterRender can simply never come, and with it never
// consumed, the flag would sit raised until whatever LATER, unrelated
// interaction next triggers a refresh (e.g. picking a category), silently
// applying the clear to that instead. NEARBY_CLEAR_FALLBACK_MS bounds that:
// if the flag is still raised a beat past Finsweet's debounce, we apply the
// clear ourselves, so it can never outlive the click that raised it.
// Delegated on the document because the clear buttons live OUTSIDE the
// filters form.
function bindNearbyClear() {
  if (nearbyClearBound) return;
  nearbyClearBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(S.globalClear)) {
      nearbyClearPending = true;
      setTimeout(() => {
        // Still raised means no render ever consumed it — apply the clear
        // ourselves. If Finsweet DID render in the meantime,
        // refreshFilterForms already lowered the flag and this is a no-op.
        if (nearbyClearPending) refreshFilterForms();
      }, NEARBY_CLEAR_FALLBACK_MS);
    }
  });
}

// Keep the city-switch links (toolbar dropdown + modal + locale copies) in sync
// with the live filter query, so changing city carries the active filters with
// it ("Yoga in Gothenburg" → "Yoga in Oslo"). Category/tier are city-agnostic,
// so they transfer cleanly; the free-text query rides along too. Pagination
// (`…_page`) is stripped — a different city's result set means page 1, not
// wherever the user happened to be. The city itself is the URL path, not a
// param, so there's no conflict. We rewrite hrefs (rather than intercept
// clicks) so middle-click / open-in-new-tab / accessibility all still work.
function syncCityLinks() {
  const params = new URLSearchParams(location.search);
  for (const key of [...params.keys()]) {
    if (key.endsWith("_page")) params.delete(key);
  }
  const search = params.toString() ? `?${params}` : "";
  document.querySelectorAll(S.cityLink).forEach((link) => {
    if (link instanceof HTMLAnchorElement) link.search = search;
  });
}

// Reflect every filters form on the page. Driven by the Finsweet afterRender
// hook (covers URL restore on load, "Clear all", native query changes) and by
// a direct `change` listener (instant, ahead of Finsweet's 200ms debounce).
function refreshFilterForms() {
  // Read-then-lower BEFORE the loop: this is the single point that consumes
  // the flag, so it cannot survive this dispatch even if a form's sync throws
  // or Finsweet never re-renders again. Every form still gets the clear via
  // the local.
  const clearPending = nearbyClearPending;
  nearbyClearPending = false;
  document.querySelectorAll(S.filtersForm).forEach((form) => {
    if (form instanceof HTMLFormElement) {
      syncExclusiveToggle(form);
      syncNearbyToggle(form, null, clearPending);
      reflectFilters(form);
    }
  });
  syncCityLinks();
}

// One-time wiring per form: block native submit (so Enter / the modal's
// "Search studios" button never reloads out from under Finsweet) and reflect
// instantly on interaction. reflectFilters is idempotent, so the double-run
// with afterRender is harmless.
function setupFilterForms() {
  bindNearbyClear();
  document.querySelectorAll(S.filtersForm).forEach((el) => {
    const form = /** @type {HTMLFormElement} */ (el);
    if (form.dataset.explorerFiltersInit) return;
    form.dataset.explorerFiltersInit = "true";
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("change", (event) => {
      syncExclusiveToggle(form);
      // clearPending is always false here — even when this fires as the
      // reentrant `change` from a clear's forced .click() on a source (see
      // refreshFilterForms). By that point the click has already made the
      // source agree with what the clearPending pass computed, so the
      // canonical-source branch below independently re-derives the same
      // `nearby: false` on its own; the flag doesn't need to reach this
      // listener for the clear to hold.
      syncNearbyToggle(form, event.target, false);
      reflectFilters(form);
      syncCityLinks();
    });
    syncExclusiveToggle(form);
    syncNearbyToggle(form, null, false);
    reflectFilters(form);
  });
  // Carry any URL-restored filters into the city links on first paint, before
  // Finsweet binds and afterRender takes over.
  syncCityLinks();
}

// ── Map: city coords ─────────────────────────────────────────
// The page's city is the URL slug (`<html data-wf-item-slug="oslo">`). Its
// lng/lat live in the hidden [data-city-list] CMS list, one item per city
// carrying data-city-slug / data-city-var-lat / data-city-var-lng. Returns a
// [lng, lat] pair (Mapbox order) or null when the slug isn't found / unparseable.
function getPageCityCoords() {
  const slug = document.documentElement.getAttribute("data-wf-item-slug");
  if (!slug) return null;
  const el = document.querySelector(
    `${S.cityList} [data-city-slug="${CSS.escape(slug)}"]`,
  );
  if (!el) return null;
  const lat = parseFloat(el.getAttribute("data-city-var-lat"));
  const lng = parseFloat(el.getAttribute("data-city-var-lng"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lng, lat];
}

// ── Map: feature extraction ──────────────────────────────────
// CMS values are immutable post-render, so parsing each item once is safe; the
// WeakMap auto-GCs when items leave the DOM.
const featureCache = new WeakMap();

function extractOne(el) {
  if (featureCache.has(el)) return featureCache.get(el);

  const latEl = el.querySelector(S.lat);
  const lngEl = el.querySelector(S.lng);
  const markerEl = el.querySelector(S.marker);
  if (!latEl || !lngEl || !markerEl) {
    featureCache.set(el, null);
    return null;
  }

  const lat = parseFloat(latEl.textContent);
  const lng = parseFloat(lngEl.textContent);
  // 0,0 is the CMS "no coordinates" sentinel (Gulf of Guinea) — skip it so a
  // studio without a location doesn't drop a marker off the African coast.
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0)) {
    featureCache.set(el, null);
    return null;
  }

  const idEl = el.querySelector(S.id);
  const feature = {
    coordinates: [lng, lat],
    id: idEl ? idEl.textContent.trim() : "",
    markerEl,
    popupEl: el.querySelector(S.popup),
  };
  featureCache.set(el, feature);
  return feature;
}

let hasWarnedAboutSkipped = false;
function extractFeatures(elements) {
  const features = [];
  let skipped = 0;
  elements.forEach((el) => {
    const one = extractOne(el);
    if (one) features.push(one);
    else skipped++;
  });
  if (skipped && !hasWarnedAboutSkipped) {
    hasWarnedAboutSkipped = true;
    console.warn(
      `[explorer] Mapped ${features.length} / ${elements.length} items. Skipped ${skipped} with missing/invalid ${S.lat} / ${S.lng} / ${S.marker} (or 0,0 coords). Logged once per session.`,
    );
  }
  return features;
}

// Deep-clones a per-item template (the in-card marker / popup). Cloning (vs
// moving) keeps the CMS-bound source in the card intact and lets the same
// element be rendered on the map repeatedly. Strips ids + the element hooks so
// clones never match template queries.
function cloneTemplate(sourceEl) {
  if (!sourceEl) return null;
  const clone = sourceEl.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.style.display = "";
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.removeAttribute("data-explorer-element");
    clone
      .querySelectorAll("[data-explorer-element]")
      .forEach((n) => n.removeAttribute("data-explorer-element"));
  }
  return clone;
}

function pointKey(feature) {
  return feature.id || feature.coordinates.join(",");
}

// True when the wrap's inline size is below the split breakpoint, measured in
// the wrap's OWN font-size (same basis CSS container queries use for em). Read
// fresh each call so width / font-size changes are picked up without caching.
function isMobileLayout(el) {
  const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
  return el.clientWidth < LAYOUT_BREAKPOINT_EM * fontSize;
}

// Cluster bubble size tier → `data-size` on the cluster element. The Webflow
// embed sizes md/lg/xl; sm falls back to the base .explorer_cluster_wrap style.
function getClusterSizeTier(count) {
  if (count < 10) return "sm";
  if (count < 50) return "md";
  if (count < 200) return "lg";
  return "xl";
}

function applyClusterMeta(el, count, countSelector) {
  if (!(el instanceof HTMLElement)) return;
  el.dataset.size = getClusterSizeTier(count);
  const slot = countSelector ? el.querySelector(countSelector) : null;
  if (slot) slot.textContent = String(count);
}

// Loads mapbox-gl (via the shared loader) + supercluster on first call, caching
// the promise so every caller awaits the same single load. Resolves with the
// global `mapboxgl`; supercluster lands on `window.Supercluster`.
let mapLibsPromise = null;
function loadMapLibs() {
  if (mapLibsPromise) return mapLibsPromise;
  mapLibsPromise = Promise.all([
    loadMapboxGl(),
    window.Supercluster
      ? Promise.resolve()
      : loadScriptOnce(SUPERCLUSTER_JS_URL),
  ]).then(([gl]) => gl);
  return mapLibsPromise;
}

// ── Map controller ───────────────────────────────────────────
// One per explorer instance. Owns the toggle, the lazy Mapbox init, the point
// markers + popups and the camera. Markers render from the FULL filtered set
// (captured in the filter hook), so every match lands on the map regardless of
// which page the paginated list is showing.
function setupMap(wrap, getFeatures, { requestFilter } = {}) {
  const mapTargetEl = wrap.querySelector(S.mapTarget);
  const clusterTemplateEl = wrap.querySelector(S.clusterTemplate);
  const userLocationTemplateEl = wrap.querySelector(S.userLocationTemplate);
  const sheetEl = wrap.querySelector(S.sheet);
  const sheetMountEl = wrap.querySelector(S.sheetMount);
  const sheetHeaderEl = wrap.querySelector(S.sheetHeader);
  const resultsPanelEl = wrap.querySelector(S.resultsPanel);
  const filterBarEl = wrap.querySelector(S.filterBar);
  const toggleEls = /** @type {HTMLElement[]} */ ([
    ...wrap.querySelectorAll(S.mapToggle),
  ]);
  const locateEls = /** @type {HTMLElement[]} */ ([
    ...wrap.querySelectorAll(S.locate),
  ]);
  const searchAreaEls = /** @type {HTMLElement[]} */ ([
    ...wrap.querySelectorAll(S.searchArea),
  ]);

  if (!clusterTemplateEl) {
    console.warn(
      `[explorer] Missing ${S.clusterTemplate} — clusters can't render. Points will still drop individually.`,
    );
  }

  // Anchors the results panel's home position so it can be restored to the exact
  // spot after a stint in the sheet. A comment node survives sibling re-renders
  // (pagination, etc.) where a parent+nextSibling snapshot might not.
  const resultsHomeAnchor = resultsPanelEl
    ? document.createComment("explorer-results-home")
    : null;
  if (resultsPanelEl && resultsHomeAnchor) {
    resultsPanelEl.before(resultsHomeAnchor);
  }
  // Same anchor trick for the filter bar (see placeFilterBar).
  const filterBarHomeAnchor = filterBarEl
    ? document.createComment("explorer-filter-bar-home")
    : null;
  if (filterBarEl && filterBarHomeAnchor) {
    filterBarEl.before(filterBarHomeAnchor);
  }
  // The sheet chrome ([part="sheet"]) in the component's shadow DOM, resolved
  // once the element upgrades; null until then (and on desktop, where unused).
  let sheetChrome = null;

  let mapboxgl = null;
  let Supercluster = null;
  let map = null;
  let mapLoaded = false;
  let mapInitStarted = false;
  let mapOpen = false;
  let lastSignature = null;
  let clusterIndex = null;
  // Memoised viewport key (bbox + zoom) — skips re-clustering when neither moved.
  let lastRenderKey = null;
  let activePopup = null;
  let userLocationMarker = null;
  // A location resolved before the map finished loading; flushed on map load.
  let pendingUserLocation = null;
  // "Search this area" plumbing: the button is dirty once the user pans, and a
  // click arms a one-shot bounds narrowing consumed by the next filter pass.
  let searchAreaDirty = false;
  let boundsFilterPending = false;
  let boundsPassActive = false;
  // Reused across renders so Mapbox can `setLngLat` markers (smooth) and CSS
  // transitions animate on the same element instead of recreating nodes.
  const pointMarkers = new Map(); // pointKey -> { marker, feature }
  const clusterMarkers = new Map(); // cluster_id -> { marker, clusterId, coords }

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  function openPopup(feature) {
    closePopup();
    const content = cloneTemplate(feature.popupEl);
    if (!content) return;
    activePopup = new mapboxgl.Popup({
      className: POPUP_CLASS,
      closeButton: false,
      closeOnClick: true,
      maxWidth: "none",
    })
      .setLngLat(feature.coordinates)
      .setDOMContent(content)
      .addTo(map);
    activePopup.on("close", () => {
      activePopup = null;
    });
  }

  // Mounts a DOM element as a Mapbox marker, fades it in, and wires a click.
  function attachMarker(el, coords, onClick) {
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(coords)
      .addTo(map);
    // Opacity-only fade; animating transform would fight Mapbox's per-frame
    // marker positioning during pan/zoom.
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: MARKER_FADE_DURATION,
      easing: "ease-out",
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return marker;
  }

  function addPointMarker(feature) {
    const el = cloneTemplate(feature.markerEl);
    if (!el) return;
    const entry = { feature };
    entry.marker = attachMarker(el, feature.coordinates, () => {
      openPopup(entry.feature);
      map.flyTo({
        center: entry.feature.coordinates,
        speed: 0.6,
        padding: bottomPad(),
      });
    });
    pointMarkers.set(pointKey(feature), entry);
  }

  // A cluster bubble. Clicking zooms to the point where supercluster breaks the
  // cluster apart (+ padding), so the studios underneath become visible.
  function addClusterMarker(cluster) {
    const el = cloneTemplate(clusterTemplateEl);
    if (!el) return;
    applyClusterMeta(el, cluster.properties.point_count, S.count);
    const entry = {
      clusterId: cluster.properties.cluster_id,
      coords: cluster.geometry.coordinates,
    };
    entry.marker = attachMarker(el, entry.coords, () => {
      const expansionZoom = clusterIndex.getClusterExpansionZoom(
        entry.clusterId,
      );
      map.flyTo({
        center: entry.coords,
        zoom: expansionZoom + CLUSTER_EXPANSION_PADDING,
        duration: FIT_BOUNDS_CONFIG.duration,
        padding: bottomPad(),
      });
    });
    clusterMarkers.set(entry.clusterId, entry);
  }

  function clearMarkers() {
    clusterMarkers.forEach((e) => e.marker.remove());
    clusterMarkers.clear();
    pointMarkers.forEach((e) => e.marker.remove());
    pointMarkers.clear();
  }

  // How many CSS px of the map canvas the bottom-sheet currently covers. Used
  // as extra bottom padding on camera ops so the framed studios land in the
  // visible strip ABOVE the sheet, not behind it. 0 on desktop / before the
  // sheet upgrades / when the sheet sits beside (not over) the map.
  function sheetCoverage() {
    if (!sheetChrome || !mapTargetEl) return 0;
    const c = sheetChrome.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return 0;
    const t = mapTargetEl.getBoundingClientRect();
    const horizontalOverlap =
      Math.min(c.right, t.right) - Math.max(c.left, t.left);
    if (horizontalOverlap <= 0) return 0;
    return Math.min(Math.max(0, t.bottom - c.top), t.height);
  }

  // Camera padding that keeps a fly-to's focal point in the strip ABOVE the
  // sheet — the map's "active area" is what's visible, never the part the sheet
  // covers. 0 on desktop / before the sheet upgrades, so it's a no-op there.
  function bottomPad() {
    return { top: 0, right: 0, left: 0, bottom: sheetCoverage() };
  }

  function fitToFeatures(features) {
    if (!map) return;
    const cov = sheetCoverage();
    const pad = {
      top: FIT_BOUNDS_CONFIG.padding,
      right: FIT_BOUNDS_CONFIG.padding,
      left: FIT_BOUNDS_CONFIG.padding,
      bottom: FIT_BOUNDS_CONFIG.padding + cov,
    };
    const pts = features.map((f) => f.coordinates);
    if (pts.length === 0) {
      const c = getPageCityCoords();
      if (c) {
        map.flyTo({
          center: c,
          zoom: CITY_ZOOM,
          duration: FIT_BOUNDS_CONFIG.duration,
          padding: bottomPad(),
        });
      }
      return;
    }
    if (pts.length === 1) {
      map.flyTo({
        center: pts[0],
        zoom: SINGLE_FEATURE_ZOOM,
        duration: FIT_BOUNDS_CONFIG.duration,
        padding: bottomPad(),
      });
      return;
    }
    const bounds = pts.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(),
    );
    map.fitBounds(bounds, {
      padding: pad,
      maxZoom: FIT_BOUNDS_CONFIG.maxZoom,
      duration: FIT_BOUNDS_CONFIG.duration,
    });
  }

  // (Re)builds the supercluster index from the current feature set. Clearing
  // the markers here is required: cluster_ids are regenerated per index, so
  // reusing stale clusters would wire markers to ids that no longer exist.
  function rebuildIndex(features) {
    if (features.length === 0) {
      // Supercluster.load() throws on an empty array, which would reject the
      // caller; represent "nothing to cluster" as a null index instead.
      clusterIndex = null;
    } else {
      clusterIndex = new Supercluster(CLUSTER_CONFIG).load(
        features.map((f) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: f.coordinates },
          properties: { feature: f },
        })),
      );
    }
    lastRenderKey = null;
    clearMarkers();
  }

  // Renders the clusters + points for the current viewport, upserting markers
  // (move, don't recreate) and pruning any that left the view. Cheap to call on
  // every moveend — the bbox+zoom key short-circuits when nothing changed.
  function renderClusters() {
    if (!mapLoaded || !clusterIndex) return;

    const bbox = map.getBounds().toArray().flat();
    const zoom = Math.floor(map.getZoom());
    // Round bbox to ~11m so float jitter from programmatic camera ops doesn't
    // bust the cache.
    const renderKey = `${bbox.map((n) => n.toFixed(4)).join(",")}|${zoom}`;
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    const seenClusters = new Set();
    const seenPoints = new Set();

    clusterIndex.getClusters(bbox, zoom).forEach((item) => {
      if (item.properties.cluster) {
        const id = item.properties.cluster_id;
        seenClusters.add(id);
        const existing = clusterMarkers.get(id);
        if (existing) {
          existing.marker.setLngLat(item.geometry.coordinates);
          existing.coords = item.geometry.coordinates;
          applyClusterMeta(
            existing.marker.getElement(),
            item.properties.point_count,
            S.count,
          );
        } else {
          addClusterMarker(item);
        }
      } else {
        const feature = item.properties.feature;
        const id = pointKey(feature);
        seenPoints.add(id);
        const existing = pointMarkers.get(id);
        if (existing) {
          existing.marker.setLngLat(feature.coordinates);
          existing.feature = feature;
        } else {
          addPointMarker(feature);
        }
      }
    });

    clusterMarkers.forEach((entry, id) => {
      if (seenClusters.has(id)) return;
      entry.marker.remove();
      clusterMarkers.delete(id);
    });
    pointMarkers.forEach((entry, id) => {
      if (seenPoints.has(id)) return;
      entry.marker.remove();
      pointMarkers.delete(id);
    });
  }

  // Rebuilds the index + reframes the camera only when the feature set actually
  // changed (so a pagination click, which re-fires afterRender with the same
  // set, never yanks the view). Viewport-only changes go through renderClusters.
  function render(features, { fit = false } = {}) {
    if (!mapLoaded || !map) return;
    const signature = features.map(pointKey).join("|");
    const changed = signature !== lastSignature;
    if (!changed) return;
    lastSignature = signature;

    closePopup();
    rebuildIndex(features);
    renderClusters();
    if (fit) fitToFeatures(features);
  }

  // Lazily build the map on first open: load the CDN libs, create the map
  // centered on the page city, then render whatever features are loaded. Runs
  // at most once. The container is visible by now (the open attribute is set
  // before this), so Mapbox sizes its canvas correctly.
  function ensureMap() {
    if (mapInitStarted || !mapTargetEl) return;
    mapInitStarted = true;
    loadMapLibs()
      .then((gl) => {
        mapboxgl = gl;
        Supercluster = window.Supercluster;
        map = new mapboxgl.Map({
          container: mapTargetEl,
          style: MAPBOX_STYLE,
          projection: "globe",
          center: getPageCityCoords() || DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
        });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }));
        // The container is toggled (display:none ↔ visible) and reflows between
        // the desktop split and mobile overlay; keep the canvas sized to it.
        new ResizeObserver(() => map && map.resize()).observe(mapTargetEl);
        map.on("load", () => {
          mapLoaded = true;
          // Signal to CSS that the canvas has rendered — drives the spinner
          // (hidden once ready) and the map chrome (revealed once ready). Set
          // once; never unset, so reopening doesn't re-show the spinner.
          wrap.dataset.explorerMapReady = "true";
          render(getFeatures(), { fit: true });
          // A locate fix that resolved during load.
          if (pendingUserLocation) {
            showUserLocation(pendingUserLocation);
            pendingUserLocation = null;
          }
        });
        // Re-cluster as the user pans / zooms. `originalEvent` is only present
        // on user-driven moves (pan/pinch/wheel) — programmatic flyTo/fitBounds
        // don't carry it — so we only arm "search this area" on real interaction.
        map.on("moveend", (e) => {
          renderClusters();
          if (e.originalEvent) setSearchAreaDirty(true);
        });
      })
      .catch((err) => console.error("[explorer] map failed to load", err));
  }

  // ── Locate ───────────────────────────────────────────────────
  // State mirrored across every locate button (toolbar + map panel) via
  // `data-explorer-locate-state` so CSS can show a spinner / error tick.
  function setLocateState(state) {
    locateEls.forEach((el) => {
      el.dataset.explorerLocateState = state;
    });
  }

  function setUserLocationMarker(loc) {
    if (userLocationMarker) {
      userLocationMarker.setLngLat(loc);
      return;
    }
    const el = cloneTemplate(userLocationTemplateEl);
    if (!el) return;
    userLocationMarker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(loc)
      .addTo(map);
  }

  // Drops/moves the user-location marker and flies to it. Queues until the map
  // has loaded (geolocation can resolve before the lazy map finishes).
  function showUserLocation(loc) {
    if (!loc) return;
    if (!mapLoaded || !map) {
      pendingUserLocation = loc;
      return;
    }
    setUserLocationMarker(loc);
    map.flyTo({
      center: loc,
      zoom: USER_LOCATION_ZOOM,
      duration: FIT_BOUNDS_CONFIG.duration,
      padding: { top: 0, right: 0, left: 0, bottom: sheetCoverage() },
    });
  }

  // Clicking locate also opens the map (so "show my location" has somewhere to
  // show it), then requests a fresh fix. Bound on every copy.
  locateEls.forEach((btn) => {
    btn.addEventListener("click", async () => {
      setMapMode(true);
      setLocateState("locating");
      const loc = await requestUserLocation();
      setLocateState(loc ? "success" : "error");
      showUserLocation(loc);
    });
  });

  // ── Search this area ─────────────────────────────────────────
  // `.is-active` (the site-wide Finsweet convention) marks the button visible /
  // dirty; mirrored across copies.
  function setSearchAreaDirty(dirty) {
    if (dirty === searchAreaDirty) return;
    searchAreaDirty = dirty;
    searchAreaEls.forEach((el) => el.classList.toggle("is-active", dirty));
  }

  // Arms a one-shot bounds narrowing and asks Finsweet to re-run its pipeline.
  // The filter hook (in the instance) calls back into `filterToBounds`.
  searchAreaEls.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!mapLoaded || !map || typeof requestFilter !== "function") return;
      boundsFilterPending = true;
      requestFilter();
      setSearchAreaDirty(false);
    });
  });

  // ── Mobile scroll lock ───────────────────────────────────────
  // The fullscreen map overlay only exists on mobile; lock the page behind it
  // so background scroll doesn't bleed through. No-op on the desktop split.
  function applyScrollLock() {
    const lock = mapOpen && isMobileLayout(wrap);
    document.documentElement.style.overflow = lock ? "hidden" : "";
  }

  // Moves the single Finsweet results panel into the sheet when the map is open
  // on a mobile layout, and back to its home spot otherwise (desktop split, or
  // mobile with the map closed). Re-parenting an attached subtree doesn't break
  // Finsweet (it binds by element reference), so the list, filters and map all
  // keep working across the move — no duplicate list, no re-init.
  function placeResults() {
    if (!resultsPanelEl || !resultsHomeAnchor) return;
    const intoSheet = mapOpen && sheetMountEl && isMobileLayout(wrap);
    if (intoSheet) {
      if (resultsPanelEl.parentElement !== sheetMountEl) {
        sheetMountEl.appendChild(resultsPanelEl);
      }
    } else if (resultsPanelEl.previousSibling !== resultsHomeAnchor) {
      resultsHomeAnchor.after(resultsPanelEl);
    }
  }

  // Moves the filters form into the sheet's header slot when the map is open on
  // a mobile layout, and back to its home spot otherwise (desktop split, or
  // mobile with the map closed). The element moved is the .w-form wrapper that
  // CONTAINS the whole <form fs-list-element="filters">, so every input travels
  // inside its form — Finsweet binds the form by reference, so re-parenting it
  // whole keeps filtering intact (same reasoning as placeResults). The Map
  // toggle is a sibling OUTSIDE filter-bar, so it stays behind the overlay; the
  // overlay/sheet toggles close the map.
  function placeFilterBar() {
    if (!filterBarEl || !filterBarHomeAnchor) return;
    const intoSheet = mapOpen && sheetHeaderEl && isMobileLayout(wrap);
    if (intoSheet) {
      if (filterBarEl.parentElement !== sheetHeaderEl) {
        sheetHeaderEl.appendChild(filterBarEl);
      }
    } else if (filterBarEl.previousSibling !== filterBarHomeAnchor) {
      filterBarHomeAnchor.after(filterBarEl);
    }
  }

  // Publishes the sheet's live height as a CSS var and its snap state as
  // `data-explorer-sheet` on the wrap, so CSS can react (e.g. fade the map
  // chrome when the sheet is fully expanded). Resolves the shadow chrome once
  // the custom element upgrades. The map is NOT auto-refit on drag — the user's
  // chosen view stays put; we only keep the var current.
  function initSheetMetrics() {
    if (!sheetEl) return;
    customElements.whenDefined(SHEET_TAG).then(() => {
      sheetChrome = sheetEl.shadowRoot?.querySelector('[part="sheet"]');
      if (!sheetChrome) return;
      let frame = null;
      const sync = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          const h = sheetChrome.getBoundingClientRect().height;
          wrap.style.setProperty(SHEET_HEIGHT_VAR, `${h}px`);
        });
      };
      sync();
      sheetEl.addEventListener("scroll", sync, { passive: true });
      sheetEl.addEventListener("snap-position-change", sync);
      new ResizeObserver(sync).observe(sheetChrome);
    });
    sheetEl.addEventListener("snap-position-change", (event) => {
      const state = /** @type {any} */ (event).detail?.sheetState;
      if (state) wrap.dataset.explorerSheet = state;
    });
  }

  function setMapMode(open) {
    mapOpen = open;
    wrap.dataset[MAP_MODE_KEY] = open ? "open" : "closed";
    toggleEls.forEach((el) => el.setAttribute("aria-pressed", String(open)));
    placeResults();
    placeFilterBar();
    applyScrollLock();
    if (!open) return;
    ensureMap();
    if (map) requestAnimationFrame(() => map.resize());
    // Reopening after a filter change while closed → catch the map up.
    if (mapLoaded) render(getFeatures(), { fit: true });
  }

  toggleEls.forEach((el) =>
    el.addEventListener("click", () => setMapMode(!mapOpen)),
  );

  // Default view from `data-explorer-map-default="open|closed"` on .explorer_wrap
  // (default closed). Honoured only on a desktop split — opening by default on
  // mobile would throw up a fullscreen overlay + bottom-sheet + scroll lock
  // before any interaction, and forfeit the lazy map load on the weakest devices.
  // setMapMode sets the mode attr + aria-pressed and handles everything an open
  // implies (lazy init, placement, scroll lock, camera fit).
  const defaultOpen =
    wrap.getAttribute("data-explorer-map-default") === "open" &&
    !isMobileLayout(wrap);
  setMapMode(defaultOpen);

  if (toggleEls.length === 0) {
    console.warn(
      `[explorer] No ${S.mapToggle} found — the map can't be opened. Add data-explorer-element="map-toggle" to the Map button.`,
    );
  }

  // Re-evaluate placement when the layout crosses the breakpoint (rotate /
  // resize) so the list moves between the desktop split and the sheet.
  let wasMobile = isMobileLayout(wrap);
  new ResizeObserver(() => {
    const nowMobile = isMobileLayout(wrap);
    if (nowMobile === wasMobile) return;
    wasMobile = nowMobile;
    placeResults();
    placeFilterBar();
    applyScrollLock();
    if (map) map.resize();
  }).observe(wrap);

  initSheetMetrics();
  placeResults();
  placeFilterBar();

  return {
    isOpen: () => mapOpen,
    // Called from afterRender so the map follows live filtering when it's open.
    // Skipped on a "search this area" pass — that only narrows the list; the
    // markers + camera stay put on the view the user just searched.
    refresh: (features) => {
      if (mapOpen) render(features, { fit: true });
    },
    // One-shot: when a search-area click armed it, narrow `items` to the current
    // map viewport. Otherwise pass through untouched.
    filterToBounds: (items) => {
      if (!boundsFilterPending || !mapLoaded || !map) return items;
      boundsFilterPending = false;
      boundsPassActive = true;
      const bounds = map.getBounds();
      return items.filter((item) => {
        const f = extractOne(item.element);
        return !f || bounds.contains(f.coordinates);
      });
    },
    // True for the single afterRender that follows a bounds narrowing; resets on
    // read so the caller skips the marker rebuild/refit exactly once.
    consumeBoundsPass: () => {
      const was = boundsPassActive;
      boundsPassActive = false;
      return was;
    },
  };
}

function setupExplorerInstance(fsListInstance) {
  const wrap = fsListInstance.wrapperElement.closest(S.wrap);
  if (!wrap) {
    console.warn(
      `[explorer] No ${S.wrap} ancestor for the Finsweet list`,
      fsListInstance.wrapperElement,
    );
    return;
  }

  // `data-state` on .explorer_wrap drives all loading/ready styling. CSS reads
  // `.explorer_wrap[data-state="…"]`:
  //   loading   (default, no attr) → skeletons visible, map chrome hidden
  //   filtering → a filter changed and the render is in flight > FILTERING_DELAY_MS
  //   ready     → render done, results present
  //   empty     → render done, zero results
  const overThreshold = readOverThreshold(wrap);

  let currentState = "loading";
  let filteringTimeoutId = null;

  function setState(next) {
    if (filteringTimeoutId !== null) {
      clearTimeout(filteringTimeoutId);
      filteringTimeoutId = null;
    }
    if (next === currentState) return;
    currentState = next;
    wrap.dataset.state = next;
  }

  function scheduleFilteringTransition() {
    // Initial load owns its state — never downgrade loading to filtering.
    if (currentState === "loading" || currentState === "filtering") return;
    if (filteringTimeoutId !== null) return;
    filteringTimeoutId = setTimeout(() => {
      filteringTimeoutId = null;
      currentState = "filtering";
      wrap.dataset.state = "filtering";
    }, FILTERING_DELAY_MS);
  }

  // Post-filter, PRE-pagination set. The `filter` hook receives every item
  // matching the active filters; `afterRender` only sees the current page, so
  // we capture both the count and the items here and read them back when the
  // render settles. The map renders markers from this full set.
  let filteredCount = 0;
  let filteredItems = [];
  let latestFeatures = [];

  const mapController = setupMap(wrap, () => latestFeatures, {
    requestFilter: () => fsListInstance.triggerHook("filter"),
  });

  fsListInstance.addHook("filter", (items) => {
    // "Search this area" narrows the set to the map viewport (one-shot); a
    // normal filter pass returns everything matching the active filters.
    const result = mapController.filterToBounds(items);
    filteredCount = result.length;
    filteredItems = result;
    scheduleFilteringTransition();
    return result;
  });

  // `afterRender` fires after the full pipeline resolves on every change
  // (filter, sort, pagination, initial render). Update the count + settle the
  // state here so both user filters and the initial render stay in sync.
  fsListInstance.addHook("afterRender", (items) => {
    updateCountDisplay(wrap, filteredCount, overThreshold);
    refreshFilterForms();
    // A clear button unchecks its inputs as Finsweet processes the clear, which
    // can land just AFTER this hook. Reflect once more on the next frame so the
    // badges/has-filters catch the settled checkbox state (notably the tier
    // group, which clears a beat later than category).
    requestAnimationFrame(refreshFilterForms);
    setState(filteredCount === 0 ? "empty" : "ready");

    latestFeatures = extractFeatures(filteredItems.map((i) => i.element));
    // On a "search this area" pass the list is now narrowed to the viewport —
    // leave the markers + camera as the user framed them. Otherwise sync the map
    // to the new filtered set.
    if (!mapController.consumeBoundsPass())
      mapController.refresh(latestFeatures);
    return items;
  });
}

// Wire the filter forms at boot — a baseline reflection before Finsweet binds,
// so the badges and collections state are correct on first paint (incl. when
// the native query URL restores filters from a shared link).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFilterForms, {
    once: true,
  });
} else {
  setupFilterForms();
}

// Bind every Finsweet list whose wrapper lives inside an `.explorer_wrap`. We
// match by DOM ancestry rather than a fixed `fs-list-instance` name so the page
// works whether or not that attribute is set — the explorer page carries
// exactly one Finsweet list, and explorer.js only loads on this page.
window.FinsweetAttributes ||= [];
window.FinsweetAttributes.push([
  "list",
  (listInstances) => {
    listInstances
      .filter((instance) => instance.wrapperElement?.closest(S.wrap))
      .forEach((instance) => {
        if (initializedInstances.has(instance)) return;
        initializedInstances.add(instance);
        setupExplorerInstance(instance);
      });
  },
]);
