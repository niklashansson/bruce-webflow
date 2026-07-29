/**
 * City Links Plan — pure helpers for city-links.js
 *
 * Framework-free (no DOM, no imports) so the gateway-match and href
 * composition logic is unit-testable in Node. The DOM/WeakMap/boot shell lives
 * in city-links.js. (Same split as city-resolve.js ↔ city-context.js.)
 */

/** Strip a single trailing slash, but keep root "/". */
function normalize(pathname) {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * Which gateway section does a bare path belong to? Exact match only
 * (trailing-slash normalized). Sub-pages and unrelated paths → null.
 *
 * @param {string} pathname
 * @param {Record<string,string>} gateways  section → gateway pathname
 * @returns {string|null}
 */
export function matchSection(pathname, gateways) {
  const p = normalize(pathname);
  for (const section of Object.keys(gateways)) {
    if (normalize(gateways[section]) === p) return section;
  }
  return null;
}

/**
 * Case-insensitive lookup in a key → url map. Editors bind keys and city vars
 * from different collections whose codes differ in casing (synced country_code
 * is uppercase, terms keys are lowercase slugs) — a miss here would silently
 * fall back to the gateway, so casing must never matter.
 *
 * @param {Record<string,string>|undefined} m
 * @param {string} key
 * @returns {string|null}
 */
function lookup(m, key) {
  if (!m) return null;
  if (m[key] != null) return m[key];
  const want = key.toLowerCase();
  for (const k of Object.keys(m)) {
    if (k.toLowerCase() === want) return m[k];
  }
  return null;
}

/**
 * The href to set for a managed link. The lookup key is normally the active
 * city slug; a section listed in `keyBy` uses the active city's var of that
 * name instead (e.g. terms pages keyed by `country`). Key matching is
 * case-insensitive. Falls back to the gateway path when neutral OR when no
 * entry exists for the key. Query + hash are preserved verbatim.
 *
 * @param {{section: string, search: string, hash: string}} link
 * @param {{gateways: Record<string,string>, linkMap: Record<string,Record<string,string>>, keyBy?: Record<string,string>, active: string|null, activeVars?: Record<string,string>|null}} ctx
 * @returns {string}
 */
export function resolveHref(
  { section, search, hash },
  { gateways, linkMap, keyBy, active, activeVars },
) {
  const by = keyBy?.[section];
  const key = by ? (activeVars?.[by] ?? null) : active;
  const url = key ? lookup(linkMap[section], key) : null;
  return (url ?? gateways[section] ?? "") + search + hash;
}
