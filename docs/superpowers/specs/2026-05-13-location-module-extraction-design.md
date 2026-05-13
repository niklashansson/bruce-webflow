# Location Module Extraction — Design

**Date:** 2026-05-13
**New module:** `src/location.js`
**Consumer:** `src/studios.js`

## Background

Browser geolocation lives inside `src/studios.js` today (`requestUserLocation`, `getInitialUserLocation`, the once-per-session promise cache, and the timeout/permission handling). It has no Mapbox dependency — it's a pure browser API wrapper that happens to be colocated with the map.

Other site features will want the user's location too. The clearest next consumer is "auto-select nearest city" against `window.bruce.city`, but anything else (closest-studio prompts, region-aware copy, etc.) needs the same primitive. Duplicating the prompt-handling + timeout dance per module is wrong; centralizing it makes the second consumer trivial and avoids competing permission prompts.

## Scope

- **In scope:** Move the two geolocation functions and their constants out of `studios.js` into a new `src/location.js`. Add a synchronous `getLastKnown()` accessor backed by a result cache. Wire the module into `src/index.js` and expose `window.bruce.location`.
- **Out of scope:** Nearest-city resolver. Auto-applying a city from coordinates. Any change to studios map behavior. Any change to `city.js`. Adding city coordinates to the CMS list.

## Module shape

`src/location.js` follows the `city.js` pattern: self-boots via import in `index.js`, attaches a public API to `window.bruce.location`, and also exports named functions so bundled modules can import directly.

The module owns three pieces of state at module scope:

- `lastKnown` — `[lng, lat] | null`. The most recent successful coordinate. Never wiped by a later failure.
- `initialLocationPromise` — `Promise<[lng, lat] | null> | null`. Shared promise for the session, populated on first call to `getInitialUserLocation()`. Identical lifecycle to today's promise in `studios.js`.
- (constants only) `USER_LOCATION_TIMEOUT = 8000`, `maximumAge: 60_000`, `enableHighAccuracy: false` — moved verbatim from `studios.js`.

## Public API

```js
// Always issues a fresh geolocation request, bypassing any cached promise.
// Resolves [lng, lat] on success, or null on permission denial, timeout, or
// the API being unavailable. On success, updates lastKnown.
requestUserLocation(): Promise<[number, number] | null>

// Returns the shared session-scoped promise. First call kicks off the
// request; subsequent calls reuse the same in-flight or settled promise.
// Used to coordinate multiple modules that want location on boot without
// double-prompting. On success, updates lastKnown.
getInitialUserLocation(): Promise<[number, number] | null>

// Synchronous accessor. Returns the most recent successful coord, or null
// if we never got one. Never triggers a prompt, never throws.
getLastKnown(): [number, number] | null
```

All three are exported as ES module named exports AND attached to `window.bruce.location` with the same names.

## Cache semantics

Two independent caches:

1. **Promise cache** (`initialLocationPromise`). Populated by the first `getInitialUserLocation()` call. Shared across the session. Re-entrant calls return the same promise. `requestUserLocation()` does *not* read or write this cache — it always issues a fresh request.

2. **Result cache** (`lastKnown`). Updated by *any* successful resolution from either function. A subsequent failed `requestUserLocation()` does **not** wipe a previously-cached success — a stale coord still beats `null` for synchronous callers. `null` resolutions never populate `lastKnown`.

No status enum, no "denied vs. never asked" distinction. `lastKnown === null` means "no coord available right now"; callers that need to differentiate can await the promise functions.

## studios.js changes

- Delete `requestUserLocation`, `getInitialUserLocation`, and the `initialLocationPromise` module-level variable.
- Delete the `USER_LOCATION_TIMEOUT` constant.
- Add `import { requestUserLocation, getInitialUserLocation } from "./location.js";` at the top of the file.
- Keep `USER_LOCATION_ZOOM` in `studios.js` — that's map-camera config, not a location concern.
- Call sites stay identical (`requestUserLocation()` in the locate-button handler, `getInitialUserLocation()` in the initial-render block).

## index.js changes

Add `import "./location.js";` so `window.bruce.location` is attached on every page load, in parity with `city.js`. Place it directly after the `city.js` import to group the `window.bruce.*` registrants together.

## Verification

This is a code move with one additive accessor; no behavioral change is intended. Verification is by exercising the existing studios flows:

- **Locate button** still triggers a fresh prompt on each click and flies to the user's location on success.
- **Initial render** still attempts a one-time fly-to after first successful render; denying the prompt leaves the fit-to-all view in place.
- **Multiple studio map instances on the page** still share the single initial prompt (the promise cache survives the move).
- **`window.bruce.location.getLastKnown()`** returns `null` before any location call, then the coord after a successful prompt, and is unaffected by a later failed `requestUserLocation()`.

No new automated tests — Webflow's runtime is the integration surface.

## Risks

- **Boot order between modules.** Modules importing `requestUserLocation` need `location.js` evaluated first. ES module hoisting handles this — both consumers `import` rather than reading `window.bruce.location`, so there's no read-before-attach race. The `window.bruce.location` global is for non-bundled consumers and is attached at module-evaluation time, before any user interaction.
- **Permission-prompt regressions.** The promise-cache contract (one prompt per session) is the most important behavior to preserve. The move keeps the cache at module scope in the same way it lived in `studios.js`, just in a different file.
