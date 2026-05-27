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
 */

import { setGlobal } from "./variables.js";
import { attrBool } from "./utils.js";

const STORAGE_KEY = "bruce-city";
const LIST_SELECTOR = "[data-city-list]";
const VAR_PREFIX = "data-city-var-";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** @type {Set<(slug: string) => void>} */
const listeners = new Set();
/** @type {Array<{slug: string, name: string, isDefault: boolean, coords: [number, number] | null, vars: Record<string, string>}>} */
let cities = [];
/** @type {Set<string>} */
let knownVarKeys = new Set();
/** @type {string | null} */
let current = null;

const hasCity = (slug) => cities.some((c) => c.slug === slug);

// ── Load city list from CMS ──────────────────────────────────

function loadCities() {
  const next = [];
  const nextVarKeys = new Set();

  document
    .querySelectorAll(`${LIST_SELECTOR} [data-city-slug]`)
    .forEach((el) => {
      const slug = el.getAttribute("data-city-slug");
      if (!slug) return;

      /** @type {Record<string, string>} */
      const vars = {};
      for (const attr of el.attributes) {
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
      const coords = isNaN(lat) || isNaN(lng) ? null : [lng, lat];

      next.push({
        slug,
        name: el.getAttribute("data-city-name") ?? "",
        isDefault: attrBool(
          /** @type {HTMLElement} */ (el),
          "data-city-default",
        ),
        coords,
        vars,
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
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      // Malformed JSON — fall through to comma-split below.
    }
  }
  return trimmed.split(",");
}

function citiesFromUrl() {
  const sp = new URLSearchParams(location.search);
  let raw = sp.getAll("city");
  const values = raw.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (values.length === 0) return [];

  const matched = [];
  const missed = [];
  for (const value of values) {
    const match = cities.find(
      (c) =>
        c.slug.trim().toLowerCase() === value ||
        c.name.trim().toLowerCase() === value,
    );
    if (match) matched.push(match);
    else missed.push(value);
  }

  if (missed.length) {
    console.warn(
      `[bruce.city] URL city filter — these values matched no city:`,
      missed,
      "Known cities:",
      cities.map((c) => ({ slug: c.slug, name: c.name })),
    );
  }

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
  } catch {
    // localStorage can throw in private mode or with strict cookie policies.
  }
  if (stored && hasCity(stored)) return stored;

  const pageDefault = document.body?.dataset.defaultCity;
  if (pageDefault && hasCity(pageDefault)) return pageDefault;

  return cities.find((c) => c.isDefault)?.slug ?? cities[0]?.slug ?? null;
}

// ── Activation ───────────────────────────────────────────────
// Push the active city's vars into the variables module. Any key declared by
// some other city but missing on this one is emitted as an empty string, so a
// switch doesn't leave stale values from the previous city visible.

function applyCity(slug) {
  const city = cities.find((c) => c.slug === slug);
  if (!city) return;

  const slugChanged = slug !== current;
  current = slug;

  setGlobal("city", city.slug);
  setGlobal("city-name", city.name);

  for (const key of knownVarKeys) {
    setGlobal(key, city.vars[key] ?? "");
  }

  syncActiveSwitchers();

  // Vars always re-push (Finsweet may reload with fresh CMS data for the same
  // slug); subscribers only fire on an actual slug change.
  if (slugChanged) {
    listeners.forEach((fn) => {
      try {
        fn(slug);
      } catch (err) {
        console.error("[bruce.city] onChange listener threw", err);
      }
    });
  }
}

function syncActiveSwitchers() {
  document.querySelectorAll("[data-set-city]").forEach((el) => {
    /** @type {HTMLElement} */ (el).dataset.cityActive =
      el.getAttribute("data-set-city") === current ? "true" : "false";
  });
}

function persist(slug) {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
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
  get() {
    return current;
  },
  /** @param {string} slug */
  set(slug) {
    if (slug === current) return;
    if (!hasCity(slug)) {
      console.warn(`[bruce.city] unknown city "${slug}" — ignoring`);
      return;
    }
    applyCity(slug);
    persist(slug);
  },
  all() {
    return cities.map((c) => ({ ...c, vars: { ...c.vars } }));
  },
  // Cities matched by the `?city=<a>,<b>` URL param, in URL order.
  // Empty when the param is absent or matches nothing. studios.js reads this
  // to fit the map camera to the URL-filtered set instead of overriding it
  // back to the visitor's saved city.
  urlSelection() {
    return citiesFromUrl().map((c) => ({ ...c, vars: { ...c.vars } }));
  },
  /** @param {(slug: string) => void} fn */
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** @type {any} */ (window).bruce ||= {};
/** @type {any} */ (window).bruce.city = api;

// ── Delegated switcher handlers ──────────────────────────────
// Single document-level listener covers static buttons, Finsweet-injected
// switchers, and anything added later. preventDefault on the click guards
// against anchor switchers navigating to "#".

/** @param {Event} e */
function handleSwitcher(e) {
  const trigger = /** @type {Element | null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger) return;
  e.preventDefault();
  api.set(trigger.getAttribute("data-set-city") ?? "");
}

document.addEventListener("click", handleSwitcher);

// Keyboard activation for non-native triggers (divs with role="button").
// Native <button>/<a> already fire click on Enter/Space, so skip them.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const trigger = /** @type {Element | null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger || trigger.tagName === "BUTTON" || trigger.tagName === "A")
    return;
  handleSwitcher(e);
});

// ── Finsweet hook: re-load when CMS lists resolve ────────────
/** @type {any} */ (window).FinsweetAttributes ||= [];
/** @type {any} */ (window).FinsweetAttributes.push([
  "list",
  /** @param {Array<{loadingPromise?: Promise<unknown>}>} lists */
  (lists) => {
    Promise.all(lists.map((l) => l.loadingPromise || Promise.resolve())).then(
      refresh,
    );
  },
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
const scheduleRefresh = () => {
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    refresh();
  });
};

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = /** @type {Element} */ (node);
      if (el.matches?.(LIST_SELECTOR) || el.matches?.("[data-city-slug]")) {
        scheduleRefresh();
        return;
      }
    }
  }
});

// ── Auto-boot ────────────────────────────────────────────────
const boot = () => {
  refresh();
  observer.observe(document.body, { childList: true, subtree: true });
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      if (!current) refresh();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
