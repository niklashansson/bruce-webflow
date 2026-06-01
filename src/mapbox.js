// Shared Mapbox GL loader — used by both explorer.js (per-city list/map page)
// and studio.js (single studio template page). Mapbox GL is loaded LAZILY from the
// CDN on first call; it must NOT be added as a blocking <script> in the Webflow
// <head>, or the ~460 KB + eval lands back on the critical path.
//
// Supercluster is intentionally NOT loaded here — only the list page clusters,
// so it loads supercluster separately alongside loadMapboxGl().

export const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoibmlrbGFzaGFuc3NvbiIsImEiOiJjbWxleHI0MngxaHU3M2dzOWZrMXJpMjJlIn0.yvXc8nLFEuUocjlwqNZiJQ";
export const MAPBOX_STYLE =
  "mapbox://styles/niklashansson/cmlextxil004n01r3d9gq7uzj";

export const MAPBOX_JS_URL =
  "https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.js";
export const MAPBOX_CSS_URL =
  "https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.css";

// Inject a <script> once and resolve when it has executed. Idempotent across
// instances and re-entrant calls (multiple maps share one load).
export function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

export function loadStyleOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

// Loads mapbox-gl (+ its CSS) on first call and caches the promise so every
// caller awaits the same single load. Sets the access token once ready and
// resolves with the global `mapboxgl`.
let mapboxGlPromise = null;
export function loadMapboxGl() {
  if (mapboxGlPromise) return mapboxGlPromise;
  mapboxGlPromise = (async () => {
    loadStyleOnce(MAPBOX_CSS_URL);
    if (!window.mapboxgl) await loadScriptOnce(MAPBOX_JS_URL);
    const mapboxgl = window.mapboxgl;
    if (!mapboxgl) {
      throw new Error("[mapbox] mapbox-gl failed to load from the CDN.");
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    return mapboxgl;
  })();
  return mapboxGlPromise;
}

// Defer non-urgent work to idle time (keeps the heavy Mapbox eval out of the
// post-FCP TBT window), falling back to a short timeout where unsupported.
export function whenIdle(cb) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 200);
  }
}
