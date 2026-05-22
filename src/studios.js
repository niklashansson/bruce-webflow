// Studios Map — renders a Mapbox GL map per Finsweet `studios` list instance,
// reacting to filter / sort / load changes. Clusters items client-side with
// supercluster so each point + cluster stays as a DOM-based HTML marker.
//
// Mapbox GL + supercluster are loaded LAZILY by this module (see
// loadMapboxLibs) the first time the map scrolls into view — they must NOT be
// added as blocking <script> tags in the Webflow <head>, or the 460 KB +
// ~25 s of eval lands back on the critical path and the lazy-load is moot.
// Only the bottom-sheet web component still needs registering up front:
// <script type="module">
//import { registerSheetElements } from "https://cdn.jsdelivr.net/npm/pure-web-bottom-sheet@0.6.0/dist/web.client.js";
// registerSheetElements();
// </script>

import { requestUserLocation } from "./location.js";
import { updateFilterCounts } from "./studios-filter-count.js";
import {
  shouldApplyDeepLinkFilters,
  pickDeepLinkClickIndex,
} from "./studios-deep-link.js";
import {
  MAPBOX_STYLE,
  loadMapboxGl,
  loadScriptOnce,
  whenIdle,
} from "./mapbox.js";

const FS_LIST_INSTANCE_KEY = "studios";

// Supercluster is the list page's only extra CDN dep beyond mapbox-gl (loaded
// lazily by ./mapbox.js); kept out of the Webflow <head> so it doesn't block
// first paint and loaded on demand when the map is first revealed.
const SUPERCLUSTER_JS_URL =
  "https://unpkg.com/supercluster@8.0.0/dist/supercluster.min.js";

const DEFAULT_CENTER = [18.0686, 59.3293]; // Stockholm
// Zoom levels above ~5 put globe projection past its flat-transition point,
// which is where cursor-anchored scroll zoom works correctly. At <5 on globe,
// the cursor often falls in "space" and Mapbox falls back to center-anchored
// zoom — feeling like the zoom ignores your cursor.
const ZOOM_CONFIG = { desktop: 5.5, mobile: 5.0, breakpoint: 480 };
// Layout breakpoint — mirrors the CSS `@container (width < 50em)` on the
// studios component. "Desktop" layout kicks in at component inline-size ≥ 50em
// (sidebar + map); below that, content collapses into the bottom sheet. Stays
// in em so the JS threshold tracks the CSS — if the component's font-size
// changes, both sides move together.
const LAYOUT_BREAKPOINT_EM = 50;
const FIT_BOUNDS_CONFIG = { duration: 500, maxZoom: 12 };
const FIT_BOUNDS_BREATHING_ROOM = 24;
const MARKER_FADE_DURATION = 250;
const USER_LOCATION_ZOOM = 11;
const CITY_ZOOM = 11;

const CLUSTER_CONFIG = { radius: 50, maxZoom: 14, minPoints: 6 };
const CLUSTER_EXPANSION_PADDING = 0.5; // extra zoom beyond expansionZoom

// Filtered-count display: counts above this collapse to the "over" copy
// ("Over 1000 studios") instead of the exact number. Each Webflow locale
// authors the surrounding copy directly in Designer — the number is the
// only thing JS injects, into [data-studios-count-slot].
const OVER_COUNT_THRESHOLD = 1000;

const POPUP_CLASS = "studios-popup";

const SHEET_HEIGHT_VAR = "--studios-sheet-height";
const SHEET_CHANGING_CLASS = "studios-sheet-changing";
const SHEET_READY_CLASS = "studios-sheet-ready";
const SHEET_SETTLE_DEBOUNCE_MS = 120;

// Cheap filters resolve synchronously and a "filtering" flash would just
// strobe. We only commit to the filtering state if the render hasn't
// landed within this window.
const FILTERING_DELAY_MS = 80;

const S = {
  component: '[data-studios-element="component"]',
  mapTarget: '[data-studios-element="map-target"]',
  marker: '[data-studios-element="marker"]',
  popup: '[data-studios-element="popup"]',
  clusterTemplate: '[data-studios-element="cluster-template"]',
  locateButton: '[data-studios-element="locate"]',
  searchAreaButton: '[data-studios-element="search-area"]',
  userLocationTemplate: '[data-studios-element="user-location-template"]',
  sheet: '[data-studios-element="sheet"]',
  content: '[data-studios-element="content"]',
  contentDesktop: '[data-studios-element="content-desktop"]',
  contentMobile: '[data-studios-element="content-mobile"]',
  count: '[data-studios-field="count"]',
  lat: '[data-studios-field="lat"]',
  lng: '[data-studios-field="lng"]',
  id: '[data-studios-field="id"]',
  countDisplay: '[data-studios-element="count-display"]',
  countMode: "[data-studios-count-mode]",
  countSlot: "[data-studios-count-slot]",
};

let mapboxgl = null;
const initializedInstances = new WeakSet();

// Loads mapbox-gl (via the shared ./mapbox.js loader) + supercluster on first
// call and caches the promise so every studios instance awaits the same single
// load. Sets the module `mapboxgl` reference once ready.
let mapboxLibsPromise = null;
function loadMapboxLibs() {
  if (mapboxLibsPromise) return mapboxLibsPromise;
  mapboxLibsPromise = (async () => {
    const [gl] = await Promise.all([
      loadMapboxGl(),
      window.Supercluster
        ? Promise.resolve()
        : loadScriptOnce(SUPERCLUSTER_JS_URL),
    ]);
    mapboxgl = gl;
  })();
  return mapboxLibsPromise;
}

