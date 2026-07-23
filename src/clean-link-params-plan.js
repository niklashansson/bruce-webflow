/**
 * Clean Link Params — pure logic
 *
 * A Webflow code embed cannot conditionally include a query param, so unset
 * component properties render as empty params (`&campaign-code=`). This module
 * holds the pure cleanup logic; DOM wiring lives in clean-link-params.js.
 */

/**
 * Remove query params whose value is empty ("" or a bare key without "=").
 *
 * @param {string} href absolute or relative URL
 * @param {string} [base] base for resolving relative hrefs
 * @returns {string|null} cleaned absolute URL, or null when there is nothing
 *   to clean (or the href is unparseable) so the caller can leave the DOM as-is
 */
export function stripEmptyParams(href, base) {
  if (!href || !href.includes("?")) return null;
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  const kept = [];
  let dropped = false;
  for (const [key, value] of url.searchParams) {
    if (value === "") dropped = true;
    else kept.push([key, value]);
  }
  if (!dropped) return null;
  url.search = new URLSearchParams(kept).toString();
  return url.toString();
}
