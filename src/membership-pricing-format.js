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
