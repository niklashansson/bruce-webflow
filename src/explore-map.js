// Explore map — a standalone map section ("Explore studios near you" and
// friends), distinct from explorer.js which powers the per-city list/map page.
//
// The difference that shapes this file: there is no Finsweet list here. The set
// of studios is whatever the hidden CMS collection rendered, fixed at page load,
// so the map renders once and never re-filters. Everything the explorer needs
// for a live list — the state machine, the count display, the filter chrome, the
// bottom-sheet, locate, "search this area" — is absent by design.
//
// The heavy lifting is the shared engine in map-render.js. This file is its OWN
// parcel entry (dist/explore-map.js), like studio.js and explorer.js, rather
// than part of index.js — add its <script> only to pages carrying the section,
// and pages without one pay nothing. That also keeps every filename stable:
// bundling it into index.js would need a dynamic import, and parcel names async
// chunks with a content hash, so any later change to map-render.js would 404 for
// the visitors still holding a cached index.js (jsDelivr serves these with
// max-age=604800 — a full week).
//
// Mapbox GL is still lazy: the engine only fetches it once a section actually
// approaches the viewport, so a page with the section below the fold does not
// pay for the map until the visitor scrolls near it.
//
// Markup contract:
//   [data-map-element="wrap"]             the section (one renderer per wrap)
//     [data-map-element="target"]         the map container, must have a size
//     [data-map-element="cluster-template"]  OPTIONAL — present enables
//                                         clustering, absent means every studio
//                                         drops its own pin and supercluster is
//                                         never fetched
//     [data-map-element="item"]           each studio (falls back to Webflow's
//                                         .w-dyn-item when not authored)
//   Optional `data-map-lat` / `data-map-lng` on the wrap set the pre-fit
//   center; without them the camera just fits to the studios.
//
// Each item carries its own pin and popup markup via the SAME per-item contract
// the explorer uses ([data-explorer-field="studio-lat|studio-lng|studio-id"],
// [data-explorer-element="studio-marker|studio-popup"]), so one Webflow
// component works in both places with no Designer changes.

import { createMapRenderer, extractFeatures } from "./map-render.js";

const S = {
  wrap: '[data-map-element="wrap"]',
  target: '[data-map-element="target"]',
  clusterTemplate: '[data-map-element="cluster-template"]',
  item: '[data-map-element="item"]',
  // Webflow's own collection-item class, used when the items carry no explicit
  // hook — the common case when an existing studio card is dropped in as-is.
  fallbackItem: ".w-dyn-item",
};

// How early to start loading. Matches studio.js: enough runway that the map is
// usually ready by the time the section is actually on screen, without loading
// it for someone who never scrolls that far.
const PRELOAD_MARGIN = "200px";

// Reads the authored center off the wrap. Both halves must parse; a partial or
// malformed pair is treated as "no center" so the camera just fits the studios.
function readCenter(wrap) {
  const lat = parseFloat(wrap.getAttribute("data-map-lat"));
  const lng = parseFloat(wrap.getAttribute("data-map-lng"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lng, lat];
}

function readItems(wrap) {
  const authored = [...wrap.querySelectorAll(S.item)];
  if (authored.length) return authored;
  return [...wrap.querySelectorAll(S.fallbackItem)];
}

function setupExploreMap(wrap) {
  const targetEl = wrap.querySelector(S.target);
  if (!targetEl) {
    console.warn(
      `[explore-map] Missing ${S.target} — nothing to render into.`,
      wrap,
    );
    return;
  }

  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      const items = readItems(wrap);
      if (items.length === 0) {
        console.warn(
          `[explore-map] No ${S.item} / ${S.fallbackItem} found — the map will render empty.`,
          wrap,
        );
      }
      const renderer = createMapRenderer({
        targetEl,
        // The collection is static, and extractFeatures memoises per element,
        // so re-reading it costs nothing.
        getFeatures: () => extractFeatures(items),
        clusterTemplateEl: wrap.querySelector(S.clusterTemplate),
        getCenter: () => readCenter(wrap),
        onReady: () => {
          // Lets CSS hide a placeholder / spinner once the canvas has painted.
          wrap.dataset.mapReady = "true";
        },
      });
      renderer.ensureMap();
    } catch (err) {
      console.error("[explore-map] failed to start", err);
    }
  }

  // Nothing loads until the section is within a screenful of the viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      start();
    },
    { rootMargin: PRELOAD_MARGIN },
  );
  observer.observe(wrap);
}

function init() {
  document.querySelectorAll(S.wrap).forEach(setupExploreMap);
}

// Webflow renders CMS collections server-side, so the items are in the DOM by
// DOMContentLoaded — no need to wait for load or for Finsweet.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
