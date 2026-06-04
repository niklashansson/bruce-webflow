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
 * The href to set for a managed link. Falls back to the gateway path when
 * neutral OR when the active city has no page in that section. Query + hash
 * are preserved verbatim.
 *
 * @param {{section: string, search: string, hash: string}} link
 * @param {{gateways: Record<string,string>, linkMap: Record<string,Record<string,string>>, active: string|null}} ctx
 * @returns {string}
 */
export function resolveHref({ section, search, hash }, { gateways, linkMap, active }) {
  const cityUrl = active ? linkMap[section]?.[active] : null;
  const base = cityUrl ?? gateways[section];
  return base + search + hash;
}
