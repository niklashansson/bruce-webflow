# City Link Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-resolve plain gateway links (`/memberships`, `/studios` and their localized variants) to the active city's CMS page, using Webflow-rendered localized URLs so JS never constructs a path.

**Architecture:** A pure core (`city-links-plan.js`) decides match + href; a thin DOM shell (`city-links.js`) reads Webflow-rendered source elements, remembers managed links in a WeakMap, and rewrites matching `<a>` hrefs on every `bruce.city` change. Same pure/shell split as `city-resolve.js` ↔ `city-context.js`.

**Tech Stack:** Vanilla ES modules, Parcel bundle, framework-free `node:assert` tests.

**Spec:** `docs/superpowers/specs/2026-06-04-city-link-rewrite-design.md`

**Verified against live HTML** (Oslo membership page, English locale): gateway anchors `<a data-city-gateway="memberships" href="/memberships">` / `"/studios"`; `[data-city-link-list="memberships"]` items `<a data-city-link-key="stockholm" href="/memberships/stockholm">`; `[data-city-link-list="studios"]` items `<a data-city-link-key="stockholm" href="/studios/city/stockholm">`. The studios list element also carries `data-city-list` (it is the city registry). Slugs are full names.

---

## File Structure

- `src/city-links-plan.js` — **new**, pure. `matchSection()`, `resolveHref()`. No DOM, no imports.
- `tests/city-links-plan.test.mjs` — **new**, framework-free unit tests for the pure core.
- `src/city-links.js` — **new**, DOM shell. Reads source elements, WeakMap of managed links, `apply()`, boot.
- `src/index.js` — **modify**, add one import after `./city-switcher.js`.
- `src/city-resolve.js` — **modify**, remove the legacy `city-path` placeholder (Task 3).
- `tests/city-resolve.test.mjs` — **modify**, drop `city-path` expectations (Task 3).
- `docs/editors/city-system.md` — **modify**, remove `{{city-path}}` docs (Task 3).

---

## Task 1: Pure core — `city-links-plan.js` (TDD)

**Files:**
- Create: `src/city-links-plan.js`
- Test: `tests/city-links-plan.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/city-links-plan.test.mjs`:

```js
// Unit tests for the city-links-plan pure helpers.
// Framework-free: run with `node tests/city-links-plan.test.mjs`.
import assert from "node:assert/strict";
import { matchSection, resolveHref } from "../src/city-links-plan.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

const GATEWAYS = { memberships: "/memberships", studios: "/studios" };
const LINK_MAP = {
  memberships: {
    stockholm: "/memberships/stockholm",
    oslo: "/memberships/oslo",
  },
  studios: { stockholm: "/studios/city/stockholm" },
};

// ── matchSection ─────────────────────────────────────────────
check("exact match → section", matchSection("/memberships", GATEWAYS), "memberships");
check("trailing slash on link → still matches", matchSection("/memberships/", GATEWAYS), "memberships");
check("other section exact match", matchSection("/studios", GATEWAYS), "studios");
check("sub-page → null", matchSection("/memberships/foretag", GATEWAYS), null);
check("unrelated path → null", matchSection("/about", GATEWAYS), null);
check("empty gateways → null", matchSection("/memberships", {}), null);

// ── resolveHref ──────────────────────────────────────────────
check(
  "active city with page → city url",
  resolveHref({ section: "memberships", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/memberships/oslo",
);
check(
  "active city without page in section → gateway fallback",
  resolveHref({ section: "studios", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/studios",
);
check(
  "neutral → gateway path",
  resolveHref({ section: "memberships", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: null }),
  "/memberships",
);
check(
  "query + hash preserved on city url",
  resolveHref({ section: "memberships", search: "?plan=pro", hash: "#faq" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/memberships/oslo?plan=pro#faq",
);
check(
  "query + hash preserved on neutral fallback",
  resolveHref({ section: "memberships", search: "?plan=pro", hash: "#faq" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: null }),
  "/memberships?plan=pro#faq",
);

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/city-links-plan.test.mjs`
Expected: FAIL — `Cannot find module '../src/city-links-plan.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/city-links-plan.js`:

