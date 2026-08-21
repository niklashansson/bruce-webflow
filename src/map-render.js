// Shared Mapbox render engine — the marker/popup/cluster/camera layer common to
// every map on the site. Extracted verbatim from explorer.js so a second
// component can render the same CMS-authored pins without dragging along the
// explorer's Finsweet list, bottom-sheet and filter chrome.
//
// The split: THIS module owns the map instance, the feature extraction, the
// point + cluster markers, the popups and the camera. The CALLER owns its own
// chrome and injects the four things that differ per surface — where the camera
// centers (`getCenter`), how much of the canvas is covered by an overlay
// (`getBottomPad`), what to do when the user pans (`onUserMove`) and what to run
// once the first render has landed (`onReady`).
//
// Because the explorer keeps features the shared layer knows nothing about
// (geolocation markers, "search this area"), the renderer deliberately exposes
// its raw `map` and `mapboxgl` handles. That is a leak, but the alternative is
// pulling explorer-only behaviour into shared code.
//
// Markup contract (per CMS item, unchanged from the explorer):
//   [data-explorer-field="studio-lat"]   textContent → latitude
//   [data-explorer-field="studio-lng"]   textContent → longitude
//   [data-explorer-field="studio-id"]    textContent → stable marker key
//   [data-explorer-element="studio-marker"]  cloned as the map marker
//   [data-explorer-element="studio-popup"]   cloned as the popup body

import { MAPBOX_STYLE, loadMapboxGl, loadScriptOnce } from "./mapbox.js";

const S = {
  lat: '[data-explorer-field="studio-lat"]',
  lng: '[data-explorer-field="studio-lng"]',
  id: '[data-explorer-field="studio-id"]',
  marker: '[data-explorer-element="studio-marker"]',
  popup: '[data-explorer-element="studio-popup"]',
  count: '[data-explorer-field="count"]',
};

// Fallback center when the caller's `getCenter` has nothing (Oslo).
export const DEFAULT_CENTER = [10.7522, 59.9139];
const DEFAULT_ZOOM = 11;
const CITY_ZOOM = 11;
const SINGLE_FEATURE_ZOOM = 13;
const FIT_BOUNDS_CONFIG = { duration: 500, maxZoom: 14, padding: 48 };
const MARKER_FADE_DURATION = 250;
const POPUP_CLASS = "explorer-popup";

// Supercluster is the only extra CDN dep beyond mapbox-gl and is fetched only
// by callers that actually cluster — kept out of the Webflow <head> so neither
// blocks first paint.
const SUPERCLUSTER_JS_URL =
  "https://unpkg.com/supercluster@8.0.0/dist/supercluster.min.js";
// minPoints 6 → fewer than 6 nearby points stay as individual studio markers
// rather than collapsing into a cluster bubble.
const CLUSTER_CONFIG = { radius: 50, maxZoom: 14, minPoints: 6 };
// Extra zoom beyond supercluster's expansionZoom so a cluster click lands a
// touch past the break-apart point (avoids re-clustering into one bubble).
const CLUSTER_EXPANSION_PADDING = 0.5;

// ── Feature extraction ───────────────────────────────────────
// CMS values are immutable post-render, so parsing each item once is safe; the
// WeakMap auto-GCs when items leave the DOM.
const featureCache = new WeakMap();

export function extractOne(el) {
  if (featureCache.has(el)) return featureCache.get(el);

  const latEl = el.querySelector(S.lat);
  const lngEl = el.querySelector(S.lng);
  const markerEl = el.querySelector(S.marker);
  if (!latEl || !lngEl || !markerEl) {
    featureCache.set(el, null);
    return null;
  }

  const lat = parseFloat(latEl.textContent);
  const lng = parseFloat(lngEl.textContent);
  // 0,0 is the CMS "no coordinates" sentinel (Gulf of Guinea) — skip it so a
  // studio without a location doesn't drop a marker off the African coast.
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0)) {
    featureCache.set(el, null);
    return null;
  }

  const idEl = el.querySelector(S.id);
  const feature = {
    coordinates: [lng, lat],
    id: idEl ? idEl.textContent.trim() : "",
    markerEl,
    popupEl: el.querySelector(S.popup),
  };
  featureCache.set(el, feature);
  return feature;
}

