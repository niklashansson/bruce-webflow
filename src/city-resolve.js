/**
 * City Resolve — pure helpers for city-context.js
 *
 * Framework-free (no DOM, no imports) so the resolution chain and placeholder
 * mapping are unit-testable in Node. The DOM/localStorage shell and public API
 * live in city-context.js, which imports these. (Same split pattern as
 * city-visibility-decide.js ↔ city-visibility.js.)
 *
 * Active-city authority, highest first: URL lock → ?city= param → saved
 * preference → neutral. There is no implicit default — neutral is a real,
 * resolved state.
 */

/**
 * Decide the active city and whether to seed the saved preference.
 *
 * Seeding happens only when a valid lock is present AND there is no *valid*
 * saved preference (a stale/removed slug counts as none, so it gets replaced).
 *
 * @param {{lock: string|null, param: string|null, saved: string|null}} inputs
 * @param {Array<{slug: string}>} cities
 * @returns {{active: string|null, seedPreference: string|null}}
 */
export function resolveActiveCity({ lock, param, saved }, cities) {
  const has = (s) => !!s && cities.some((c) => c.slug === s);

  if (has(lock)) {
    return { active: lock, seedPreference: has(saved) ? null : lock };
  }
  if (has(param)) return { active: param, seedPreference: null };
  if (has(saved)) return { active: saved, seedPreference: null };
  return { active: null, seedPreference: null };
}

/**
 * Build the placeholder map pushed into variables.js for the active city.
 * Neutral (null) yields empty strings for every key so a switch never leaves
 * a stale value on the page.
 *
 * @param {{slug: string, name: string, vars: Record<string,string>} | null} activeCity
 * @param {Iterable<string>} knownVarKeys  union of var keys across all cities
 * @returns {Record<string,string>}
 */
export function buildPlaceholders(activeCity, knownVarKeys) {
  /** @type {Record<string,string>} */
  const out = {
    city: activeCity ? activeCity.slug : "",
    "city-name": activeCity ? activeCity.name : "",
  };
  for (const key of knownVarKeys) {
    out[key] = activeCity ? (activeCity.vars[key] ?? "") : "";
  }
  return out;
}