function getResponsiveZoom() {
  return window.innerWidth <= ZOOM_CONFIG.breakpoint
    ? ZOOM_CONFIG.mobile
    : ZOOM_CONFIG.desktop;
}

// null when city.js hasn't booted yet or the active city has no lat/lng
// configured — callers fall back to DEFAULT_CENTER / fit-to-features.
function getSelectedCityCoords() {
  const api = /** @type {any} */ (window).bruce?.city;
  if (!api) return null;
  const slug = api.get();
  return api.all().find((c) => c.slug === slug)?.coords ?? null;
}

function getClusterSizeTier(count) {
  if (count < 10) return "sm";
  if (count < 50) return "md";
  if (count < 200) return "lg";
  return "xl";
}

function applyClusterMeta(el, count, countSlotSelector) {
  if (!(el instanceof HTMLElement)) return;
  el.dataset.size = getClusterSizeTier(count);
  el.style.setProperty("--studios-cluster-count", String(count));
  const slot = countSlotSelector ? el.querySelector(countSlotSelector) : null;
  if (slot) slot.textContent = String(count);
}

// Webflow CMS values are immutable post-render, so parsing once per element
// is safe; WeakMap auto-GCs when items leave the DOM.
const featureCache = new WeakMap();

function extractOne(el) {
  if (featureCache.has(el)) return featureCache.get(el);

  const latEl = el.querySelector(S.lat);
  const lngEl = el.querySelector(S.lng);
  if (!latEl || !lngEl) {
    featureCache.set(el, null);
    return null;
  }

  const lat = parseFloat(latEl.textContent);
  const lng = parseFloat(lngEl.textContent);
  if (isNaN(lat) || isNaN(lng)) {
    featureCache.set(el, null);
    return null;
  }

  const markerEl = el.querySelector(S.marker);
  if (!markerEl) {
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

// Gate the skip-warning to once per session (extractFeatures runs often).
let hasWarnedAboutSkipped = false;

function extractFeatures(elements) {
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
      `[studios-map] Extracted ${features.length} / ${elements.length} items. Skipped ${skipped} with missing or invalid ${S.lat} / ${S.lng} / ${S.marker}. (Logged once per session.)`,
    );
  }
  return features;
}

// Deep-clones a per-item template. Cloning (vs moving) keeps the source intact
// so Webflow CMS bindings stay in place and the element can be rendered repeatedly.
function cloneTemplate(sourceEl) {
  if (!sourceEl) return null;
  const clone = sourceEl.cloneNode(true);
  if (clone instanceof HTMLElement) {
    // Clear inline display:none carried over from Designer.
    clone.style.display = "";
    // Avoid duplicate ids in the document once the clone is mounted.
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    // Clones live on the map (markers / popups / cluster / user location);
    // they should never match template queries. Stripping the hook avoids
    // the "which one is the template?" ambiguity when re-querying.
    clone.removeAttribute("data-studios-element");
    clone
      .querySelectorAll("[data-studios-element]")
      .forEach((n) => n.removeAttribute("data-studios-element"));
  }
  return clone;
}

function buildMarkerElement(feature) {
  return cloneTemplate(feature.markerEl);
}

function buildPopupContent(feature) {
  return cloneTemplate(feature.popupEl);
}

function buildClusterElement(templateEl, count) {
  const clone = cloneTemplate(templateEl);
  applyClusterMeta(clone, count, S.count);
  return clone;
}

// Filtered-count display. Author once per component with three mode slots:
//   <div data-studios-element="count-display">
//     <span data-studios-count-mode="singular"><span data-studios-count-slot></span> studio</span>
//     <span data-studios-count-mode="plural"><span data-studios-count-slot></span> studios</span>
//     <span data-studios-count-mode="over">Over <span data-studios-count-slot></span> studios</span>
//   </div>
// JS picks the active mode by count, writes the number into that mode's slot,
// and toggles `hidden` on the others. Surrounding copy is plain DOM text, so
// Webflow Localization per-locale edits translate it with no JS changes.
function updateCountDisplay(component, count) {
  const display = component.querySelector(S.countDisplay);
  if (!display) return;

  const mode =
    count > OVER_COUNT_THRESHOLD ? "over" : count === 1 ? "singular" : "plural";
  const slotValue = mode === "over" ? OVER_COUNT_THRESHOLD : count;

  display.querySelectorAll(S.countMode).forEach((modeEl) => {
    const isActive = modeEl.getAttribute("data-studios-count-mode") === mode;
    modeEl.hidden = !isActive;
    if (!isActive) return;
    const slot = modeEl.querySelector(S.countSlot);
    if (slot) slot.textContent = String(slotValue);
  });
}

function createMap(container) {
  return new mapboxgl.Map({
    container,
    style: MAPBOX_STYLE,
    projection: "globe",
    center: getSelectedCityCoords() || DEFAULT_CENTER,
    zoom: getResponsiveZoom(),
    attributionControl: false,
  });
}

