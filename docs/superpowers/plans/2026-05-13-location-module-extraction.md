# Location Module Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull browser geolocation out of `src/studios.js` into a dedicated `src/location.js` module so other site features can share the prompt-handling and session cache.

**Architecture:** New `src/location.js` follows the `city.js` pattern — self-boots via import in `index.js`, attaches a public API to `window.bruce.location`, and exports named functions for bundled consumers. Three functions: `requestUserLocation` (fresh request), `getInitialUserLocation` (session promise cache), `getLastKnown` (sync accessor backed by a result cache). `studios.js` becomes a consumer.

**Tech Stack:** Vanilla ES modules, Parcel bundler, no test framework — verification is via `npm run build` (must succeed) plus manual smoke in the Webflow runtime.

**Spec:** `docs/superpowers/specs/2026-05-13-location-module-extraction-design.md`

---

### Task 1: Create `src/location.js`

**Files:**
- Create: `src/location.js`

- [ ] **Step 1: Write the module**

Create `src/location.js` with this exact content:

```js
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
```

- [ ] **Step 2: Verify the bundle builds**

Run: `npm run build`
Expected: Parcel build succeeds, exits 0, writes `dist/index.js`. No new warnings about unresolved imports.

- [ ] **Step 3: Smoke the global in a browser**

Briefly verify the global attaches. In any browser tab running a bundle that loads `dist/index.js` (or by running `npm run start` and opening the Parcel dev URL), open DevTools and run:

```js
window.bruce.location.getLastKnown()
```

Expected: `null` (no location request has been made yet).

Run:

```js
typeof window.bruce.location.requestUserLocation
```

Expected: `"function"`.

Don't call `requestUserLocation()` here — it'd trigger a real prompt. The type check is enough.

- [ ] **Step 4: Commit**

```bash
git add src/location.js
git commit -m "$(cat <<'EOF'
Add src/location.js with shared geolocation primitives

Centralizes the browser geolocation prompt and session cache so future
site features can consume location without duplicating permission
handling. Exposes window.bruce.location alongside ES module exports.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `location.js` into `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add the import**

Edit `src/index.js`. Current content:

```js
import "./nav.js";
import "./announcements.js";
import "./variables.js";
import "./city.js";
import "./slider.js";
import "./tab.js";
import "./visual-video.js";
```

Add `import "./location.js";` immediately after the `city.js` import (grouping the `window.bruce.*` registrants together). Result:

```js
import "./nav.js";
import "./announcements.js";
import "./variables.js";
import "./city.js";
import "./location.js";
import "./slider.js";
import "./tab.js";
import "./visual-video.js";
```

- [ ] **Step 2: Verify the bundle builds**

Run: `npm run build`
Expected: Parcel build succeeds, exits 0. Bundle size increases slightly (new module included).

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "$(cat <<'EOF'
Register location module in main bundle

Imports src/location.js so window.bruce.location is attached on every
page load, matching the city.js pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate `src/studios.js` to consume `location.js`

**Files:**
- Modify: `src/studios.js`

- [ ] **Step 1: Add the import**

At the top of `src/studios.js`, immediately after the leading comment block (before `const FS_LIST_INSTANCE_KEY = "studios";`), add:

```js
import {
  requestUserLocation,
  getInitialUserLocation,
} from "./location.js";
```

- [ ] **Step 2: Remove the `USER_LOCATION_TIMEOUT` constant**

In `src/studios.js`, find this block (currently around lines 37-38):

```js
const USER_LOCATION_ZOOM = 11;
const USER_LOCATION_TIMEOUT = 8000;
```

Delete the `USER_LOCATION_TIMEOUT` line only. Keep `USER_LOCATION_ZOOM` — it's map-camera config and stays in studios.js. Result:

```js
const USER_LOCATION_ZOOM = 11;
```

- [ ] **Step 3: Remove the local `requestUserLocation` function**

