/**
 * Pure decision helpers for the studios heading city picker
 * (studios-city-filter.js). Framework-free (no DOM, no globals) so the
 * "which city is the initial filter selection, which hidden inputs do we
 * click, and which city is nearest" rules live in one unit-testable place —
 * mirroring studios-deep-link.js.
 */

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance (km) between two [lng, lat] points.
 * @param {[number, number]} a
 * @param {[number, number]} b
 */
function haversineKm(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(s));
}

/**
 * Nearest city slug to a [lng, lat] coord, or null when coords is null or no
 * city has coords.
 * @param {[number, number] | null} coords
 * @param {{ slug: string, coords: [number, number] | null }[]} cities
 * @returns {string | null}
 */
export function nearestCitySlug(coords, cities) {
  if (!coords) return null;
  let best = null;
  let bestDist = Infinity;
  for (const c of cities) {
    if (!c.coords) continue;
    const d = haversineKm(coords, c.coords);
    if (d < bestDist) {
      bestDist = d;
      best = c.slug;
    }
  }
  return best;
}

/**
 * The initial FILTER selection at page load (strong-signal rule): a ?city=
 * deep-link or geo-if-granted engages the filter; everything else (saved
 * choice, CMS default) leaves it OFF ("all").
 *
 * @param {{ urlCitySlug: string | null, geoNearestSlug: string | null }} input
 * @returns {string} a city slug, or "all"
 */
export function resolveInitialCitySelection({ urlCitySlug, geoNearestSlug }) {
  if (urlCitySlug) return urlCitySlug;
  if (geoNearestSlug) return geoNearestSlug;
  return "all";
}

/**
 * The hidden city inputs to .click(), in order, to move the single-select
 * Finsweet city group from its current checked value to the target. Works in
 * fs-list-value terms (the city name); the DOM layer maps slug -> value.
 * Mirrors the "one genuine click per change" rule so we never leave two copies
 * checked, and is idempotent when already on the target.
 *
 * @param {{ targetValue: string | null, currentValue: string | null }} input
 *   targetValue  value to end up checked, or null for "all" (none checked)
 *   currentValue value currently checked, or null when none is
 * @returns {string[]} values to click, in order
 */
export function planCityFilterClicks({ targetValue, currentValue }) {
  if (targetValue === currentValue) return [];
  const clicks = [];
  if (currentValue !== null) clicks.push(currentValue); // uncheck old
  if (targetValue !== null) clicks.push(targetValue); // check new
  return clicks;
}