let hasWarnedAboutSkipped = false;
export function extractFeatures(elements) {
  const features = [];
  let skipped = 0;
  elements.forEach((el) => {
    const one = extractOne(el);
    if (one) features.push(one);
    else skipped++;
  });
  if (skipped && !hasWarnedAboutSkipped) {
    hasWarnedAboutSkipped = true;
    console.warn(
      `[map] Mapped ${features.length} / ${elements.length} items. Skipped ${skipped} with missing/invalid ${S.lat} / ${S.lng} / ${S.marker} (or 0,0 coords). Logged once per session.`,
    );
  }
  return features;
}

// Deep-clones a per-item template (the in-card marker / popup). Cloning (vs
// moving) keeps the CMS-bound source in the card intact and lets the same
// element be rendered on the map repeatedly. Strips ids + the element hooks so
// clones never match template queries.
export function cloneTemplate(sourceEl) {
  if (!sourceEl) return null;
  const clone = sourceEl.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.style.display = "";
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.removeAttribute("data-explorer-element");
    clone
      .querySelectorAll("[data-explorer-element]")
      .forEach((n) => n.removeAttribute("data-explorer-element"));
  }
  return clone;
}

export function pointKey(feature) {
  return feature.id || feature.coordinates.join(",");
}

// Cluster bubble size tier → `data-size` on the cluster element. The Webflow
// embed sizes md/lg/xl; sm falls back to the base .explorer_cluster_wrap style.
export function getClusterSizeTier(count) {
  if (count < 10) return "sm";
  if (count < 50) return "md";
  if (count < 200) return "lg";
  return "xl";
}

function applyClusterMeta(el, count, countSelector) {
  if (!(el instanceof HTMLElement)) return;
  el.dataset.size = getClusterSizeTier(count);
  const slot = countSelector ? el.querySelector(countSelector) : null;
  if (slot) slot.textContent = String(count);
}

// Supercluster loads at most once per session, memoised independently of
// mapbox-gl so a non-clustering caller can skip it entirely.
let superclusterPromise = null;
function loadSupercluster() {
  if (superclusterPromise) return superclusterPromise;
  superclusterPromise = window.Supercluster
    ? Promise.resolve()
    : loadScriptOnce(SUPERCLUSTER_JS_URL);
  return superclusterPromise;
}

