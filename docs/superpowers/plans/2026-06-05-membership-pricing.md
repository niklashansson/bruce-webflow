# Membership Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch campaign-specific membership discount pricing on the client (per city + campaign code) and write it into self-contained Webflow pricing cards, leaving defaults untouched when codes are absent or the request fails.

**Architecture:** Two files following the codebase's DOM-shell + pure-logic split (like `city-context.js` ↔ `city-resolve.js`). `membership-pricing-format.js` is framework-free (formatting + response shaping, unit-tested in Node). `membership-pricing.js` is the DOM/fetch/boot shell (scans `[data-pricing-card]`, deduped fetch keyed on city+campaign, fills `data-price-slot` text elements). Discount visibility is handled in Webflow — the module toggles no classes. Registered in `src/index.js`.

**Tech Stack:** Vanilla ES modules, Parcel bundler, `Intl`/`toLocaleString` for formatting, framework-free `node:assert` tests (`*.test.mjs`).

---

## File Structure

- **Create** `src/membership-pricing-format.js` — pure: `formatPrice`, `findTier`, `buildTierView`. No DOM, no imports.
- **Create** `tests/membership-pricing-format.test.mjs` — unit tests for the pure helpers.
- **Create** `src/membership-pricing.js` — DOM shell: scan cards, gate, deduped fetch, apply, boot + safety passes.
- **Modify** `src/index.js` — add `import "./membership-pricing.js";`.

---

## Task 1: Pure helper — `formatPrice`

**Files:**
- Create: `src/membership-pricing-format.js`
- Test: `tests/membership-pricing-format.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/membership-pricing-format.test.mjs`:

```js
// Unit tests for the membership-pricing-format pure helpers.
// Framework-free: run with `node tests/membership-pricing-format.test.mjs`.
// Tests use locale "en-US" for deterministic group separators (sv-SE uses a
// non-breaking space, which is awkward to assert against in source).
import assert from "node:assert/strict";
import { formatPrice } from "../src/membership-pricing-format.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── formatPrice ──────────────────────────────────────────────
check("divides minor units by 100, no decimals", formatPrice(129900, { locale: "en-US" }), "1,299");
check("rounds to whole by default", formatPrice(611900, { locale: "en-US" }), "6,119");
check("discount amount", formatPrice(40000, { locale: "en-US" }), "400");
check("large value grouped", formatPrice(1571900, { locale: "en-US" }), "15,719");
check("respects fractionDigits", formatPrice(129900, { locale: "en-US", fractionDigits: 2 }), "1,299.00");
check("zero", formatPrice(0, { locale: "en-US" }), "0");

console.log(`✓ all ${passed} assertions passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/membership-pricing-format.test.mjs`
Expected: FAIL — `Cannot find module '../src/membership-pricing-format.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/membership-pricing-format.js`:

```js
/**
 * Membership Pricing Format — pure helpers for membership-pricing.js
 *
 * Framework-free (no DOM, no imports) so the formatting + response-shaping logic
 * is unit-testable in Node. The DOM/fetch/boot shell lives in
 * membership-pricing.js. (Same split as city-resolve.js ↔ city-context.js.)
 */

/**
 * Format an integer price in minor units (öre) for display: divide by 100 and
 * group per locale. Number only — no currency symbol (Webflow markup supplies
 * the unit text).
 *
 * @param {number} minorUnits
 * @param {{locale?: string, fractionDigits?: number}} [opts]
 * @returns {string}
 */
export function formatPrice(minorUnits, { locale = "sv-SE", fractionDigits = 0 } = {}) {
  const digits = Number.isFinite(fractionDigits) ? fractionDigits : 0;
  return (minorUnits / 100).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/membership-pricing-format.test.mjs`
Expected: PASS — `✓ all 6 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/membership-pricing-format.js tests/membership-pricing-format.test.mjs
git commit -m "feat(pricing): formatPrice helper"
```

---

## Task 2: Pure helpers — `findTier` and `buildTierView`

**Files:**
- Modify: `src/membership-pricing-format.js`
- Test: `tests/membership-pricing-format.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `tests/membership-pricing-format.test.mjs`, BEFORE the final
`console.log(...)` line. First update the import line at the top of the file from:

```js
import { formatPrice } from "../src/membership-pricing-format.js";
```

to:

```js
import { formatPrice, findTier, buildTierView } from "../src/membership-pricing-format.js";
```

Then add this block before the final `console.log`:

```js
// ── fixtures ─────────────────────────────────────────────────
const PAYLOAD = {
  city_code: "STO",
  campaign_code: "VENTURE26",
  tiers: [
    {
      tier_code: "EPIC",
      prices: {
        flexible: { list_price: 169900, price: 129900, discount: { amount: 40000 } },
        committed: { list_price: 149900, price: 109900, discount: { amount: 40000 } },
        prepaid: { list_price: 1571900, price: 1571900, discount: null },
      },
    },
    {
      tier_code: "BASE",
      prices: {
        flexible: { list_price: 69900, price: 69900, discount: null },
      },
    },
  ],
};