```js
/**
 * City Links Plan — pure helpers for city-links.js
 *
 * Framework-free (no DOM, no imports) so the gateway-match and href
 * composition logic is unit-testable in Node. The DOM/WeakMap/boot shell lives
 * in city-links.js. (Same split as city-resolve.js ↔ city-context.js.)
 */

/** Strip a single trailing slash, but keep root "/". */
function normalize(pathname) {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * Which gateway section does a bare path belong to? Exact match only
 * (trailing-slash normalized). Sub-pages and unrelated paths → null.
 *
 * @param {string} pathname
 * @param {Record<string,string>} gateways  section → gateway pathname
 * @returns {string|null}
 */
export function matchSection(pathname, gateways) {
  const p = normalize(pathname);
  for (const section of Object.keys(gateways)) {
    if (normalize(gateways[section]) === p) return section;
  }
  return null;
}

/**
 * The href to set for a managed link. Falls back to the gateway path when
 * neutral OR when the active city has no page in that section. Query + hash
 * are preserved verbatim.
 *
 * @param {{section: string, search: string, hash: string}} link
 * @param {{gateways: Record<string,string>, linkMap: Record<string,Record<string,string>>, active: string|null}} ctx
 * @returns {string}
 */
export function resolveHref({ section, search, hash }, { gateways, linkMap, active }) {
  const cityUrl = active ? linkMap[section]?.[active] : null;
  const base = cityUrl ?? gateways[section];
  return base + search + hash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/city-links-plan.test.mjs`
Expected: PASS — `✓ all 11 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/city-links-plan.js tests/city-links-plan.test.mjs
git commit -m "feat(city): pure gateway-link match + href resolver"
```

---

## Task 2: DOM shell — `city-links.js` + wiring

**Files:**
- Create: `src/city-links.js`
- Modify: `src/index.js` (add import after line 11, `./city-switcher.js`)

- [ ] **Step 1: Write the DOM shell**

Create `src/city-links.js`:

```js
/**
 * City Links
 *
 * Auto-resolves plain in-site gateway links (e.g. /memberships, /studios and
 * their localized variants) to the active city's CMS page. Webflow renders the
 * real, fully-localized URLs into hidden source elements; this module copies
 * the right one onto every matching <a>. Pure match/compose logic lives in
 * city-links-plan.js.
 *
 * Source data (rendered in the global component, every page + locale):
 *   [data-city-gateway="<section>"]                  — anchor; localized gateway path
 *   [data-city-link-list="<section>"]                — Collection List wrapper
 *     [data-city-link-item][data-city-link-key][href] — city slug → localized URL
 *
 * Opt-out: <a data-city-link-skip> is never rewritten (keeps it pointing at the
 * neutral gateway, e.g. a "Browse all cities" link).
 *
 * Same DOM-shell role as city-context.js; pure logic lives in city-links-plan.js.
 */

import { matchSection, resolveHref } from "./city-links-plan.js";

const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** @type {WeakMap<HTMLAnchorElement, {section: string, search: string, hash: string}>} */
const managed = new WeakMap();

// ── Read source data ─────────────────────────────────────────

function readGateways() {
  /** @type {Record<string,string>} */
  const out = {};
  document.querySelectorAll("[data-city-gateway]").forEach((el) => {
    const section = el.getAttribute("data-city-gateway")?.trim();
    const href = el.getAttribute("href");
    if (section && href) out[section] = new URL(href, location.origin).pathname;
  });
  return out;
}

function readLinkMap() {
  /** @type {Record<string,Record<string,string>>} */
  const out = {};
  document.querySelectorAll("[data-city-link-list]").forEach((list) => {
    const section = list.getAttribute("data-city-link-list")?.trim();
    if (!section) return;
    const map = (out[section] ||= {});
    list.querySelectorAll("[data-city-link-item]").forEach((a) => {
      const key = a.getAttribute("data-city-link-key")?.trim();
      const href = a.getAttribute("href");
      if (key && href) map[key] = new URL(href, location.origin).pathname;
    });
  });
  return out;
}

// ── Apply ────────────────────────────────────────────────────

function apply(active) {
  const gateways = readGateways();
  if (Object.keys(gateways).length === 0) return; // sources not rendered yet
  const linkMap = readLinkMap();

  document.querySelectorAll("a[href]").forEach((el) => {
    const a = /** @type {HTMLAnchorElement} */ (el);
    if (a.hasAttribute("data-city-link-skip")) return;
    // Ignore our own source elements (gateway anchors + list items).
    if (a.closest("[data-city-link-list], [data-city-gateway]")) return;

    let entry = managed.get(a);
    if (!entry) {
      let url;
      try {
        url = new URL(a.getAttribute("href"), location.origin);
      } catch {
        return; // non-parseable href (mailto:, tel:, javascript:) — skip
      }
      const section = matchSection(url.pathname, gateways);
      if (!section) return; // not a gateway link
      entry = { section, search: url.search, hash: url.hash };
      managed.set(a, entry);
    }

    a.setAttribute("href", resolveHref(entry, { gateways, linkMap, active }));
  });
}

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  // onChange fires immediately if the chain has already resolved, and on every
  // later switch. Safety passes re-run apply so late-rendered CMS lists settle.
  /** @type {any} */ (window).bruce?.city?.onChange?.(apply);
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(
      () => apply(/** @type {any} */ (window).bruce?.city?.get?.() ?? null),
      ms,
    ),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
```

