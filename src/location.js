/**
 * Location
 *
 * Browser geolocation, centralized so multiple modules can share the
 * permission prompt and session cache. Pure browser-API wrapper — no
 * dependency on Mapbox or any other library.
 *
 * ── Public API ───────────────────────────────────────────────
 *   window.bruce.location.requestUserLocation()
 *     Always issues a fresh geolocation request. Resolves [lng, lat]
 *     on success, null on denial / timeout / unavailable. Updates the
 *     last-known cache on success.
 *
 *   window.bruce.location.getInitialUserLocation()
 *     Shared session-scoped promise. First call kicks off the request;
 *     subsequent calls reuse the same in-flight or settled promise.
 *     Use this to coordinate boot-time location reads across modules
 *     without double-prompting.
 *
 *   window.bruce.location.getLastKnown()
 *     Synchronous accessor. Returns the most recent successful coord,
 *     or null. Never triggers a prompt, never throws. A later failed
 *     request does NOT wipe a previously-cached success.
 *
 * Each function is also exported as an ES module named export.
 */

const USER_LOCATION_TIMEOUT = 8000;

/** @type {[number, number] | null} */
let lastKnown = null;

/** @type {Promise<[number, number] | null> | null} */
let initialLocationPromise = null;

// Browser geolocation → [lng, lat] or null on denial / timeout / unavailable.
// External timeout guards against stuck permission prompts (the native
// `timeout` option only counts time after permission is granted).
export function requestUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (result) lastKnown = result;
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

// Shared across modules so the permission prompt only fires once per session.
export function getInitialUserLocation() {
  if (!initialLocationPromise) initialLocationPromise = requestUserLocation();
  return initialLocationPromise;
}

export function getLastKnown() {
  return lastKnown;
}

/** @type {any} */ (window).bruce ||= {};
/** @type {any} */ (window).bruce.location = {
  requestUserLocation,
  getInitialUserLocation,
  getLastKnown,
};