function fitToFeatures(map, features, sheetCoverage = 0) {
  // Bottom padding equal to the sheet's overlap shifts the camera target up
  // so the centered point lands in the visible strip above the sheet
  // instead of behind it. Mapbox flyTo and fitBounds both use `padding` to
  // compute the camera target.
  const sheetPadding = { top: 0, right: 0, bottom: sheetCoverage, left: 0 };

  if (!features.length) {
    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: getResponsiveZoom(),
      duration: FIT_BOUNDS_CONFIG.duration,
      padding: sheetPadding,
    });
    return;
  }
  if (features.length === 1) {
    map.flyTo({
      center: features[0].coordinates,
      zoom: 10,
      duration: FIT_BOUNDS_CONFIG.duration,
      padding: sheetPadding,
    });
    return;
  }
  // Skip the fit if the canvas is too small to hold any breathing room —
  // fitBounds would either warn or land the camera at a degenerate position.
  const available = getCanvasSize(map, 100);
  if (!available) return;

  const visibleH = Math.max(0, available.h - sheetCoverage);
  const breathing = Math.min(
    FIT_BOUNDS_BREATHING_ROOM,
    visibleH / 2,
    available.w / 2,
  );
  const padding = {
    top: breathing,
    bottom: breathing + sheetCoverage,
    left: breathing,
    right: breathing,
  };

  const bounds = features.reduce(
    (b, f) => b.extend(f.coordinates),
    new mapboxgl.LngLatBounds(),
  );
  map.fitBounds(bounds, { ...FIT_BOUNDS_CONFIG, padding });
}

// Map canvas size, or null if smaller than `minSize` in either axis.
function getCanvasSize(map, minSize = 1) {
  const container = map.getContainer();
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w < minSize || h < minSize) return null;
  return { w, h };
}

// Container-query-equivalent check: true when the component's inline size
// reaches LAYOUT_BREAKPOINT_EM, measured in the component's OWN font-size
// (same base CSS container queries use for em). Read fresh each call so
// font-size or width changes are picked up without cached staleness.
function isDesktopLayout(component) {
  const fontSize = parseFloat(getComputedStyle(component).fontSize) || 16;
  return component.clientWidth >= LAYOUT_BREAKPOINT_EM * fontSize;
}

// Moves the `content` subtree (toolbar, list, filter panel) between two
// mount points (`content-desktop` and `content-mobile`) as the component
// crosses the layout breakpoint. Authored position is a sibling of both;
// this keeps the CMS list authored once and avoids Finsweet multi-instance
// issues. Finsweet binds by element reference, so re-parenting an attached
// subtree doesn't break list hooks.
//
// Driven by ResizeObserver on the component (not window matchMedia) so the
// crossover tracks the CSS container query, not the viewport.
function setupResponsiveContent(component) {
  const content = component.querySelector(S.content);
  if (!content) return;
  const desktopMount = component.querySelector(S.contentDesktop);
  const mobileMount = component.querySelector(S.contentMobile);
  if (!desktopMount && !mobileMount) return;

  const place = () => {
    const wantsDesktop = isDesktopLayout(component);
    // Fall back to whichever mount exists if the preferred one is missing
    // (desktop-only or mobile-only markup). If neither exists, bail.
    const target = wantsDesktop
      ? desktopMount || mobileMount
      : mobileMount || desktopMount;
    if (!target || content.parentElement === target) return;
    target.appendChild(content);
  };

  place();

  let lastIsDesktop = isDesktopLayout(component);
  const ro = new ResizeObserver(() => {
    const next = isDesktopLayout(component);
    if (next === lastIsDesktop) return;
    lastIsDesktop = next;
    place();
  });
  ro.observe(component);
}

// Exposes the bottom-sheet chrome's visible height as `--studios-sheet-height`
// on <html>, so anything on the page can anchor "just above the sheet" via
// `bottom: calc(var(--studios-sheet-height) + 8px)`.
//
// While the height is actively changing, adds `studios-sheet-changing` to
// <html>. The CSS var lags the chrome's visual position by one frame, which
// looks jumpy mid-drag — CSS can use this class to hide anchored elements
// until things settle.
function setupSheetHeightVar(component, onSettle) {
  const sheet = component.querySelector(S.sheet);
  if (!sheet) return () => 0;

  let chrome = null;

  const tag = sheet.tagName.toLowerCase();
  customElements.whenDefined(tag).then(() => {
    chrome = sheet.shadowRoot?.querySelector('[part="sheet"]');
    if (!chrome) return;

    const root = document.documentElement;
    let pendingFrame = null;
    let lastHeight = -1;
    let settleTimer = null;
    let isChanging = false;
    const markChanging = () => {
      if (!isChanging) {
        isChanging = true;
        root.classList.add(SHEET_CHANGING_CLASS);
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        isChanging = false;
        root.classList.remove(SHEET_CHANGING_CLASS);
        onSettle?.();
      }, SHEET_SETTLE_DEBOUNCE_MS);
    };
    const sync = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        const h = chrome.getBoundingClientRect().height;
        if (Math.abs(h - lastHeight) < 1) return;
        lastHeight = h;
        root.style.setProperty(SHEET_HEIGHT_VAR, `${h}px`);
        // Marks first successful measurement so CSS can gate sheet-height
        // -dependent positioning (e.g. spinner offset) and avoid the
        // pre-init "var unset → fallback 0" → "var set → real value" jump.
        root.classList.add(SHEET_READY_CLASS);
        markChanging();
      });
    };

    sync();
    sheet.addEventListener("scroll", sync, { passive: true });
    sheet.addEventListener("snap-position-change", sync);
    new ResizeObserver(sync).observe(chrome);
  });

  // How many CSS pixels of `targetEl` are covered by the sheet chrome.
  // Returns 0 when there's no chrome yet, no horizontal overlap (e.g.
  // desktop sidebar layout where the sheet sits beside the map), or the
  // chrome sits below the target. Camera ops use this as bottom padding
  // so the centered point lands in the visible strip above the sheet.
  return (targetEl) => {
    if (!chrome || !targetEl) return 0;
    const cRect = chrome.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return 0;
    const tRect = targetEl.getBoundingClientRect();
    const horizontalOverlap =
      Math.min(cRect.right, tRect.right) - Math.max(cRect.left, tRect.left);
    if (horizontalOverlap <= 0) return 0;
    const verticalOverlap = Math.max(0, tRect.bottom - cRect.top);
    return Math.min(verticalOverlap, tRect.height);
  };
}

