/**
 * Directions Links
 *
 * Upgrades any authored "Directions" link so it opens the visitor's most
 * likely map app (Apple Maps on iOS/macOS, Google Maps elsewhere, or a
 * provider the visitor explicitly chose). Works on any page, inside CMS
 * items, sliders and components — it's attribute-driven, not component-bound.
 *
 * Markup:
 *   <a href="https://www.google.com/maps/dir/?api=1&destination=55.6,13.0"
 *      data-directions
 *      data-directions-lat="55.6" data-directions-lng="13.0"
 *      data-directions-name="Bruce Malmö">Directions</a>
 *
 *   Author a real Google URL as the static href (bind CMS lat/lng into it) so
 *   the link is correct with JS off; this module only rewrites it.
 *
 * Optional per-link attributes:
 *   - data-directions-provider="apple|google|waze"  force a provider
 *
 * Optional chooser (any clickable element):
 *   <button data-directions-choose="apple">Apple Maps</button>
 *   Stores the choice in localStorage and re-upgrades every link on the page.
 *
 * Resolution order: per-link provider → stored choice → platform default.
 *
 * Links are upgraded on DOM ready and again whenever new [data-directions]
 * nodes are inserted (Finsweet re-renders, slider clones), via a
 * MutationObserver. The href *attribute* is set (not the .href property) so
 * middle-click, right-click and assistive tech see the final URL.
 */

import {
  resolveProvider,
  isApplePlatform,
  buildDirectionsUrl,
  parseCoords,
  normalizeProvider,
} from "./directions-url.js";

const LINK = "[data-directions]";
const CHOOSER = "[data-directions-choose]";
const STORAGE_KEY = "bruce:mapProvider";

function readStoredProvider() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredProvider(provider) {
  try {
    if (provider) localStorage.setItem(STORAGE_KEY, provider);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage disabled — choice just won't persist */
  }
}

/**
 * Resolves the provider and builds the URL for one destination. Exported so
 * component scripts that already know their coords (studio.js) share the
 * exact same resolution rules as attribute-driven links.
 *
 * @param {{lat: number, lng: number, name?: string}} dest
 * @param {{provider?: string | null}} [opts]
 * @returns {string}
 */
export function directionsHref(dest, { provider } = {}) {
  const resolved = resolveProvider({
    override: provider,
    stored: readStoredProvider(),
    isApple: isApplePlatform(navigator),
  });
  return buildDirectionsUrl(resolved, dest);
}

/**
 * Rewrites the href of every [data-directions] link under `root`. Links with
 * missing/invalid coords are left untouched (their authored href still works).
 *
 * @param {ParentNode} [root]
 */
export function upgradeDirectionsLinks(root = document) {
  root.querySelectorAll(LINK).forEach(upgradeLink);
}

function upgradeLink(link) {
  const coords = parseCoords(
    link.getAttribute("data-directions-lat"),
    link.getAttribute("data-directions-lng"),
  );
  if (!coords) return;
  const name = link.getAttribute("data-directions-name") || undefined;
  const provider = link.getAttribute("data-directions-provider");
  link.setAttribute("href", directionsHref({ ...coords, name }, { provider }));
}

function setupChooser() {
  document.addEventListener("click", (e) => {
    const target = /** @type {Element | null} */ (e.target);
    const el = target?.closest?.(CHOOSER);
    if (!el) return;
    const provider = normalizeProvider(el.getAttribute("data-directions-choose"));
    writeStoredProvider(provider);
    upgradeDirectionsLinks();
    document.dispatchEvent(
      new CustomEvent("directions:provider", { detail: { provider } }),
    );
  });
}

function observeInsertions() {
  if (typeof MutationObserver !== "function") return;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(LINK)) upgradeLink(node);
        upgradeDirectionsLinks(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// studio.js is a separate Parcel entry that also imports this module, so on
// the studio page two bundles evaluate it. Init once per page.
const INIT_FLAG = "__bruceDirectionsInit";

function init() {
  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;
  upgradeDirectionsLinks();
  setupChooser();
  observeInsertions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
