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
 * Pick the period entry the page shows from a `*_periods` array: the one with
 * `months` when given and present, otherwise the shortest period.
 *
 * @param {Array<{months: number}>|undefined} periods
 * @param {number|undefined} months
 * @returns {any|null}
 */
function pickPeriod(periods, months) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  if (Number.isFinite(months)) {
    const exact = periods.find((p) => p?.months === months);
    if (exact) return exact;
  }
  return periods.reduce((min, p) =>
    typeof p?.months === "number" && p.months < min.months ? p : min,
  );
}

/**
 * Resolve the price object each variant slot should show. The API's top-level
 * `committed` / `prepaid` are always the 12-month prices; markets that also sell
 * shorter periods (CPH: 6 months) only expose those in `committed_periods` /
 * `prepaid_periods`. The Webflow cards show the shortest period, so by default
 * `committed` / `prepaid` resolve to the shortest entry of their `*_periods`
 * array (or to `months` when given). Variants without a periods array are passed
 * through; the `*_periods` arrays themselves are not variants.
 *
 * @param {Record<string, any>|null|undefined} prices
 * @param {{months?: number}} [opts]
 * @returns {Record<string, {list_price?: number, price?: number, discount?: {amount?: number}|null}>}
 */
export function resolveVariants(prices, { months } = {}) {
  /** @type {Record<string, any>} */
  const out = {};
  if (!prices) return out;
  for (const key of Object.keys(prices)) {
    if (key.endsWith("_periods")) continue;
    out[key] = pickPeriod(prices[`${key}_periods`], months) ?? prices[key];
  }
  return out;
}

/**
 * Shape a tier's prices into a flat slot map keyed "{variant}.{field}". Only
 * fills slots whose source values are present (numeric). The `discount` slot maps
 * to discount.amount and is omitted when the variant has no discount (discount
 * visibility is handled in Webflow). Period selection: see resolveVariants.
 *
 * @param {{prices?: Record<string, any>}|null|undefined} tier
 * @param {{locale?: string, fractionDigits?: number, months?: number}} [opts]
 * @returns {Record<string,string>}
 */
export function buildTierView(tier, opts = {}) {
  /** @type {Record<string,string>} */
  const slots = {};
  const variants = resolveVariants(tier?.prices, opts);

  for (const variant of Object.keys(variants)) {
    const p = variants[variant];
    if (!p) continue;
    if (typeof p.price === "number") slots[`${variant}.price`] = formatPrice(p.price, opts);
    if (typeof p.list_price === "number") slots[`${variant}.list_price`] = formatPrice(p.list_price, opts);
    if (p.discount != null && typeof p.discount.amount === "number") {
      slots[`${variant}.discount`] = formatPrice(p.discount.amount, opts);
    }
  }
  return slots;
}