function setupStudiosInstance(fsListInstance) {
  const component = fsListInstance.wrapperElement.closest(S.component);
  if (!component) {
    console.warn(
      '[studios-map] No [data-studios-element="component"] ancestor for Finsweet list',
      fsListInstance.wrapperElement,
    );
    return;
  }

  const mapTargetEl = component.querySelector(S.mapTarget);
  if (!mapTargetEl) {
    console.warn(
      '[studios-map] Missing [data-studios-element="map-target"] inside',
      component,
    );
    return;
  }

  const clusterTemplateEl = component.querySelector(S.clusterTemplate);
  if (!clusterTemplateEl) {
    console.warn(
      `[studios-map] Missing ${S.clusterTemplate} inside`,
      component,
    );
    return;
  }
  if (!clusterTemplateEl.querySelector(S.count)) {
    console.warn(
      `[studios-map] Cluster template has no ${S.count} slot — the count won't update. Add data-studios-field="count" to a text element inside the cluster template.`,
    );
  }
  // data-state on the component drives all loading/ready styling.
  // CSS reads `[data-studios-element="component"][data-state="…"]`:
  //   loading   → initial CMS stream; before first render
  //   filtering → filter changed and render is in flight > FILTERING_DELAY_MS
  //   ready     → render done (the 0-result case is covered by the count
  //               display rendering "0 studios"; no separate empty state)
  let currentState = "loading";
  let filteringTimeoutId = null;
  component.dataset.state = currentState;

  function setState(next) {
    if (filteringTimeoutId !== null) {
      clearTimeout(filteringTimeoutId);
      filteringTimeoutId = null;
    }
    if (next === currentState) return;
    currentState = next;
    component.dataset.state = next;
  }

  function scheduleFilteringTransition() {
    // Initial load owns its state — never downgrade loading to filtering.
    if (currentState === "loading" || currentState === "filtering") return;
    if (filteringTimeoutId !== null) return;
    filteringTimeoutId = setTimeout(() => {
      filteringTimeoutId = null;
      currentState = "filtering";
      component.dataset.state = "filtering";
    }, FILTERING_DELAY_MS);
  }

  // Duplicate locate / search-area buttons are expected: the desktop sidebar
  // and the mobile sheet each carry their own copy, and they live outside the
  // single `content` subtree that setupResponsiveContent moves, so both stay
  // in the DOM at once. Bind every copy and keep their state in sync so the
  // visible one always reflects reality regardless of layout.
  const locateButtonEls = /** @type {HTMLElement[]} */ ([
    ...component.querySelectorAll(S.locateButton),
  ]);
  const searchAreaButtonEls = /** @type {HTMLElement[]} */ ([
    ...component.querySelectorAll(S.searchAreaButton),
  ]);
  const userLocationTemplateEl = component.querySelector(
    S.userLocationTemplate,
  );
  if (!userLocationTemplateEl) {
    console.warn(
      `[studios-map] Missing ${S.userLocationTemplate} inside`,
      component,
    );
    return;
  }

  // Dirty flag on the search-area buttons — `.is-active` matches the
  // site-wide Finsweet convention (`fs-list-activeclass`). Toggled across all
  // copies so every duplicate shows the same dirty state.
  let searchAreaDirty = false;
  const setSearchAreaDirty = (dirty) => {
    if (dirty === searchAreaDirty) return;
    searchAreaDirty = dirty;
    searchAreaButtonEls.forEach((el) =>
      el.classList.toggle("is-active", dirty),
    );
  };

  // Map is created lazily (see ensureMap, wired up after the hooks below) the
  // first time the map scrolls into view, so mapbox-gl's bytes + eval stay off
  // the initial critical path. Until then `map` is null and every map-touching
  // path is gated by `isLoaded` (false until `map.on("load")`), so the list,
  // filters, counts and card paint all work with no map present.
  let map = null;

  setupResponsiveContent(component);
  // Sheet coverage is read fresh on each explicit camera op (fit, locate,
  // marker / cluster click) — no auto-easeTo on sheet drag, so the user's
  // chosen view stays put when they resize the sheet. On settle we just
  // re-run renderClusters so markers reflect the new visible area.
  const getSheetCoverage = setupSheetHeightVar(component, () => {
    if (isLoaded) renderClusters();
  });
  const sheetCoverage = () => getSheetCoverage(mapTargetEl);
  const sheetPadding = () => ({ bottom: sheetCoverage() });

  // Reusing the same DOM element across renders lets Mapbox move markers with
  // `setLngLat` (smooth) and lets CSS transitions animate on the same element.
  const clusterMarkers = new Map(); // cluster_id -> entry
  const pointMarkers = new Map(); // feature id (or coord fallback) -> entry
  let activePopup = null;
  let isLoaded = false;
  let queuedFeatures = null;
  let clusterIndex = null;
  let lastRenderKey = null;
  let mapPanTriggered = false;
  // Post-filter, PRE-pagination items. afterRender receives the paginated
  // subset (current page only) — capturing here gives the full filtered set
  // so every matching marker lands on the map, not just the current page.
  let filteredItems = [];
  let initialRenderDone = false;
  // Signature of the last rendered feature set; used to no-op render() when
  // the same items come through (e.g., pagination click, unchanged filter).
  let lastRenderSignature = null;
  // CMS Load streams pages in. We render markers from whatever's loaded so far
  // (markers fill in as pages arrive) rather than blocking on the full set —
  // the visible cards and the map both show early. `finalizingCmsLoad` marks
  // the single re-render fired once all pages are in, so afterRender knows not
  // to refit the camera for it (a "data finished loading" event isn't a user
  // intent to move the view).
  const pendingCmsLoad = fsListInstance.loadingPaginatedItems;
  let cmsLoadDone = !pendingCmsLoad;
  let finalizingCmsLoad = false;
  pendingCmsLoad?.finally(() => {
    cmsLoadDone = true;
    if (!mapPanTriggered) {
      finalizingCmsLoad = true;
      fsListInstance.triggerHook("filter");
    }
  });

  let userLocationMarker = null;
  function setUserLocationMarker(loc) {
    if (userLocationMarker) {
      userLocationMarker.setLngLat(loc);
      return;
    }
    userLocationMarker = new mapboxgl.Marker({
      element: cloneTemplate(userLocationTemplateEl),
      anchor: "center",
    })
      .setLngLat(loc)
      .addTo(map);
  }

  function showUserLocation(loc) {
    if (!loc || !isLoaded) return;
    setUserLocationMarker(loc);
    map.flyTo({
      center: loc,
      zoom: USER_LOCATION_ZOOM,
      duration: FIT_BOUNDS_CONFIG.duration,
      padding: sheetPadding(),
    });
  }

  // Returns true when it actually started a fly-to, false when there's no map
  // or no selected city coords — callers fall back to fit-to-features.
  function flyToCity() {
    if (!isLoaded) return false;
    const loc = getSelectedCityCoords();
    if (!loc) return false;
    map.flyTo({
      center: loc,
      zoom: CITY_ZOOM,
      duration: FIT_BOUNDS_CONFIG.duration,
      padding: sheetPadding(),
    });
    return true;
  }

  function clearMarkers() {
    clusterMarkers.forEach((e) => e.marker.remove());
    clusterMarkers.clear();
    pointMarkers.forEach((e) => e.marker.remove());
    pointMarkers.clear();
  }

  function pointKey(feature) {
    return feature.id || feature.coordinates.join(",");
  }

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  function openPopup(feature) {
    closePopup();

    const content = buildPopupContent(feature);
    if (!content) {
      console.warn(
        `[studios-map] No ${S.popup} in item${feature.id ? ` (id="${feature.id}")` : ""} — skipping popup`,
      );
      return;
    }

    activePopup = new mapboxgl.Popup({
      className: POPUP_CLASS,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "none",
    })

      .setLngLat(feature.coordinates)
      .setDOMContent(content)
      .addTo(map);

    // Mapbox's own close paths (X button, closeOnClick, ESC) don't route through
    // closePopup — listen for 'close' so the ref stays in sync.
    activePopup.on("close", () => {
      activePopup = null;
    });
  }

  function attachMarker(el, coords, onClick) {
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(coords)
      .addTo(map);
    // Opacity-only fade; animating `transform` would fight Mapbox's per-frame
    // marker positioning during pan/zoom and cause drag lag.
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
    const entry = { feature };
    entry.marker = attachMarker(
      buildMarkerElement(feature),
      feature.coordinates,
      () => {
        openPopup(entry.feature);
        map.flyTo({
          center: entry.feature.coordinates,
          speed: 0.6,
          padding: sheetPadding(),
        });
      },
    );
    pointMarkers.set(pointKey(feature), entry);
  }

  function addClusterMarker(cluster) {
    const entry = {
      clusterId: cluster.properties.cluster_id,
      coords: cluster.geometry.coordinates,
    };
    entry.marker = attachMarker(
      buildClusterElement(clusterTemplateEl, cluster.properties.point_count),
      entry.coords,
      () => {
        const expansionZoom = clusterIndex.getClusterExpansionZoom(
          entry.clusterId,
        );
        map.flyTo({
          center: entry.coords,
          zoom: expansionZoom + CLUSTER_EXPANSION_PADDING,
          duration: FIT_BOUNDS_CONFIG.duration,
          padding: sheetPadding(),
        });
      },
    );
    clusterMarkers.set(entry.clusterId, entry);
  }

  function rebuildIndex(features) {
    // Supercluster.load() throws on an empty array ("Unexpected numItems value: 0"),
    // which rejects Finsweet's filter promise and stops subsequent filter events
    // from firing — including the one that fires when the user clears the input.
    if (features.length === 0) {
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
    // cluster_ids change with each new index — drop reused clusters so the
    // next renderClusters creates fresh ones instead of wiring to stale ids.
    clearMarkers();
  }

  // Render bbox = the geographic rect of the strip ABOVE the sheet, not the
  // full canvas. This makes markers/clusters appear and disappear as the
  // sheet covers/uncovers map area. Falls back to full canvas bounds when
  // the sheet is absent, hasn't upgraded yet, or covers the whole map.
  // Uses unproject (not lat ratio) so it stays correct on globe / Mercator
  // at any latitude.
  function getRenderBbox() {
    const cov = sheetCoverage();
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const visibleH = h - cov;
    if (cov <= 0 || visibleH < 50) {
      return map.getBounds().toArray().flat();
    }
    const nw = map.unproject([0, 0]);
    const ne = map.unproject([w, 0]);
    const sw = map.unproject([0, visibleH]);
    const se = map.unproject([w, visibleH]);
    return [
      Math.min(nw.lng, sw.lng),
      Math.min(sw.lat, se.lat),
      Math.max(ne.lng, se.lng),
      Math.max(nw.lat, ne.lat),
    ];
  }

  function renderClusters() {
    if (!isLoaded || !clusterIndex) return;

    const bbox = getRenderBbox();
    const zoom = Math.floor(map.getZoom());
    // Round bbox to 4 decimals (~11m) so float jitter from programmatic
    // camera ops doesn't bust the cache.
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

  // `fit` controls whether the camera reframes to the feature set. We fit on
  // the initial render (always — frames the first markers) and on user-driven
  // filter changes, but NOT while CMS pages are still streaming in, so the
  // camera doesn't lurch on every page that lands.
  function render(features, { fit = true } = {}) {
    if (!isLoaded) {
      queuedFeatures = features;
      return;
    }

    // Skip no-op renders (pagination, sort with same items) — prevents
    // wasted fitBounds camera jumps and supercluster rebuilds.
    const signature = features.map(pointKey).join("|");
    if (signature !== lastRenderSignature) {
      lastRenderSignature = signature;
      closePopup();
      rebuildIndex(features);
      renderClusters();
      // On a user-driven refit (not the initial render) that lands on an empty
      // filter state — i.e. the user just cleared all filters — return to the
      // initial city view instead of zooming out to frame every studio. Falls
      // back to fit-to-features when there's no selected city to fly to.
      const returnedToCity =
        fit &&
        initialRenderDone &&
        !hasActiveFilters() &&
        flyToCity();
      if (!returnedToCity && (fit || !initialRenderDone)) {
        fitToFeatures(map, features, sheetCoverage());
      }
    }

    // First successful render: fly to the selected city. If the active city
    // has no coords (or city.js hasn't booted yet), the fit-to-all view we
    // just applied stays in place — the city.onChange subscription below
    // will re-fly the map once the city activates.
    //
    // Exception: when a `?city=…` URL filter is active, the studios
    // list is already pre-filtered to that selection — the fitToFeatures
    // call above frames it correctly. Skip flyToCity in that case so the
    // visitor's saved city doesn't yank the camera off the URL-filtered set.
    if (!initialRenderDone) {
      initialRenderDone = true;
      const urlCities =
        /** @type {any} */ (window).bruce?.city?.urlSelection?.() ?? [];
      if (urlCities.length === 0) flyToCity();
    }
  }

  // Lazily build the map: load the CDN libs, create the map, wire its events,
  // then flush whatever features have queued up while it was absent. Runs at
  // most once per instance; safe to call from the observer or any handler.
  let mapInitStarted = false;
  function ensureMap() {
    if (mapInitStarted) return;
    mapInitStarted = true;
    loadMapboxLibs()
      .then(() => {
        map = createMap(mapTargetEl);
        map.addControl(new mapboxgl.AttributionControl({ compact: true }));

        map.on("load", () => {
          isLoaded = true;
          if (queuedFeatures !== null) {
            const features = queuedFeatures;
            queuedFeatures = null;
            render(features);
          }
        });

        // Keep markers / clusters up to date as the user pans and zooms. This
        // is purely visual — the list is NOT auto-refiltered to viewport. See
        // the search-area button below for explicit bounds refilter.
        //
        // `originalEvent` is only present on USER-initiated moves (pan, pinch,
        // wheel). Programmatic moves (flyTo, fitBounds) don't carry it — we
        // only mark the button "dirty" when the user actually moved the map.
        map.on("moveend", (e) => {
          renderClusters();
          if (e.originalEvent) setSearchAreaDirty(true);
        });
      })
      .catch((err) => console.error(err));
  }

  // Build the map the first time its container nears the viewport. Deferring
  // to idle keeps mapbox-gl's parse/eval out of the post-FCP TBT window. The
  // 200px rootMargin warms it just before it's actually scrolled into view.
  const mapObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      mapObserver.disconnect();
      whenIdle(ensureMap);
    },
    { rootMargin: "200px" },
  );
  mapObserver.observe(mapTargetEl);

  // City switch → re-center the map. Gated on initialRenderDone so an
  // activation that lands between map.load and the first render doesn't
  // start a flyTo that fitToFeatures will immediately interrupt — the
  // initial-render block owns that case. After the first render, every
  // slug change re-flies here.
  /** @type {any} */ (window).bruce?.city?.onChange?.(() => {
    if (initialRenderDone) flyToCity();
  });

  // Locate buttons → request a fresh location on each click (bypasses the
  // module-level cache so repeat clicks re-prompt or refresh). `data-state` is
  // mirrored across every copy so the desktop and mobile buttons agree.
  const setLocateState = (state) =>
    locateButtonEls.forEach((el) => (el.dataset.state = state));
  locateButtonEls.forEach((btn) => {
    btn.addEventListener("click", async () => {
      setLocateState("locating");
      const loc = await requestUserLocation();
      setLocateState(loc ? "success" : "error");
      if (loc) showUserLocation(loc);
    });
  });

  // Search-this-area buttons → explicit bounds refilter. The list ONLY narrows
  // to the visible map area when the user presses this. Pan/zoom alone don't
  // change the list — matches the Airbnb/Booking pattern and avoids the
  // "my list keeps jumping" surprise.
  searchAreaButtonEls.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isLoaded) return;
      // `mapPanTriggered` doubles here as "this filter pass was triggered by
      // the map, not by a user filter/category change". The filter hook uses
      // it to decide whether to apply the bounds filter; `afterRender` uses
      // it to skip the full marker rebuild (markers haven't changed, just
      // which items the list shows).
      mapPanTriggered = true;
      fsListInstance.triggerHook("filter");
      // List now reflects the current map view → clean state, buttons hide.
      setSearchAreaDirty(false);
    });
  });

  // Bounds-filters items when moveend triggered this pass; otherwise passes
  // through. Captures the output as `filteredItems` — afterRender receives the
  // post-pagination slice, which would miss everything beyond the current page.
  fsListInstance.addHook("filter", (items) => {
    let result = items;
    // Only narrow to map bounds when the user explicitly requested it AND
    // there's enough visible map to browse (skip when sheet is fully
    // expanded — showing "0 in view" would be jarring).
    if (isLoaded && mapPanTriggered && getCanvasSize(map, 200)) {
      const bounds = map.getBounds();
      result = items.filter((item) => {
        const one = extractOne(item.element);
        return !one || bounds.contains(one.coordinates);
      });
    }
    filteredItems = result;
    scheduleFilteringTransition();
    return result;
  });

  // `afterRender` fires after the full pipeline resolves on every change
  // (filter, sort, pagination, load-more, initial render). On map-driven
  // updates we skip the map side — FS already re-rendered the list subset,
  // and `renderClusters` already ran on moveend. On FS-driven updates we
  // do the full rebuild + refit so the map follows the user's intent.
  fsListInstance.addHook("afterRender", (items) => {
    // Count display reflects the post-filter, pre-pagination set; update
    // before any early return so map-driven and in-progress-load renders
    // still keep the count in sync.
    updateCountDisplay(component, filteredItems.length);
    refreshSearchbarCounts();
    // Reveal the (server-rendered, already-in-DOM) cards on the first render
    // instead of waiting for the full 44-page CMS stream + map init. This is
    // the main LCP win: the visible list no longer hides behind background
    // loading. `render()` self-queues until the map exists, so calling it here
    // before the map is built is safe.
    setState("ready");
    if (mapPanTriggered) {
      mapPanTriggered = false;
      return items;
    }
    // Render markers from the items loaded so far so the map fills in as pages
    // stream. Fit the camera only once fully loaded AND on a real user filter
    // change — never on a streaming page or on the load-finished re-render
    // (finalizingCmsLoad), so the view stays put while data arrives.
    render(extractFeatures(filteredItems.map((i) => i.element)), {
      fit: cmsLoadDone && initialRenderDone && !finalizingCmsLoad,
    });
    finalizingCmsLoad = false;
    return items;
  });
}

