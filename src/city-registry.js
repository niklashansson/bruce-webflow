/**
 * City Registry
 *
 * Reads the hidden CMS Collection List (`[data-city-list]`) into typed city
 * objects. `cityFromAttrs` is a pure parser (one attribute map → one city)
 * so it is unit-testable without a DOM; `readCityList` is the thin DOM shell.
 *
 * Each city: { slug, name, vars, coords }. `vars` are the `data-city-var-*`
 * values keyed by the suffix; `coords` is [lng, lat] (Mapbox order) parsed
 * from `data-city-var-lat` / `-lng`, or null when either is missing/invalid.
 */

const VAR_PREFIX = "data-city-var-";

/**
 * @param {Record<string, string>} attrs  element attribute name→value map
 * @returns {{slug: string, name: string, vars: Record<string,string>, coords: [number,number]|null} | null}
 */
export function cityFromAttrs(attrs) {
  const slug = (attrs["data-city-slug"] ?? "").trim();
  if (!slug) return null;

  const name = (attrs["data-city-name"] ?? "").trim();

  /** @type {Record<string,string>} */
  const vars = {};
  for (const key of Object.keys(attrs)) {
    if (!key.startsWith(VAR_PREFIX)) continue;
    vars[key.slice(VAR_PREFIX.length)] = attrs[key];
  }

  const lat = parseFloat(vars.lat);
  const lng = parseFloat(vars.lng);
  const coords = Number.isNaN(lat) || Number.isNaN(lng) ? null : [lng, lat];

  return { slug, name, vars, coords };
}

/**
 * Read every `[data-city-list] [data-city-slug]` element into city objects.
 * @returns {Array<ReturnType<typeof cityFromAttrs>>}
 */
export function readCityList() {
  const out = [];
  document
    .querySelectorAll("[data-city-list] [data-city-slug]")
    .forEach((el) => {
      /** @type {Record<string,string>} */
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value;
      const city = cityFromAttrs(attrs);
      if (city) out.push(city);
    });
  return out;
}