- [ ] **Step 2: Verify the shell parses (syntax check)**

Run: `node --check src/city-links.js`
Expected: no output, exit 0 (syntax valid; browser globals are not executed by `--check`).

- [ ] **Step 3: Wire into the bundle**

In `src/index.js`, add the import immediately after `import "./city-switcher.js";` (line 11):

```js
import "./city-switcher.js";
import "./city-links.js";
import "./location.js";
```

- [ ] **Step 4: Verify the index parses**

Run: `node --check src/index.js`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/city-links.js src/index.js
git commit -m "feat(city): auto-rewrite gateway links to active city page"
```

---

## Task 3: Remove the legacy `city-path` placeholder (TDD)

The new auto-rewrite replaces the old `/memberships{{city-path}}` mechanism.
Remove only the `city-path` placeholder; `city` and `city-name` stay (still
used for text). Historical specs/plans (`2026-06-02-city-system*`) are
snapshots and are left untouched; only the live editor doc is updated.

**Files:**
- Modify: `src/city-resolve.js` (remove the `city-path` key in `buildPlaceholders`)
- Modify: `tests/city-resolve.test.mjs` (drop `city-path` from 3 expectations + label)
- Modify: `docs/editors/city-system.md` (remove the `{{city-path}}` row + link tip)

- [ ] **Step 1: Update the failing test first**

In `tests/city-resolve.test.mjs`, change the three `buildPlaceholders`
assertions (lines ~69–83) to drop `city-path`:

```js
// ── buildPlaceholders ────────────────────────────────────────
check(
  "active city → city, city-name, vars",
  buildPlaceholders(CITIES[0], ["phone"]),
  { city: "sto", "city-name": "Stockholm", phone: "8-1" },
);
check(
  "neutral → all empty strings (incl. known var keys)",
  buildPlaceholders(null, ["phone"]),
  { city: "", "city-name": "", phone: "" },
);
check(
  "var key missing on active city → empty string",
  buildPlaceholders(CITIES[0], ["phone", "hours"]),
  { city: "sto", "city-name": "Stockholm", phone: "8-1", hours: "" },
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/city-resolve.test.mjs`
Expected: FAIL — actual still contains `"city-path": "/sto"`, so `deepEqual` mismatches.

- [ ] **Step 3: Remove the placeholder from the implementation**

In `src/city-resolve.js`, delete the `city-path` line from the `out` object in
`buildPlaceholders` (currently line 49):

```js
  const out = {
    city: activeCity ? activeCity.slug : "",
    "city-name": activeCity ? activeCity.name : "",
  };
```

(The `"city-path": activeCity ? `/${activeCity.slug}` : "",` line is removed.)

- [ ] **Step 4: Run both city test suites to verify green**

Run: `node tests/city-resolve.test.mjs && node tests/city-links-plan.test.mjs`
Expected: both print `✓ all N assertions passed`.

- [ ] **Step 5: Update the editor doc**

In `docs/editors/city-system.md`, remove the `{{city-path}}` table row
(line ~59) and the two-line "Tip for links" paragraph (lines ~62–63). Replace
the tip with:

```md
Links to a city's Memberships or Studios page resolve automatically — just
link to `/memberships` or `/studios` as normal and the visitor's city is
applied for them. No `{{...}}` needed.
```

- [ ] **Step 6: Commit**

```bash
git add src/city-resolve.js tests/city-resolve.test.mjs docs/editors/city-system.md
git commit -m "refactor(city): drop legacy city-path placeholder

Superseded by the auto gateway-link rewrite (city-links.js)."
```

---

## Task 4: Build & deploy

**Files:**
- Modify: `dist/index.js`, `dist/index.js.map` (Parcel output)

- [ ] **Step 1: Clean build (avoid the stale-cache trap)**

Run: `rm -rf .parcel-cache dist && pnpm build`
Expected: Parcel reports a successful build; `dist/index.js` regenerated.

- [ ] **Step 2: Confirm the new module is in the bundle**

Run: `grep -c "data-city-link-list" dist/index.js`
Expected: `1` or more (the attribute string is present in the minified bundle).

- [ ] **Step 3: Commit the rebuilt bundle**

```bash
git add dist/index.js dist/index.js.map
git commit -m "build(city): bundle city-links module"
```

- [ ] **Step 4: After pushing — purge the CDN edge cache**

The browser cache clear does NOT bypass jsDelivr's edge. Purge `@main` via `purge.jsdelivr.net` for the bundle URL so the live site picks up the new code.

---

## Manual Webflow adoption (not code — do in Designer)

These are required for the feature to take effect on the live site; none are code tasks:

1. **Convert authored gateway links.** Any nav/footer/CTA link currently using the old `/memberships{{city-path}}` text pattern must become a **plain internal link to the Memberships (or Studios) page**. The rewriter only matches the bare gateway path (`/memberships`); a pre-resolved `/memberships/oslo` link will not be touched. This is the migration that fixes the original Swedish→English bug.
2. **Opt out the "switch city / browse all cities" links.** Add `data-city-link-skip` to any link that must keep pointing at the neutral gateway, so users can still reach it on purpose.
3. **Keep a single `data-city-list`.** The registry now lives on the studios link-list element. Ensure no second `[data-city-list]` exists elsewhere, or `readCityList()` will enumerate duplicate cities.

---

## Self-Review

- **Spec coverage:** Webflow contract (verified against live HTML), exact-path matching + query/hash preserve + skip opt-out + source-element exclusion (Task 2 `apply`), pure core split (Task 1), WeakMap re-pointing + safety-pass late-load (Task 2 shell), missing-map/neutral fallback (Task 1 `resolveHref`), unit tests on pure core (Task 1). Redirect + cross-locale explicitly out of scope per spec. ✓
- **Placeholder scan:** none — all code is complete and runnable. ✓
- **Type consistency:** `matchSection(pathname, gateways)` and `resolveHref({section,search,hash},{gateways,linkMap,active})` signatures match between Task 1 definition, the Task 1 tests, and the Task 2 shell call sites. `readGateways`/`readLinkMap` return the exact `gateways`/`linkMap` shapes `resolveHref` consumes. ✓
