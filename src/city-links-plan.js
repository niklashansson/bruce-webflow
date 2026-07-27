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
 * The href to set for a managed link. The lookup key is normally the active
 * city slug; a section listed in `keyBy` uses the active city's var of that
 * name instead (e.g. terms pages keyed by `country`). Falls back to the
 * gateway path when neutral OR when no entry exists for the key. Query + hash
 * are preserved verbatim.
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
  const url = key ? linkMap[section]?.[key] : null;
  return (url ?? gateways[section] ?? "") + search + hash;
}