In `src/studios.js`, delete the entire `requestUserLocation` definition (currently around lines 74-103, including the comment block above it). The block to remove is:

```js
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
```

- [ ] **Step 4: Remove the local `getInitialUserLocation` function and its cache**

In `src/studios.js`, immediately below where the previous block was, delete the entire `getInitialUserLocation` definition and the comment + module-level `initialLocationPromise` variable (currently around lines 105-110). The block to remove is:

```js
// Shared across map instances so the permission prompt only fires once.
let initialLocationPromise = null;
function getInitialUserLocation() {
  if (!initialLocationPromise) initialLocationPromise = requestUserLocation();
  return initialLocationPromise;
}
```

- [ ] **Step 5: Verify the bundle builds**

Run: `npm run build`
Expected: Parcel build succeeds, exits 0. No "is not defined" errors for `requestUserLocation`, `getInitialUserLocation`, or `USER_LOCATION_TIMEOUT`.

- [ ] **Step 6: Grep for leftover references**

Run: `grep -n "USER_LOCATION_TIMEOUT\|initialLocationPromise" src/studios.js`
Expected: No matches.

Run: `grep -n "requestUserLocation\|getInitialUserLocation" src/studios.js`
Expected: Two matches — one on the new `import` line and one each at the two call sites (the locate-button handler and the initial-render block). The function definitions should be gone.

- [ ] **Step 7: Manual verification in the Webflow runtime**

Open a Webflow page that hosts the studios map (with the published `dist/index.js` from `npm run build`, or via the Parcel dev server if the site is configured for it). Walk through these three flows with DevTools open:

1. **Initial render fly-to** — Load the page. Approve the geolocation prompt when asked. Expected: after the first render, the map flies to the user's location. Deny the prompt instead: map stays on the fit-to-all view, no errors.

2. **Locate button** — Click the locate button (`[data-studios-element="locate"]`). Expected: a *fresh* geolocation request fires (DevTools shows the prompt on first click if permission was reset, or resolves immediately otherwise), and the map flies to the user's location. `locateButtonEl.dataset.state` cycles through `locating` → `success` (or `error`).

3. **Multiple map instances on a single page** (if applicable) — Load a page with two studios lists. Expected: only one permission prompt fires, both instances receive the same result.

4. **`getLastKnown` reflects success** — In DevTools after a successful prompt: `window.bruce.location.getLastKnown()` returns `[lng, lat]`, not `null`.

Any failure here is a regression — stop and investigate before committing.

- [ ] **Step 8: Commit**

```bash
git add src/studios.js
git commit -m "$(cat <<'EOF'
Migrate studios.js to consume shared location module

Removes the local geolocation helpers and session-cache variable.
studios.js now imports requestUserLocation and getInitialUserLocation
from src/location.js. Behavior is unchanged: locate button still
requests fresh, initial render still uses the shared session promise.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage check:**
- "Move the two geolocation functions and their constants out of studios.js into a new src/location.js" → Task 1 + Task 3.
- "Add a synchronous getLastKnown() accessor backed by a result cache" → Task 1, Step 1 (the `lastKnown` variable + `getLastKnown` export).
- "Wire the module into src/index.js and expose window.bruce.location" → Task 1 (window attachment) + Task 2 (import in index.js).
- Cache semantics — promise cache and result cache independent → Task 1 (the two module-level variables, `requestUserLocation` updates `lastKnown`, `getInitialUserLocation` reuses `initialLocationPromise`).
- "studios.js changes" enumeration → Task 3 covers each item (import added, USER_LOCATION_TIMEOUT removed, two functions removed, USER_LOCATION_ZOOM kept).
- Verification flows (locate button, initial render, multi-instance, getLastKnown) → Task 3, Step 7.

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N". All code blocks contain complete content.

**Type / name consistency:** `requestUserLocation`, `getInitialUserLocation`, `getLastKnown`, `lastKnown`, `initialLocationPromise`, `USER_LOCATION_TIMEOUT` are used consistently across Task 1 and Task 3.
