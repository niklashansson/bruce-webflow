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
