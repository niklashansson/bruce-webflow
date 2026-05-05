// Studios Map — renders a Mapbox GL map per Finsweet `studios` list instance,
// reacting to filter / sort / load changes. Clusters items client-side with
// supercluster so each point + cluster stays as a DOM-based HTML marker.
//
// Requires mapbox-gl + supercluster + Swiper loaded via CDN in the Webflow site <head>:
// <link href="https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.css" rel="stylesheet">
// <script src="https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.js"></script>
// <script src="https://unpkg.com/supercluster@8.0.0/dist/supercluster.min.js"></script>
// <link href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" rel="stylesheet">
// <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
// <script type="module">
//import { registerSheetElements } from "https://cdn.jsdelivr.net/npm/pure-web-bottom-sheet@0.6.0/dist/web.client.js";
// registerSheetElements();
// </script>

const FS_LIST_INSTANCE_KEY = "studios";

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoibmlrbGFzaGFuc3NvbiIsImEiOiJjbWxleHI0MngxaHU3M2dzOWZrMXJpMjJlIn0.yvXc8nLFEuUocjlwqNZiJQ";
const MAPBOX_STYLE = "mapbox://styles/niklashansson/cmlextxil004n01r3d9gq7uzj";

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
const USER_LOCATION_TIMEOUT = 8000;

const CLUSTER_CONFIG = { radius: 50, maxZoom: 14, minPoints: 6 };
const CLUSTER_EXPANSION_PADDING = 0.5; // extra zoom beyond expansionZoom
const FALLBACK_CLUSTER_SIZES = { small: 32, medium: 40, large: 48, xl: 56 };
const FALLBACK_CLUSTER_CLASS = "studios-cluster--fallback";

const POPUP_CLASS = "studios-popup";

const SHEET_HEIGHT_VAR = "--studios-sheet-height";
const SHEET_CHANGING_CLASS = "studios-sheet-changing";
const SHEET_SETTLE_DEBOUNCE_MS = 120;

const S = {
  component: '[data-studios-element="component"]',
  mapTarget: '[data-studios-element="map-target"]',
  marker: '[data-studios-element="marker"]',
  popup: '[data-studios-element="popup"]',
  clusterTemplate: '[data-studios-element="cluster-template"]',
  loading: '[data-studios-element="loading"]',
  locateButton: '[data-studios-element="locate"]',
  searchAreaButton: '[data-studios-element="search-area"]',
  userLocation: '[data-studios-element="user-location"]',
  sheet: '[data-studios-element="sheet"]',
  content: '[data-studios-element="content"]',
  contentDesktop: '[data-studios-element="content-desktop"]',
  contentMobile: '[data-studios-element="content-mobile"]',
  count: '[data-studios-field="count"]',
  lat: '[data-studios-field="lat"]',
  lng: '[data-studios-field="lng"]',
  id: '[data-studios-field="id"]',
};

let mapboxgl = null;
const initializedInstances = new WeakSet();

// Browser geolocation → [lng, lat] or null on denial / timeout / unavailable.
// External timeout guards against stuck permission prompts (the native
// `timeout` option only counts time after permission is granted).
function requestUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), USER_LOCATION_TIMEOUT);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish([pos.coords.longitude, pos.coords.latitude]);
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      {
        timeout: USER_LOCATION_TIMEOUT,
        maximumAge: 60_000,
        enableHighAccuracy: false,
      },
    );
  });
}

// Shared across map instances so the permission prompt only fires once.
let initialLocationPromise = null;
function getInitialUserLocation() {
  if (!initialLocationPromise) initialLocationPromise = requestUserLocation();
  return initialLocationPromise;
}

function getResponsiveZoom() {
  return window.innerWidth <= ZOOM_CONFIG.breakpoint
    ? ZOOM_CONFIG.mobile
    : ZOOM_CONFIG.desktop;
}

function createFallbackMarkerEl() {
  const el = document.createElement("div");
  el.style.cssText =
    "width:16px;height:16px;border-radius:50%;background:#000;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer";
  return el;
}

function createFallbackUserLocationEl() {
  const el = document.createElement("div");
  el.className = "studios-user-location studios-user-location--fallback";
  el.style.cssText =
    "width:18px;height:18px;border-radius:50%;background:#4285f4;border:3px solid #fff;box-shadow:0 0 0 6px rgba(66,133,244,0.3),0 2px 6px rgba(0,0,0,0.3);pointer-events:none";
  return el;
}

function getClusterSizeTier(count) {
  if (count < 10) return "small";
  if (count < 50) return "medium";
  if (count < 200) return "large";
  return "xl";
}

