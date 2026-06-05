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