// ── Renderer ─────────────────────────────────────────────────
// One per map surface.
//
//   targetEl          the map container
//   getFeatures       () => feature[]   read on first load
//   clusterTemplateEl the cluster bubble source; omit it for points-only
//   getCenter         () => [lng, lat] | null   initial + empty-set camera
//   getBottomPad      () => px of canvas hidden behind an overlay (default 0)
//   onUserMove        called on a user-driven (not programmatic) moveend
//   onReady           called once, right after the first render has landed
export function createMapRenderer({
  targetEl,
  getFeatures,
  clusterTemplateEl = null,
  getCenter = () => null,
  getBottomPad = () => 0,
  onUserMove = () => {},
  onReady = () => {},
} = {}) {
  // Clustering is opt-in, decided by the markup: a caller that authored no
  // cluster bubble gets individual point markers and never pays the
  // supercluster fetch.
  const clustering = Boolean(clusterTemplateEl);

  let mapboxgl = null;
  let Supercluster = null;
  let map = null;
  let mapLoaded = false;
  let mapInitStarted = false;
  let lastSignature = null;
  let clusterIndex = null;
  // Memoised viewport key (bbox + zoom) — skips re-clustering when neither moved.
  let lastRenderKey = null;
  let activePopup = null;
  // Reused across renders so Mapbox can `setLngLat` markers (smooth) and CSS
  // transitions animate on the same element instead of recreating nodes.
  const pointMarkers = new Map(); // pointKey -> { marker, feature }
  const clusterMarkers = new Map(); // cluster_id -> { marker, clusterId, coords }

  // Camera padding that keeps a fly-to's focal point in the strip ABOVE any
  // overlay the caller reports.
  function bottomPad() {
    return { top: 0, right: 0, left: 0, bottom: getBottomPad() };
  }

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  function openPopup(feature) {
    closePopup();
    const content = cloneTemplate(feature.popupEl);
    if (!content) return;
    activePopup = new mapboxgl.Popup({
      className: POPUP_CLASS,
      closeButton: false,
      closeOnClick: true,
      maxWidth: "none",
    })
      .setLngLat(feature.coordinates)
      .setDOMContent(content)
      .addTo(map);
    activePopup.on("close", () => {
      activePopup = null;
    });
  }

  // Mounts a DOM element as a Mapbox marker, fades it in, and wires a click.
  function attachMarker(el, coords, onClick) {
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(coords)
      .addTo(map);
    // Opacity-only fade; animating transform would fight Mapbox's per-frame
    // marker positioning during pan/zoom.
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: MARKER_FADE_DURATION,
      easing: "ease-out",
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return marker;
  }

  function addPointMarker(feature) {
    const el = cloneTemplate(feature.markerEl);
    if (!el) return;
    const entry = { feature };
    entry.marker = attachMarker(el, feature.coordinates, () => {
      openPopup(entry.feature);
      map.flyTo({
        center: entry.feature.coordinates,
        speed: 0.6,
        padding: bottomPad(),
      });
    });
    pointMarkers.set(pointKey(feature), entry);
  }

  // A cluster bubble. Clicking zooms to the point where supercluster breaks the
  // cluster apart (+ padding), so the studios underneath become visible.
  function addClusterMarker(cluster) {
    const el = cloneTemplate(clusterTemplateEl);
    if (!el) return;
    applyClusterMeta(el, cluster.properties.point_count, S.count);
    const entry = {
      clusterId: cluster.properties.cluster_id,
      coords: cluster.geometry.coordinates,
    };
    entry.marker = attachMarker(el, entry.coords, () => {
      const expansionZoom = clusterIndex.getClusterExpansionZoom(
        entry.clusterId,
      );
      map.flyTo({
        center: entry.coords,
        zoom: expansionZoom + CLUSTER_EXPANSION_PADDING,
        duration: FIT_BOUNDS_CONFIG.duration,
        padding: bottomPad(),
      });
    });
    clusterMarkers.set(entry.clusterId, entry);
  }

  function clearMarkers() {
    clusterMarkers.forEach((e) => e.marker.remove());
    clusterMarkers.clear();
    pointMarkers.forEach((e) => e.marker.remove());
    pointMarkers.clear();
  }

  function fitToFeatures(features) {
    if (!map) return;
    const cov = getBottomPad();
    const pad = {
      top: FIT_BOUNDS_CONFIG.padding,
      right: FIT_BOUNDS_CONFIG.padding,
      left: FIT_BOUNDS_CONFIG.padding,
      bottom: FIT_BOUNDS_CONFIG.padding + cov,
    };
    const pts = features.map((f) => f.coordinates);
    if (pts.length === 0) {
      const c = getCenter();
      if (c) {
        map.flyTo({
          center: c,
          zoom: CITY_ZOOM,
          duration: FIT_BOUNDS_CONFIG.duration,
          padding: bottomPad(),
        });
      }
      return;
    }
    if (pts.length === 1) {
      map.flyTo({
        center: pts[0],
        zoom: SINGLE_FEATURE_ZOOM,
        duration: FIT_BOUNDS_CONFIG.duration,
        padding: bottomPad(),
      });
      return;
    }
    const bounds = pts.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(),
    );
    map.fitBounds(bounds, {
      padding: pad,
      maxZoom: FIT_BOUNDS_CONFIG.maxZoom,
      duration: FIT_BOUNDS_CONFIG.duration,
    });
  }

  // (Re)builds the supercluster index from the current feature set. Clearing
  // the markers here is required: cluster_ids are regenerated per index, so
  // reusing stale clusters would wire markers to ids that no longer exist.
  function rebuildIndex(features) {
    if (features.length === 0) {
      // Supercluster.load() throws on an empty array, which would reject the
      // caller; represent "nothing to cluster" as a null index instead.
      clusterIndex = null;
    } else {
      clusterIndex = new Supercluster(CLUSTER_CONFIG).load(
        features.map((f) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: f.coordinates },
          properties: { feature: f },
        })),
      );
    }
    lastRenderKey = null;
    clearMarkers();
  }

  // Renders the clusters + points for the current viewport, upserting markers
  // (move, don't recreate) and pruning any that left the view. Cheap to call on
  // every moveend — the bbox+zoom key short-circuits when nothing changed.
  function renderClusters() {
    if (!mapLoaded || !clusterIndex) return;

    const bbox = map.getBounds().toArray().flat();
    const zoom = Math.floor(map.getZoom());
    // Round bbox to ~11m so float jitter from programmatic camera ops doesn't
    // bust the cache.
    const renderKey = `${bbox.map((n) => n.toFixed(4)).join(",")}|${zoom}`;
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    const seenClusters = new Set();
    const seenPoints = new Set();

    clusterIndex.getClusters(bbox, zoom).forEach((item) => {
      if (item.properties.cluster) {
        const id = item.properties.cluster_id;
        seenClusters.add(id);
        const existing = clusterMarkers.get(id);
        if (existing) {
          existing.marker.setLngLat(item.geometry.coordinates);
          existing.coords = item.geometry.coordinates;
          applyClusterMeta(
            existing.marker.getElement(),
            item.properties.point_count,
            S.count,
          );
        } else {
          addClusterMarker(item);
        }
      } else {
        const feature = item.properties.feature;
        const id = pointKey(feature);
        seenPoints.add(id);
        const existing = pointMarkers.get(id);
        if (existing) {
          existing.marker.setLngLat(feature.coordinates);
          existing.feature = feature;
        } else {
          addPointMarker(feature);
        }
      }
    });

    clusterMarkers.forEach((entry, id) => {
      if (seenClusters.has(id)) return;
      entry.marker.remove();
      clusterMarkers.delete(id);
    });
    pointMarkers.forEach((entry, id) => {
      if (seenPoints.has(id)) return;
      entry.marker.remove();
      pointMarkers.delete(id);
    });
  }

  // The points-only counterpart to renderClusters: every feature is a marker,
  // regardless of viewport, upserted so re-renders move markers instead of
  // recreating them.
  function renderPoints(features) {
    const seen = new Set();
    features.forEach((feature) => {
      const id = pointKey(feature);
      seen.add(id);
      const existing = pointMarkers.get(id);
      if (existing) {
        existing.marker.setLngLat(feature.coordinates);
        existing.feature = feature;
      } else {
        addPointMarker(feature);
      }
    });
    pointMarkers.forEach((entry, id) => {
      if (seen.has(id)) return;
      entry.marker.remove();
      pointMarkers.delete(id);
    });
  }

  // Rebuilds the index + reframes the camera only when the feature set actually
  // changed (so a pagination click, which re-fires afterRender with the same
  // set, never yanks the view). Viewport-only changes go through renderClusters.
  function render(features, { fit = false } = {}) {
    if (!mapLoaded || !map) return;
    const signature = features.map(pointKey).join("|");
    const changed = signature !== lastSignature;
    if (!changed) return;
    lastSignature = signature;

    closePopup();
    if (clustering) {
      rebuildIndex(features);
      renderClusters();
    } else {
      renderPoints(features);
    }
    if (fit) fitToFeatures(features);
  }

  // Lazily build the map on first call: load the CDN libs, create the map on the
  // caller's center, then render whatever features are loaded. Runs at most
  // once. The container must be visible by now so Mapbox sizes its canvas.
  function ensureMap() {
    if (mapInitStarted || !targetEl) return;
    mapInitStarted = true;
    Promise.all([loadMapboxGl(), clustering ? loadSupercluster() : null])
      .then(([gl]) => {
        mapboxgl = gl;
        if (clustering) Supercluster = window.Supercluster;
        map = new mapboxgl.Map({
          container: targetEl,
          style: MAPBOX_STYLE,
          projection: "globe",
          center: getCenter() || DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
        });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }));
        // The container can be toggled (display:none ↔ visible) and reflow
        // between layouts; keep the canvas sized to it.
        new ResizeObserver(() => map && map.resize()).observe(targetEl);
        map.on("load", () => {
          mapLoaded = true;
          render(getFeatures(), { fit: true });
          // AFTER the render: onReady may run its own camera move (the explorer
          // flushes a pending geolocation fly-to here) and must win over the
          // fit above, exactly as it did when this lived inline.
          onReady();
        });
        // Re-cluster as the user pans / zooms. `originalEvent` is only present
        // on user-driven moves (pan/pinch/wheel) — programmatic flyTo/fitBounds
        // don't carry it — so callers only see real interaction.
        // Only a clustered map re-renders on move — a points-only map already
        // has every marker down, so panning changes nothing.
        map.on("moveend", (e) => {
          if (clustering) renderClusters();
          if (e.originalEvent) onUserMove();
        });
      })
      .catch((err) => console.error("[map] map failed to load", err));
  }

  return {
    ensureMap,
    render,
    closePopup,
    isLoaded: () => mapLoaded,
    get map() {
      return map;
    },
    get mapboxgl() {
      return mapboxgl;
    },
  };
}