// ── findTier ─────────────────────────────────────────────────
check("findTier matches tier_code", findTier(PAYLOAD, "BASE").tier_code, "BASE");
check("findTier missing → null", findTier(PAYLOAD, "BLACK"), null);
check("findTier null payload → null", findTier(null, "EPIC"), null);
check("findTier payload without tiers → null", findTier({}, "EPIC"), null);

// ── buildTierView (returns a flat slot map) ──────────────────
const epic = buildTierView(findTier(PAYLOAD, "EPIC"), { locale: "en-US" });
check("price slot filled", epic["committed.price"], "1,099");
check("list_price slot filled", epic["committed.list_price"], "1,499");
check("discount slot filled when present", epic["flexible.discount"], "400");
check("no discount slot when discount null", "prepaid.discount" in epic, false);
check("prepaid price still filled", epic["prepaid.price"], "15,719");

const empty = buildTierView(null, { locale: "en-US" });
check("null tier → empty slot map", empty, {});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/membership-pricing-format.test.mjs`
Expected: FAIL — `findTier`/`buildTierView` are not exported (`TypeError: findTier is not a function` or import error).

- [ ] **Step 3: Write minimal implementation**

Append to `src/membership-pricing-format.js`:

```js
/**
 * Find a tier object by its tier_code in an API payload.
 *
 * @param {{tiers?: Array<{tier_code: string}>}|null|undefined} payload
 * @param {string} tierCode
 * @returns {any|null}
 */
export function findTier(payload, tierCode) {
  return payload?.tiers?.find((t) => t.tier_code === tierCode) ?? null;
}

/**
 * Shape a tier's prices into a flat slot map keyed "{variant}.{field}". Only
 * fills slots whose source values are present (numeric). The `discount` slot maps
 * to discount.amount and is omitted when the variant has no discount (discount
 * visibility is handled in Webflow).
 *
 * @param {{prices?: Record<string, {list_price?: number, price?: number, discount?: {amount?: number}|null}>}|null|undefined} tier
 * @param {{locale?: string, fractionDigits?: number}} [opts]
 * @returns {Record<string,string>}
 */
export function buildTierView(tier, opts = {}) {
  /** @type {Record<string,string>} */
  const slots = {};
  const prices = tier?.prices;
  if (!prices) return slots;

  for (const variant of Object.keys(prices)) {
    const p = prices[variant];
    if (!p) continue;
    if (typeof p.price === "number") slots[`${variant}.price`] = formatPrice(p.price, opts);
    if (typeof p.list_price === "number") slots[`${variant}.list_price`] = formatPrice(p.list_price, opts);
    if (p.discount != null && typeof p.discount.amount === "number") {
      slots[`${variant}.discount`] = formatPrice(p.discount.amount, opts);
    }
  }
  return slots;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/membership-pricing-format.test.mjs`
Expected: PASS — `✓ all 16 assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add src/membership-pricing-format.js tests/membership-pricing-format.test.mjs
git commit -m "feat(pricing): findTier + buildTierView helpers"
```

---

## Task 3: DOM shell — `membership-pricing.js`

**Files:**
- Create: `src/membership-pricing.js`

No unit test: this is the DOM/fetch/boot shell, untestable without a DOM, exactly like `city-links.js` (which also has no test). Verified by build + manual check.

- [ ] **Step 1: Write the implementation**

Create `src/membership-pricing.js`:

```js
/**
 * Membership Pricing
 *
 * Fetches campaign-specific discount pricing on the client and writes it into
 * self-contained pricing cards. A card opts in with [data-pricing-card] and
 * carries its own city, campaign, tier, and formatting attributes. Cards sharing
 * the same city+campaign reuse a single deduped request. When the codes are
 * absent or the request fails, the Webflow-rendered defaults are left untouched.
 *
 * Pure formatting + response-shaping logic lives in membership-pricing-format.js
 * (same DOM-shell ↔ pure-logic split as city-context.js ↔ city-resolve.js).
 *
 * Card attributes:
 *   [data-pricing-card]                 — marks + activates a card
 *     data-pricing-city="STO"           — required; lowercased into the request
 *     data-pricing-campaign="VENTURE26" — required
 *     data-pricing-tier="EPIC"          — required; selects tier_code from response
 *     data-pricing-locale="sv-SE"       — optional, default "sv-SE"
 *     data-pricing-fraction-digits="0"  — optional, default 0
 *     data-pricing-endpoint="https://…" — optional endpoint override
 *     [data-price-slot="committed.price"]     — text element, filled by "{variant}.{field}" key
 *
 * Discount visibility (hiding list_price/discount when there is no saving) is
 * handled in Webflow conditionally; this module only fills text slots.
 */

import { buildTierView, findTier } from "./membership-pricing-format.js";

const DEFAULT_ENDPOINT = "https://api.bruce.app/partner/membership/info";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** @type {WeakSet<Element>} cards already applied (or in-flight) */
const applied = new WeakSet();
/** @type {Map<string, Promise<any>>} deduped fetches keyed "endpoint|city|campaign" */
const fetchCache = new Map();

function endpointFor(card) {
  return (
    card.getAttribute("data-pricing-endpoint")?.trim() ||
    /** @type {any} */ (window).bruce?.pricingEndpoint ||
    DEFAULT_ENDPOINT
  );
}

function fetchPricing(endpoint, city, campaign) {
  const key = `${endpoint}|${city}|${campaign}`;
  let promise = fetchCache.get(key);
  if (!promise) {
    const url = new URL(endpoint);
    url.searchParams.set("city_code", city.toLowerCase());
    url.searchParams.set("campaign_code", campaign);
    promise = fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        fetchCache.delete(key); // let a later safety pass retry
        throw err;
      });
    fetchCache.set(key, promise);
  }
  return promise;
}