// ── Searchbar filter counts ──────────────────────────────────
// The Finsweet filters form holds every filter input on this page. Reflect its
// active-filter count badges via the shared util (which dedupes the duplicated
// modal/nav/toolbar copies of each option). The `afterRender` hook above drives
// every refresh — user toggles re-render, and so do Finsweet's programmatic
// changes (URL restore on load, "Reset all", chip removal) — so no separate
// `change` listener is needed. A baseline runs at boot, and submit is blocked so
// Enter in the search field doesn't reload the page out from under Finsweet.
// (Off the search page, `studios-search-redirect.js` owns its own form.)
const SEARCH_FORM_SELECTOR = 'form[fs-list-element="filters"]';

function refreshSearchbarCounts() {
  document
    .querySelectorAll(SEARCH_FORM_SELECTOR)
    .forEach((form) =>
      updateFilterCounts(/** @type {HTMLFormElement} */ (form)),
    );
}

// True when any filter is currently engaged: a checked option in any group, or
// a non-empty free-text query. Read straight from the form DOM (same source as
// the count badges) so it reflects post-clear state when called from
// afterRender. Used to send the camera home to the selected city when the user
// clears everything rather than fitting the whole unfiltered set.
function hasActiveFilters() {
  for (const form of document.querySelectorAll(SEARCH_FORM_SELECTOR)) {
    for (const el of form.querySelectorAll("input")) {
      const input = /** @type {HTMLInputElement} */ (el);
      if (!input.name) continue;
      if (input.name === "q") {
        if (input.value.trim()) return true;
      } else if (input.checked) {
        return true;
      }
    }
  }
  return false;
}

