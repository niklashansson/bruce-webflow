/**
 * City Context
 *
 * Resolves and holds the single active city (or neutral / null), pushes the
 * active city's placeholders into variables.js, and exposes window.bruce.city.
 * The pure resolution + placeholder logic lives in city-resolve.js; this file
 * is the DOM/localStorage/boot shell around it.
 */

import { readCityList } from "./city-registry.js";
import { setGlobal } from "./variables.js";
import { resolveActiveCity, buildPlaceholders } from "./city-resolve.js";

const STORAGE_KEY = "bruce-city";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

// ── State ────────────────────────────────────────────────────

/** @type {Array<ReturnType<import("./city-registry.js").cityFromAttrs>>} */
let cities = [];
/** @type {Set<string>} */
let knownVarKeys = new Set();
/** @type {string | null} */
let current = null;
/** @type {boolean} — true once the chain has run at least once */
let resolved = false;
/** @type {Set<(slug: string|null) => void>} */
const listeners = new Set();

const cityBySlug = (slug) => cities.find((c) => c.slug === slug) ?? null;

// ── Inputs (DOM / URL / storage) ─────────────────────────────

function readLock() {
  const v = document.body?.dataset.cityLock?.trim();
  return v || null;
}

function readParam() {
  const sp = new URLSearchParams(location.search);
  const v = (sp.get("city") ?? "").trim();
  return v || null;
}

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode / strict cookie policy
  }
}

function writeSaved(slug) {
  try {
    if (slug === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // best-effort
  }
}

// ── Apply ────────────────────────────────────────────────────
// Push placeholders into variables.js and notify subscribers. `force` makes
// the initial resolution notify even when the slug did not change (neutral
// page: null → null) so the visibility module can reveal data-city-none.

function apply(active, { force = false } = {}) {
  const changed = active !== current;
  current = active;

  const placeholders = buildPlaceholders(cityBySlug(active), knownVarKeys);
  for (const key of Object.keys(placeholders)) setGlobal(key, placeholders[key]);

  if (changed || force) {
    listeners.forEach((fn) => {
      try {
        fn(active);
      } catch (err) {
        console.error("[bruce.city] onChange listener threw", err);
      }
    });
  }
}

// ── Resolve ──────────────────────────────────────────────────
// Idempotent. Re-reads the registry (CMS may render late), recomputes the
// var-key union, runs the chain, seeds the preference if applicable, applies.

function resolve({ force = false } = {}) {
  cities = readCityList();
  knownVarKeys = new Set();
  for (const c of cities) for (const k of Object.keys(c.vars)) knownVarKeys.add(k);

  if (cities.length === 0) return; // nothing to resolve yet; safety pass retries

  const lock = readLock();
  const saved = readSaved();
  const { active, seedPreference } = resolveActiveCity(
    { lock, param: readParam(), saved },
    cities,
  );
  if (seedPreference) writeSaved(seedPreference);

  const firstResolve = !resolved;
  resolved = true;
  apply(active, { force: force || firstResolve });
}

// ── Public API ───────────────────────────────────────────────

const api = {
  get() {
    return current;
  },
  isNeutral() {
    return current === null;
  },
  /** @param {string} slug  "" resets to neutral */
  set(slug) {
    const next = slug === "" ? null : slug;
    if (next !== null && !cityBySlug(next)) {
      console.warn(`[bruce.city] unknown city "${slug}" — ignoring`);
      return;
    }
    writeSaved(next);
    apply(next);
  },
  all() {
    return cities.map((c) => ({ ...c, vars: { ...c.vars } }));
  },
  /**
   * Subscribe to active-city changes. If the chain has already resolved, the
   * callback fires immediately with the current value so late subscribers
   * (import order) never miss the initial resolution.
   * @param {(slug: string|null) => void} fn
   */
  onChange(fn) {
    listeners.add(fn);
    if (resolved) {
      try {
        fn(current);
      } catch (err) {
        console.error("[bruce.city] onChange listener threw", err);
      }
    }
    return () => listeners.delete(fn);
  },
};

/** @type {any} */ (window).bruce ||= {};
/** @type {any} */ (window).bruce.city = api;

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  resolve();
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      // Re-resolve until the registry has loaded; once resolved, a later pass
      // is a cheap no-op unless cities/inputs changed.
      resolve();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
