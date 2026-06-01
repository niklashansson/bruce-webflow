// Studio template page — renders a single Mapbox GL map centered on the
// studio's location. This is the CMS *template* page for one studio (singular
// `data-studio-*` namespace), distinct from explorer.js which powers the
// filterable per-city list/map of studios.
//
// Mapbox GL is loaded LAZILY by the shared ./mapbox.js loader the first time
// the map scrolls into view — it must NOT be a blocking <script> in the Webflow
// <head>. The module self-runs on DOM ready and no-ops on pages without the
// map container, so it's safe to ship site-wide.

import { MAPBOX_STYLE, loadMapboxGl, whenIdle } from "./mapbox.js";

const S = {
  component: '[data-studio-element="component"]',
  mapTarget: '[data-studio-element="map-target"]',
  marker: '[data-studio-element="marker"]',
  directions: '[data-studio-element="directions"]',
  lat: '[data-studio-field="lat"]',
  lng: '[data-studio-field="lng"]',
  name: '[data-studio-field="name"]',
};

const MAP_ZOOM = 13;

// Reads the studio's coordinates from the CMS-bound text elements inside the
// component. Returns [lng, lat] (Mapbox order) or null if missing/invalid.
function readCoords(component) {
  const latEl = component.querySelector(S.lat);
  const lngEl = component.querySelector(S.lng);
  if (!latEl || !lngEl) {
    console.warn(`[studio-map] Missing ${S.lat} / ${S.lng} inside`, component);
    return null;
  }
  const lat = parseFloat(latEl.textContent);
  const lng = parseFloat(lngEl.textContent);
  if (isNaN(lat) || isNaN(lng)) {
    console.warn(
      `[studio-map] Non-numeric lat/lng ("${latEl.textContent}", "${lngEl.textContent}")`,
    );
    return null;
  }
  return [lng, lat];
}

// True on iOS / iPadOS / macOS — those route to Apple Maps, everything else
// (Android, Windows, Linux, Chrome OS) to Google Maps. Prefers the modern
// User-Agent Client Hints platform where the browser exposes it (Chromium),
// and falls back to the UA string for Safari/Firefox and Chrome-on-iOS, which
// don't implement userAgentData. iPadOS 13+ and Chrome-iOS both surface via
// the "iPad"/"Macintosh"/"iPhone" UA tokens, all of which we want → Apple.
function isApplePlatform() {
  const platform = navigator.userAgentData?.platform;
  if (platform) {
    const p = platform.toLowerCase();
    return p === "macos" || p === "ios";
  }
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent);
}

// Builds a cross-platform "directions to here" URL using https universal links
// (not geo:/maps: schemes), so they open the native app when installed and
// gracefully fall back to web. Neither needs an origin — both apps fill in
// "from current location" themselves, so no geolocation permission is asked.
// `name` is used only as Apple's pin label (its `q` param doubles as a label
// when the destination is given as coords); Google has no coord-label param
// without a Place ID, so it shows its own resolved label.
function buildDirectionsUrl(coords, name) {
  const [lng, lat] = coords;
  const destination = `${lat},${lng}`;
  if (isApplePlatform()) {
    const params = new URLSearchParams({ daddr: destination, dirflg: "d" });
    if (name) params.set("q", name);
    return `https://maps.apple.com/?${params}`;
  }
  const params = new URLSearchParams({ api: "1", destination });
  return `https://www.google.com/maps/dir/?${params}`;
}

// Points every authored directions link at the studio. Multiple copies are
// expected (e.g. a desktop and a mobile button), so set them all. Sets the
// href attribute (not just the .href property) so it works on any element and
// keeps native middle-click / right-click / accessibility intact.
function setupDirectionsLinks(component, coords) {
  const links = component.querySelectorAll(S.directions);
  if (!links.length) return;
  const name = component.querySelector(S.name)?.textContent.trim() || "";
  const url = buildDirectionsUrl(coords, name);
  links.forEach((link) => link.setAttribute("href", url));
}

// Marker element: a clone of the authored [data-studio-element="marker"]
// template if present, otherwise Mapbox's default pin. Cloning (vs moving)
// keeps the Designer source intact and strips its display:none / hooks.
function buildMarkerElement(component) {
  const template = component.querySelector(S.marker);
  if (!template) return null;
  const clone = template.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.style.display = "";
    clone.removeAttribute("data-studio-element");
  }
  return clone;
}

function initMap(component, mapTarget, coords) {
  loadMapboxGl()
    .then((mapboxgl) => {
      const map = new mapboxgl.Map({
        container: mapTarget,
        style: MAPBOX_STYLE,
        projection: "globe",
        center: coords,
        zoom: MAP_ZOOM,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));

      const markerEl = buildMarkerElement(component);
      const marker = markerEl
        ? new mapboxgl.Marker({ element: markerEl, anchor: "center" })
        : new mapboxgl.Marker();
      marker.setLngLat(coords).addTo(map);
    })
    .catch((err) => console.error(err));
}

// Build the map the first time its container nears the viewport. Deferring to
// idle keeps mapbox-gl's parse/eval out of the post-FCP TBT window; the 200px
// rootMargin warms it just before it's scrolled into view.
function setupStudioMap(component, mapTarget, coords) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      whenIdle(() => initMap(component, mapTarget, coords));
    },
    { rootMargin: "200px" },
  );
  observer.observe(mapTarget);
}

function init() {
  const component = document.querySelector(S.component);
  if (!component) return;

  const coords = readCoords(component);
  if (!coords) return;

  // Directions link is independent of the map — wire it immediately so it
  // works even if the map never scrolls into view.
  setupDirectionsLinks(component, coords);

  const mapTarget = component.querySelector(S.mapTarget);
  if (!mapTarget) {
    console.warn(`[studio-map] Missing ${S.mapTarget} inside`, component);
    return;
  }

  setupStudioMap(component, mapTarget, coords);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