function setupSearchbarForms() {
  document.querySelectorAll(SEARCH_FORM_SELECTOR).forEach((el) => {
    const form = /** @type {HTMLFormElement} */ (el);
    if (form.dataset.searchFiltersInit) return;
    form.dataset.searchFiltersInit = "true";
    form.addEventListener("submit", (event) => event.preventDefault());
    // Reflect filter state instantly on interaction, ahead of Finsweet's
    // 200ms-debounced afterRender. afterRender stays the authoritative refresh
    // for programmatic changes (URL restore on load, "Reset all", chip
    // removal); this just removes the felt lag on a direct user toggle.
    // updateFilterCounts is pure + idempotent, so the double-run is harmless.
    form.addEventListener("change", () => updateFilterCounts(form));
    updateFilterCounts(form);
  });
}

// ── Apply inbound deep-link filters ──────────────────────────
// Pages elsewhere link in with clean params (studios-search-redirect.js):
// `/s?q=boxing&city=Stockholm&category=Pilates`. We replay each as exactly ONE
// real checkbox click and let Finsweet own all state from there.
//
// Why one click and nothing else: the filter form renders each option as 3
// duplicate copies (modal / nav / toolbar) that Finsweet does NOT keep in
// sync (a real click checks only the clicked copy), and `fs-list-debounce=200`
// makes it re-read the DOM after a delay. Any approach that ends up with more
// than one checked copy — faking `.checked`, or the `filters` model API which
// reflects into all 3 copies — gets re-read as the value N times ("BLACK |
// BLACK | BLACK") and breaks toggling. One genuine click matches native
// behaviour exactly: one tag (it's an `interacted` event), one condition,
// clean toggle. Prefer the copy in the visible toolbar dropdowns
// (`[data-search-group]`, where the count badges live) so the selection shows
// where the user actually looks. Runs once.
//
// NOTE: because Finsweet never syncs the 3 duplicate UIs, only the toolbar
// dropdown reflects the selection — the modal/nav copies stay blank, exactly
// as they would for a manual click. Fully syncing them needs the duplicate
// filter UIs collapsed into one instance (a markup change), not more JS.

