/**
 * Pure decision helper for the city-visibility module (city-visibility.js).
 * Framework-free (no DOM, no globals) so the "is this element visible in the
 * active city" rules live in one unit-testable place — mirroring the
 * studios-city-select.js / studios-city-filter.js split.
 */

/**
 * Decide whether an element should be visible given its `data-city-show`
 * attribute value and the currently-active city slug.
 *
 * Returns `{ visible, unknownValues }` so the caller can warn once per
 * unknown value rather than per element.
 *
 * Semantics:
 *   - null/empty/whitespace-only attribute → always visible (no-op).
 *   - comma-separated values, each trimmed.
 *   - non-empty attribute but null active slug → hidden (fails closed
 *     while city.js is still resolving).
 *   - case-insensitive match against city.slug AND city.name (mirrors
 *     citiesFromUrl() in src/city.js so editors can use either).
 *   - tokens that match no city are listed in `unknownValues`.
 *
 * @param {string | null} attrValue
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 * @returns {{ visible: boolean, unknownValues: string[] }}
 */
export function shouldShow(attrValue, activeSlug, cities) {
  const raw = (attrValue ?? "").trim();
  if (raw === "") return { visible: true, unknownValues: [] };

  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return { visible: true, unknownValues: [] };

  if (!activeSlug) return { visible: false, unknownValues: [] };
  const activeLower = activeSlug.toLowerCase();

  let visible = false;
  const unknownValues = [];

  for (const t of tokens) {
    const match = cities.find(
      (c) => c.slug.toLowerCase() === t || c.name.toLowerCase() === t,
    );
    if (!match) {
      unknownValues.push(t);
      continue;
    }
    if (match.slug.toLowerCase() === activeLower) visible = true;
  }

  return { visible, unknownValues };
}