// Single source of truth for applying count-dependent styling to a cluster
// element. Handles both templated and fallback clusters.
function applyClusterMeta(el, count, countSlotSelector) {
  if (!(el instanceof HTMLElement)) return;
  const tier = getClusterSizeTier(count);
  el.dataset.size = tier;
  el.style.setProperty("--studios-cluster-count", String(count));
  const slot = countSlotSelector ? el.querySelector(countSlotSelector) : null;
  if (slot) slot.textContent = String(count);
  if (el.classList.contains(FALLBACK_CLUSTER_CLASS)) {
    const size = FALLBACK_CLUSTER_SIZES[tier];
    el.style.minWidth = `${size}px`;
    el.style.height = `${size}px`;
    el.style.padding = `0 ${Math.round(size / 4)}px`;
    el.style.fontSize = `${Math.max(12, Math.round(size * 0.3))}px`;
    el.textContent = String(count);
  }
}

function createFallbackClusterEl(count) {
  const el = document.createElement("div");
  el.className = `studios-cluster ${FALLBACK_CLUSTER_CLASS}`;
  el.style.cssText =
    "display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#000;color:#fff;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);";
  applyClusterMeta(el, count);
  return el;
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

  const idEl = el.querySelector(S.id);
  const feature = {
    coordinates: [lng, lat],
    id: idEl ? idEl.textContent.trim() : "",
    markerEl: el.querySelector(S.marker),
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
      `[studios-map] Extracted ${features.length} / ${elements.length} items. Skipped ${skipped} with missing or invalid ${S.lat} / ${S.lng}. (Logged once per session.)`,
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
  return cloneTemplate(feature.markerEl) || createFallbackMarkerEl();
}

function buildPopupContent(feature) {
  return cloneTemplate(feature.popupEl);
}

function buildClusterElement(templateEl, count) {
  const clone = cloneTemplate(templateEl);
  if (!clone) return createFallbackClusterEl(count);
  applyClusterMeta(clone, count, S.count);
  return clone;
}

function createMap(container) {
  return new mapboxgl.Map({
    container,
    style: MAPBOX_STYLE,
    projection: "globe",
    center: DEFAULT_CENTER,
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
  if (clusterTemplateEl && !clusterTemplateEl.querySelector(S.count)) {
    console.warn(
      `[studios-map] Cluster template has no ${S.count} slot — the count won't update. Add data-studios-field="count" to a text element inside the cluster template.`,
    );
  }
  const loadingEl = component.querySelector(S.loading);
  function setLoading(isLoading) {
    if (!loadingEl) return;
    loadingEl.style.display = isLoading ? "" : "none";
  }

  const locateButtonEl = component.querySelector(S.locateButton);
  const searchAreaButtonEl = component.querySelector(S.searchAreaButton);
  const userLocationTemplateEl = component.querySelector(S.userLocation);

  // Dirty flag on the search-area button — `.is-active` matches the
  // site-wide Finsweet convention (`fs-list-activeclass`).
  let searchAreaDirty = false;
  const setSearchAreaDirty = (dirty) => {
    if (!searchAreaButtonEl || dirty === searchAreaDirty) return;
    searchAreaDirty = dirty;
    searchAreaButtonEl.classList.toggle("is-active", dirty);
  };

  const map = createMap(mapTargetEl);
  map.addControl(new mapboxgl.AttributionControl({ compact: true }));

  // Debug handle for console diagnostics.
  if (typeof window !== "undefined") window.__map = map;

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
  // CMS Load streams pages in; defer rendering until all pages are in so we
  // rebuild supercluster once with the full dataset instead of per-page.
  const pendingCmsLoad = fsListInstance.loadingPaginatedItems;
  let cmsLoadDone = !pendingCmsLoad;
  setLoading(!cmsLoadDone);
  pendingCmsLoad?.finally(() => {
    cmsLoadDone = true;
    if (!mapPanTriggered) fsListInstance.triggerHook("filter");
  });

  let userLocationMarker = null;
  function setUserLocationMarker(loc) {
    if (userLocationMarker) {
      userLocationMarker.setLngLat(loc);
      return;
    }
    const el =
      cloneTemplate(userLocationTemplateEl) || createFallbackUserLocationEl();
    userLocationMarker = new mapboxgl.Marker({ element: el, anchor: "center" })
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

  function clearMarkers() {
    clusterMarkers.forEach((e) => e.marker.remove());
    clusterMarkers.clear();
    pointMarkers.forEach((e) => e.marker.remove());
    pointMarkers.clear();
  }

  function pointKey(feature) {
    return feature.id || feature.coordinates.join(",");
  }

  let activeSwiper = null;

  function destroyActiveSwiper() {
    if (!activeSwiper) return;
    activeSwiper.destroy(true, true);
    activeSwiper = null;
  }

  function initPopupSwiper(root) {
    const swiperEl = root.querySelector(".swiper");
    if (!swiperEl) return null;
    if (typeof window.Swiper !== "function") {
      console.warn(
        "[studios-map] Swiper not found on window. Add the CDN script to the Webflow <head>.",
      );
      return null;
    }

    return new window.Swiper(swiperEl, {
      slidesPerView: 1,
      followFinger: true,
      centeredSlides: false,
      autoHeight: false,
      speed: 500,
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        nextEl: root.querySelector(".studios_image-slider_button.is-next"),
        prevEl: root.querySelector(".studios_image-slider_button.is-previous"),
      },
      pagination: {
        el: root.querySelector(".studios_image-slider_bullet_list"),
        bulletActiveClass: "is-active",
        bulletClass: ".studios_image-slider_bullet_item",
        bulletElement: "button",
        clickable: true,
      },
      slideActiveClass: "is-active",
      slideDuplicateActiveClass: "is-active",
    });
  }

  function closePopup() {
    destroyActiveSwiper();
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
    // closePopup — listen for 'close' so Swiper is destroyed and refs cleared.
    activePopup.on("close", () => {
      destroyActiveSwiper();
      activePopup = null;
    });

    activeSwiper = initPopupSwiper(content);
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

  function render(features) {
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
      fitToFeatures(map, features, sheetCoverage());
    }

    // First successful render: try to zoom to the user's location when we
    // learn it. If location is denied / times out / unavailable, the map
    // stays on the fit-to-all view we just applied.
    if (!initialRenderDone) {
      initialRenderDone = true;
      getInitialUserLocation().then(showUserLocation);
    }
  }

  map.on("load", () => {
    isLoaded = true;
    if (queuedFeatures !== null) {
      const features = queuedFeatures;
      queuedFeatures = null;
      render(features);
    }
  });

  // Keep markers / clusters up to date as the user pans and zooms. This is
  // purely visual — the list is NOT auto-refiltered to viewport. See the
  // search-area button below for explicit bounds refilter.
  //
  // `originalEvent` is only present on USER-initiated moves (pan, pinch,
  // wheel). Programmatic moves (flyTo, fitBounds) don't carry it — we only
  // want to mark the button "dirty" when the user has actually moved the
  // map, not when our code did.
  map.on("moveend", (e) => {
    renderClusters();
    if (e.originalEvent) setSearchAreaDirty(true);
  });

  // Locate button → request a fresh location on each click (bypasses the
  // module-level cache so repeat clicks re-prompt or refresh).
  if (locateButtonEl) {
    locateButtonEl.addEventListener("click", async () => {
      locateButtonEl.dataset.state = "locating";
      const loc = await requestUserLocation();
      locateButtonEl.dataset.state = loc ? "success" : "error";
      if (loc) showUserLocation(loc);
    });
  }

  // Search-this-area button → explicit bounds refilter. The list ONLY narrows
  // to the visible map area when the user presses this. Pan/zoom alone don't
  // change the list — matches the Airbnb/Booking pattern and avoids the
  // "my list keeps jumping" surprise.
  if (searchAreaButtonEl) {
    searchAreaButtonEl.addEventListener("click", () => {
      if (!isLoaded) return;
      // `mapPanTriggered` doubles here as "this filter pass was triggered by
      // the map, not by a user filter/category change". The filter hook uses
      // it to decide whether to apply the bounds filter; `afterRender` uses
      // it to skip the full marker rebuild (markers haven't changed, just
      // which items the list shows).
      mapPanTriggered = true;
      fsListInstance.triggerHook("filter");
      // List now reflects the current map view → clean state, button hides.
      setSearchAreaDirty(false);
    });
  }

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
    return result;
  });

  // `afterRender` fires after the full pipeline resolves on every change
  // (filter, sort, pagination, load-more, initial render). On map-driven
  // updates we skip the map side — FS already re-rendered the list subset,
  // and `renderClusters` already ran on moveend. On FS-driven updates we
  // do the full rebuild + refit so the map follows the user's intent.
  fsListInstance.addHook("afterRender", (items) => {
    if (mapPanTriggered) {
      mapPanTriggered = false;
      return items;
    }
    if (!cmsLoadDone) return items;
    render(extractFeatures(filteredItems.map((i) => i.element)));
    setLoading(false);
    return items;
  });
}

window.FinsweetAttributes ||= [];
window.FinsweetAttributes.push([
  "list",
  (listInstances) => {
    const studioInstances = listInstances.filter(
      (instance) => instance.instance === FS_LIST_INSTANCE_KEY,
    );
    if (studioInstances.length === 0) return;

    if (!window.mapboxgl) {
      console.warn(
        "[studios-map] mapbox-gl not found on window. Add the CDN script to the Webflow <head>.",
      );
      return;
    }
    mapboxgl = window.mapboxgl;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    studioInstances.forEach((instance) => {
      if (initializedInstances.has(instance)) return;
      initializedInstances.add(instance);
      setupStudiosInstance(instance);
    });
  },
]);