// PerformanceNavigationTiming.type for this page load, or "navigate" where the
// API is unavailable (treated as a fresh inbound visit → safe to replay).
function getNavigationType() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return /** @type {any} */ (nav)?.type ?? "navigate";
}

let urlFiltersApplied = false;
function applyUrlDeepLinkFilters() {
  if (urlFiltersApplied) return;
  // On back/forward Finsweet restores its own filter state from the URL it
  // took over — replaying our params on top double-checks the duplicate
  // copies and desyncs the model (see studios-deep-link.js). Leave it to FS,
  // and seal the gate so this decision isn't re-evaluated on every later
  // Finsweet callback for the rest of the page's life.
  if (!shouldApplyDeepLinkFilters(getNavigationType())) {
    urlFiltersApplied = true;
    return;
  }
  const form = document.querySelector(SEARCH_FORM_SELECTOR);
  if (!form) return;

  const params = new URLSearchParams(location.search);

  // fieldKey → set of values (repeated keys = multi-select within a field).
  const byField = new Map();
  for (const [key, value] of params) {
    if (key === "q") continue;
    const set = byField.get(key) ?? new Set();
    set.add(value);
    byField.set(key, set);
  }

  const query = (params.get("q") ?? "").trim();
  if (byField.size === 0 && !query) return;
  urlFiltersApplied = true;

  requestAnimationFrame(() => {
    const inputs = /** @type {HTMLInputElement[]} */ ([
      ...form.querySelectorAll("input[fs-list-field][fs-list-value]"),
    ]);
    for (const [fieldKey, values] of byField) {
      for (const value of values) {
        const copies = inputs.filter(
          (el) =>
            el.getAttribute("fs-list-field") === fieldKey &&
            el.getAttribute("fs-list-value") === value,
        );
        // Skip the click if ANY copy is already checked — clicking a second
        // copy registers the value twice and breaks toggling. Inspect every
        // copy, not just the toolbar one, since the copies are never synced.
        const idx = pickDeepLinkClickIndex(
          copies.map((el) => ({
            checked: el.checked,
            inSearchGroup: !!el.closest("[data-search-group]"),
          })),
        );
        if (idx !== -1) copies[idx].click();
      }
    }

    // Free-text query → the search input, which Finsweet watches for `input`.
    if (query) {
      const search = /** @type {HTMLInputElement | null} */ (
        form.querySelector('input[name="q"]')
      );
      if (search) {
        search.value = query;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSearchbarForms, {
    once: true,
  });
} else {
  setupSearchbarForms();
}

window.FinsweetAttributes ||= [];
window.FinsweetAttributes.push([
  "list",
  (listInstances) => {
    const studioInstances = listInstances.filter(
      (instance) => instance.instance === FS_LIST_INSTANCE_KEY,
    );
    if (studioInstances.length === 0) return;

    // mapbox-gl is loaded lazily per instance (see loadMapboxLibs) the first
    // time the map scrolls into view — nothing to await here.
    studioInstances.forEach((instance) => {
      if (initializedInstances.has(instance)) return;
      initializedInstances.add(instance);
      setupStudiosInstance(instance);
    });

    // Hooks are wired now, so applying inbound deep-link filters re-renders
    // through them (map + count badges follow).
    applyUrlDeepLinkFilters();
  },
]);
