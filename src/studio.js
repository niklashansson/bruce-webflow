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
import { directionsHref } from "./directions.js";

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

// Points every authored directions link at the studio. Multiple copies are
// expected (e.g. a desktop and a mobile button), so set them all. Provider
// resolution (Apple/Google/Waze, stored preference) is shared with the
// attribute-driven [data-directions] links via ./directions.js. Sets the
// href attribute (not just the .href property) so it works on any element and
// keeps native middle-click / right-click / accessibility intact.
function setupDirectionsLinks(component, coords) {
  const links = component.querySelectorAll(S.directions);
  if (!links.length) return;
  const name = component.querySelector(S.name)?.textContent.trim() || undefined;
  const [lng, lat] = coords;
  const url = directionsHref({ lat, lng, name });
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
