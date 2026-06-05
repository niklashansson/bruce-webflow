/**
 * Membership Pricing
 *
 * Fetches campaign-specific discount pricing on the client and writes it into
 * pricing cards. Each card carries a config element (the inner div of
 * .card_plan_data) with its city, campaign, tier, and formatting attributes;
 * the price text lives in [data-price-slot] elements elsewhere inside the same
 * .card_plan_wrap. Cards sharing the same city+campaign reuse a single deduped
 * request. When the codes are absent or the request fails, the Webflow-rendered
 * defaults are left untouched.
 *
 * Pure formatting + response-shaping logic lives in membership-pricing-format.js
 * (same DOM-shell ↔ pure-logic split as city-context.js ↔ city-resolve.js).
 *
 * Markup contract:
 *   .card_plan_wrap                                  — card root (CARD_ROOT_SELECTOR)
 *     …[data-price-slot="committed.price"]           — price text, filled by "{variant}.{field}"
 *     .card_plan_data > [data-pricing-tier]          — config element:
 *       data-pricing-city="CPH"        — required; lowercased into the request
 *       data-pricing-campaign="VENTURE26" — required; no fetch when empty
 *       data-pricing-tier="BLACK"      — required; selects tier_code from response
 *       data-pricing-locale="en"       — optional, default "sv-SE"
 *       data-pricing-fraction-digits="0" — optional, default 0
 *       data-pricing-endpoint="https://…" — optional endpoint override
 *
 * When a card's variant has a discount, `is-discounted` is toggled on the card
 * root so the (static) .card_plan_price_original strike-through price is revealed.
 */

import { buildTierView, findTier } from "./membership-pricing-format.js";

const DEFAULT_ENDPOINT = "https://api.bruce.app/partner/membership/info";
const SAFETY_PASS_DELAYS = [500, 1500, 3500];
const CARD_ROOT_SELECTOR = ".card_plan_wrap";
const DISCOUNTED_CLASS = "is-discounted";

/** @type {WeakSet<Element>} config elements already applied (or in-flight) */
const applied = new WeakSet();
/** @type {Map<string, Promise<any>>} deduped fetches keyed "endpoint|city|campaign" */
const fetchCache = new Map();

function endpointFor(config) {
  return (
    config.getAttribute("data-pricing-endpoint")?.trim() ||
    /** @type {any} */ (window).bruce?.pricingEndpoint ||
    DEFAULT_ENDPOINT
  );
}

// The price slots live outside the config element, elsewhere inside the card.
// Prefer the known wrapper; fall back to the nearest ancestor that holds slots.
function cardRootFor(config) {
  const known = config.closest(CARD_ROOT_SELECTOR);
  if (known) return known;
  let el = config.parentElement;
  while (el) {
    if (el.querySelector("[data-price-slot]")) return el;
    el = el.parentElement;
  }
  return null;
}

function fetchPricing(endpoint, city, campaign) {
  const key = `${endpoint}|${city}|${campaign}`;
  let promise = fetchCache.get(key);
  if (!promise) {
    const url = new URL(endpoint);
    url.searchParams.set("city_code", city);
    url.searchParams.set("campaign_code", campaign);
    promise = fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        fetchCache.delete(key); // evict so a later safety pass can retry
        throw err;
      });
    fetchCache.set(key, promise);
  }
  return promise;
}

function applyCard(config, payload) {
  const tierCode = config.getAttribute("data-pricing-tier")?.trim();
  const tier = findTier(payload, tierCode);
  if (!tier) {
    console.warn(`[bruce.pricing] tier "${tierCode}" not in response`);
    return;
  }

  const root = cardRootFor(config);
  if (!root) {
    console.warn(`[bruce.pricing] no card root for tier "${tierCode}"`);
    return;
  }

  const locale = config.getAttribute("data-pricing-locale")?.trim() || "sv-SE";
  const fdAttr = config.getAttribute("data-pricing-fraction-digits");
  const fractionDigits =
    fdAttr != null && fdAttr.trim() !== "" ? Number(fdAttr) : 0;

  const slots = buildTierView(tier, { locale, fractionDigits });

  // Fill each price slot; flag the card as discounted if any variant it renders
  // carries a discount (reveals the strike-through original price via CSS).
  let discounted = false;
  root.querySelectorAll("[data-price-slot]").forEach((el) => {
    const slotKey = el.getAttribute("data-price-slot")?.trim();
    if (!slotKey) return;
    if (slotKey in slots) el.textContent = slots[slotKey];
    const variant = slotKey.split(".")[0];
    if (tier.prices?.[variant]?.discount != null) discounted = true;
  });

  root.classList.toggle(DISCOUNTED_CLASS, discounted);
}

function processCard(config) {
  if (applied.has(config)) return;
  // Lowercase city once at read time so the dedup key and the request param are
  // always derived from the same normalized value (CPH and cph share one fetch).
  const city = config.getAttribute("data-pricing-city")?.trim().toLowerCase();
  const campaign = config.getAttribute("data-pricing-campaign")?.trim();
  if (!city || !campaign) return; // gate: only fetch when both are populated

  applied.add(config); // claim before async so safety passes don't double-fetch
  fetchPricing(endpointFor(config), city, campaign)
    .then((payload) => applyCard(config, payload))
    .catch((err) => {
      applied.delete(config); // released for retry by a later safety pass (no-op after the last)
      console.warn("[bruce.pricing] fetch failed", err);
    });
}

function run() {
  document
    .querySelectorAll("[data-pricing-tier][data-pricing-city]")
    .forEach((el) => processCard(el));
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
