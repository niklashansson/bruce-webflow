/**
 * Directions URL — pure helpers for directions.js (and studio.js)
 *
 * Framework-free (no DOM, no imports) so the provider-resolution + URL-building
 * logic is unit-testable in Node. The DOM shell lives in directions.js. (Same
 * split as membership-pricing-format.js ↔ membership-pricing.js.)
 *
 * Browsers expose no "preferred map app" — the best available signal is the
 * platform (Apple devices ship Apple Maps; everything else defaults to Google
 * Maps), optionally overridden by an explicit per-link provider or a choice the
 * user made earlier that we stored.
 */

export const PROVIDERS = ["apple", "google", "waze"];

/**
 * Normalizes a provider string; returns null for anything unknown/empty so
 * callers can fall through to the next source.
 *
 * @param {string | null | undefined} value
 * @returns {"apple" | "google" | "waze" | null}
 */
export function normalizeProvider(value) {
  const v = (value || "").trim().toLowerCase();
  return PROVIDERS.includes(v) ? /** @type {any} */ (v) : null;
}

/**
 * Resolution order: per-link override → stored user preference → platform
 * default (Apple on iOS/macOS, Google elsewhere).
 *
 * @param {{override?: string | null, stored?: string | null, isApple: boolean}} input
 * @returns {"apple" | "google" | "waze"}
 */
export function resolveProvider({ override, stored, isApple }) {
  return (
    normalizeProvider(override) ||
    normalizeProvider(stored) ||
    (isApple ? "apple" : "google")
  );
}

/**
 * True on iOS / iPadOS / macOS. Prefers User-Agent Client Hints where the
 * browser exposes them (Chromium) and falls back to the UA string for
 * Safari/Firefox and Chrome-on-iOS. iPadOS 13+ reports "Macintosh", which we
 * also want → Apple.
 *
 * @param {{userAgentData?: {platform?: string}, userAgent?: string}} nav
 * @returns {boolean}
 */
export function isApplePlatform(nav) {
  const platform = nav?.userAgentData?.platform;
  if (platform) {
    const p = platform.toLowerCase();
    return p === "macos" || p === "ios";
  }
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(nav?.userAgent || "");
}

/**
 * Builds a "directions to here" URL using https universal links (not geo:/
 * maps: schemes) so the native app opens when installed and the web version
 * otherwise. No origin is passed — every provider fills in "from current
 * location" itself, so the page never has to ask for geolocation.
 *
 * `mode` "directions" (default) starts a route to the destination; "place"
 * just drops a pin on it (no "from here", no route UI) — right for an
 * address people want to look at rather than navigate to.
 *
 * `name` is used only where the provider supports a coord label (Apple's `q`).
 *
 * @param {"apple" | "google" | "waze"} provider
 * @param {{lat: number, lng: number, name?: string}} dest
 * @param {{mode?: "directions" | "place"}} [opts]
 * @returns {string}
 */
export function buildDirectionsUrl(provider, { lat, lng, name }, { mode = "directions" } = {}) {
  const ll = `${lat},${lng}`;
  const place = mode === "place";
  switch (provider) {
    case "apple": {
      const params = place
        ? new URLSearchParams({ ll })
        : new URLSearchParams({ daddr: ll, dirflg: "d" });
      if (name) params.set("q", name);
      return `https://maps.apple.com/?${params}`;
    }
    case "waze": {
      const params = new URLSearchParams({ ll });
      if (!place) params.set("navigate", "yes");
      return `https://waze.com/ul?${params}`;
    }
    default: {
      if (place) {
        const params = new URLSearchParams({ api: "1", query: ll });
        return `https://www.google.com/maps/search/?${params}`;
      }
      const params = new URLSearchParams({ api: "1", destination: ll });
      return `https://www.google.com/maps/dir/?${params}`;
    }
  }
}

/**
 * @param {string | null | undefined} value
 * @returns {"directions" | "place"}
 */
export function normalizeMode(value) {
  return (value || "").trim().toLowerCase() === "place" ? "place" : "directions";
}

/**
 * Parses a lat/lng pair from arbitrary attribute/text values. Returns null if
 * either is missing or non-numeric.
 *
 * @param {string | null | undefined} lat
 * @param {string | null | undefined} lng
 * @returns {{lat: number, lng: number} | null}
 */
export function parseCoords(lat, lng) {
  const la = parseFloat(lat ?? "");
  const ln = parseFloat(lng ?? "");
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}