function applyCard(card, payload) {
  const tierCode = card.getAttribute("data-pricing-tier")?.trim();
  const tier = findTier(payload, tierCode);
  if (!tier) {
    console.warn(`[bruce.pricing] tier "${tierCode}" not in response`);
    return;
  }

  const locale = card.getAttribute("data-pricing-locale")?.trim() || "sv-SE";
  const fdAttr = card.getAttribute("data-pricing-fraction-digits");
  const fractionDigits =
    fdAttr != null && fdAttr.trim() !== "" ? Number(fdAttr) : 0;

  const slots = buildTierView(tier, { locale, fractionDigits });

  card.querySelectorAll("[data-price-slot]").forEach((el) => {
    const slotKey = el.getAttribute("data-price-slot")?.trim();
    if (slotKey && slotKey in slots) el.textContent = slots[slotKey];
  });
}

function processCard(card) {
  if (applied.has(card)) return;
  const city = card.getAttribute("data-pricing-city")?.trim();
  const campaign = card.getAttribute("data-pricing-campaign")?.trim();
  if (!city || !campaign) return; // gate: only fetch when both are populated

  applied.add(card); // claim before async so safety passes don't double-fetch
  fetchPricing(endpointFor(card), city, campaign)
    .then((payload) => applyCard(card, payload))
    .catch((err) => {
      applied.delete(card); // failed — let a later safety pass retry
      console.warn("[bruce.pricing] fetch failed", err);
    });
}

function run() {
  document.querySelectorAll("[data-pricing-card]").forEach((el) => processCard(el));
}

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  run();
  // Safety passes re-scan for late-rendered CMS cards; applied cards are no-ops.
  SAFETY_PASS_DELAYS.forEach((ms) => setTimeout(run, ms));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
```

- [ ] **Step 2: Verify it parses (syntax check)**

Run: `node --check src/membership-pricing.js`
Expected: no output, exit 0 (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add src/membership-pricing.js
git commit -m "feat(pricing): membership-pricing DOM shell"
```

---

## Task 4: Register module + verify build

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add the import**

In `src/index.js`, add this line after the existing imports (alongside the other
component imports, e.g. after `import "./tab.js";`):

```js
import "./membership-pricing.js";
```

- [ ] **Step 2: Run the full test suite**

Run: `node tests/membership-pricing-format.test.mjs`
Expected: PASS — `✓ all 16 assertions passed`.

- [ ] **Step 3: Build to verify bundling**

Run: `rm -rf .parcel-cache dist && pnpm build`
Expected: build succeeds with no errors; `dist/` is regenerated.

(Per project memory: always clear `.parcel-cache` and `dist` before a release
build; do NOT commit `dist` here — that is a separate deploy step the user runs.)

- [ ] **Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat(pricing): register membership-pricing module"
```

---

## Self-Review

**Spec coverage:**
- Data source / endpoint + lowercased `city_code` → Task 3 `fetchPricing`. ✓
- "Only if populated" gate → Task 3 `processCard`. ✓
- Self-contained cards, each with own attributes → Task 3 attribute reads. ✓
- Deduped fetch by city+campaign → Task 3 `fetchCache`. ✓
- Dotted `data-price-slot` keys, fill by lookup regardless of nesting → Task 2 `buildTierView` + Task 3 `applyCard`. ✓
- Discount visibility owned by Webflow; module toggles no classes → Task 3 `applyCard` (slot fill only). ✓
- Number-only formatting, ÷100, locale grouping, fraction-digits default 0 → Task 1 `formatPrice`. ✓
- Silent keep-defaults on missing tier / network / parse error → Task 3 warns + returns. ✓
- Idempotent via WeakSet, boot + safety passes → Task 3. ✓
- Endpoint override via attribute / `window.bruce.pricingEndpoint` → Task 3 `endpointFor`. ✓
- Pure-logic + DOM-shell split, registered in index.js → Tasks 1–4. ✓

**Placeholder scan:** none — all code blocks are complete.

**Type consistency:** `formatPrice(minorUnits, opts)`, `findTier(payload, tierCode)`,
`buildTierView(tier, opts) → Record<string,string>` used identically across Task 2
tests, Task 2 impl, and Task 3 shell. No class-toggling code remains. ✓
