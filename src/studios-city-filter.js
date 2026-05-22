/**
 * Studios Heading City Picker (search page only)
 *
 * Replaces the old toolbar "Location" filter with a single-select city picker
 * inline in the result-count heading ("Over N studios in [City ▾]"). The
 * picker is the ONLY city control on the page and drives a single hidden
 * Finsweet `city` group, so the never-synced duplicate filter copies are gone.
 *
 * bruce.city is the source of truth for CONTEXT (map home + placeholders +
 * persistence). This module is a thin one-way bridge: a picker selection ->
 * bruce.city.set (context) + a hidden Finsweet input click (narrowing) -> the
 * count + map follow studios.js's afterRender pipeline. The heading reflects
 * the FILTER selection only and never reacts to context changes elsewhere.
 *
 * Auto-boot is guarded against a missing `document` so the module stays
 * importable in Node.
 */

import {
  nearestCitySlug,
  resolveInitialCitySelection,
  planCityFilterClicks,
} from "./studios-city-select.js";
import { shouldApplyDeepLinkFilters } from "./studios-deep-link.js";
import { requestUserLocation } from "./location.js";

const FS_LIST_INSTANCE_KEY = "studios";
const FILTERS_FORM = 'form[fs-list-element="filters"]';
const PICKER = "[data-studios-city-picker]";
const LABEL = "[data-studios-city-label]";
const OPTION = "[data-studios-city-option]";
const ALL_OPTION = '[data-studios-city-option="all"]';
const CITY_INPUT = 'input[fs-list-field="city"]';
const ACTIVE_ATTR = "data-studios-city-active";
const ALL = "all";

// PerformanceNavigationTiming.type for this load, or "navigate" where the API
// is unavailable (treated as a fresh inbound visit -> safe to engage).
function getNavigationType() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return /** @type {any} */ (nav)?.type ?? "navigate";
}

const cityApi = () => /** @type {any} */ (window).bruce?.city;

// slug -> the fs-list-value of the hidden inputs (the CMS city name).
function cityName(slug) {
  return cityApi()?.all?.().find((c) => c.slug === slug)?.name ?? null;
}

// fs-list-value of the currently-checked hidden city input, or null.
function checkedCityValue(form) {
  const checked = form.querySelector(`${CITY_INPUT}:checked`);
  return checked ? checked.getAttribute("fs-list-value") : null;
}

// Move the hidden single-select city group to `slug` (or null = all). One
// genuine click per change so we never leave two copies checked.
function syncHiddenFilter(form, slug) {
  const targetValue = slug ? cityName(slug) : null;
  const currentValue = checkedCityValue(form);
  for (const value of planCityFilterClicks({ targetValue, currentValue })) {
    const input = form.querySelector(
      `${CITY_INPUT}[fs-list-value="${CSS.escape(value)}"]`,
    );
    if (input) /** @type {HTMLElement} */ (input).click();
  }
}

function allLabel(picker) {
  return picker.querySelector(ALL_OPTION)?.textContent?.trim() || "All cities";
}

function updateLabel(picker, text) {
  const label = picker.querySelector(LABEL);
  if (label) label.textContent = text;
}

// `selection` is a city slug or "all".
function markActive(picker, selection) {
  picker.querySelectorAll(OPTION).forEach((el) => {
    const value = el.getAttribute("data-studios-city-option");
    el.setAttribute(ACTIVE_ATTR, value === selection ? "true" : "false");
  });
}

// Set the heading's label + active state without touching the hidden inputs.
function reflectSelection(picker, selection) {
  updateLabel(picker, selection === ALL ? allLabel(picker) : cityName(selection) ?? "");
  markActive(picker, selection);
}

// Full selection: drive context (bruce.city) + the hidden filter + the heading.
function applyCitySelection(picker, form, selection) {
  if (selection !== ALL) cityApi()?.set?.(selection); // context: map + placeholders
  syncHiddenFilter(form, selection === ALL ? null : selection);
  reflectSelection(picker, selection);
}

// Nearest city from geolocation, but ONLY if permission is already granted --
// never triggers a cold prompt. null on no permission / no fix / no coords.
async function resolveGrantedGeoCity() {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    if (status?.state !== "granted") return null;
  } catch {
    return null; // Permissions API unsupported -> never prompt.
  }
  const coords = await requestUserLocation();
  return nearestCitySlug(coords, cityApi()?.all?.() ?? []);
}

// Strong-signal initial engagement. Runs after Finsweet has bound the list.
async function engageInitial(picker, form) {
  const urlCitySlug = cityApi()?.urlSelection?.()[0]?.slug ?? null;
  const replay = shouldApplyDeepLinkFilters(getNavigationType());

  if (urlCitySlug) {
    if (replay) {
      applyCitySelection(picker, form, urlCitySlug);
    } else {
      // Back/forward: Finsweet restores the hidden city input itself from the
      // URL it owns. Don't re-click (would double-check + desync). Mirror the
      // URL city into context + heading only.
      cityApi()?.set?.(urlCitySlug);
      reflectSelection(picker, urlCitySlug);
    }
    return;
  }

  // No ?city= -> default to "all"; a granted-geo fix may upgrade it.
  applyCitySelection(picker, form, ALL);
  if (!replay) return; // back/forward with no city -> leave at all
  const geoSlug = await resolveGrantedGeoCity();
  if (geoSlug) {
    applyCitySelection(
      picker,
      form,
      resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: geoSlug }),
    );
  }
}

function setupPicker(picker, form) {
  picker.addEventListener("click", (e) => {
    const opt = /** @type {Element} */ (e.target)?.closest?.(OPTION);
    if (!opt || !picker.contains(opt)) return;
    const selection = opt.getAttribute("data-studios-city-option");
    if (selection) applyCitySelection(picker, form, selection);
  });
}

// Defer to Finsweet's list callback so the initial hidden-input clicks land
// AFTER FS has bound the form (clicking earlier no-ops). studios.js registers
// its own "list" callback at module top-level (import time); ours registers on
// DOMContentLoaded, so its hooks are wired before our engagement runs.
function boot() {
  const picker = document.querySelector(PICKER);
  const form = document.querySelector(FILTERS_FORM);
  if (!(picker instanceof HTMLElement) || !(form instanceof HTMLElement)) return;

  /** @type {any} */ (window).FinsweetAttributes ||= [];
  /** @type {any} */ (window).FinsweetAttributes.push([
    "list",
    (listInstances) => {
      const hasStudios = listInstances.some(
        (i) => i.instance === FS_LIST_INSTANCE_KEY,
      );
      if (!hasStudios || picker.dataset.cityPickerInit) return;
      picker.dataset.cityPickerInit = "true";
      setupPicker(picker, form);
      engageInitial(picker, form);
    },
  ]);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
