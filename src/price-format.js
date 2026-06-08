/**
 * Price Format
 *
 * Formats a plain number authored in Webflow into a locale-grouped string, in
 * place. Drop `data-price-format` on any element holding a raw number and it is
 * rewritten on the client (129000 → "129 000"). Number only — no currency
 * symbol; the Webflow markup supplies the unit text (same convention as
 * formatPrice in membership-pricing-format.js).
 *
 * Distinct from membership-pricing.js, which fetches campaign pricing from the
 * Bruce API and works in minor units (öre). This module only formats numbers
 * already present in the DOM.
 *
 * Markup contract:
 *   <span data-price-format>129000</span>                            → 129 000
 *   <span data-price-format>129.95</span>                            → 129,95
 *   <span data-price-format data-price-locale="en-US">129000</span>  → 129,000
 *   <span data-price-format data-price-decimals="2">129000</span>    → 129 000,00
 *
 *   - data-price-format    — marks the element (required)
 *   - data-price-locale    — optional, default "sv-SE"
 *   - data-price-decimals  — optional; when omitted, preserve the decimals present
 *                            in the raw value (129.95 → 2, 129000 → 0)
 *
 * The authored raw value is a plain number using "." as the decimal separator and
 * no grouping; surrounding whitespace is tolerated.
 */

const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** @type {WeakSet<Element>} elements already formatted (or non-numeric, skipped) */
const applied = new WeakSet();

/**
 * Parse a raw numeric string and format it for display. Returns null when the
 * input is empty or not a finite number, so callers can leave the DOM untouched.
 *
 * @param {string} raw
 * @param {{locale?: string, decimals?: number|null}} [opts]
 * @returns {string|null}
 */
export function formatPriceValue(raw, { locale = "sv-SE", decimals = null } = {}) {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;

  // Explicit decimals win; otherwise preserve whatever the raw value carries.
  const rawDecimals = trimmed.split(".")[1]?.length ?? 0;
  const digits =
    Number.isFinite(decimals) && decimals >= 0 ? decimals : rawDecimals;

  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function applyElement(el) {
  if (applied.has(el)) return;
  applied.add(el); // claim once: skip on every later pass, formatted or not

  const locale = el.getAttribute("data-price-locale")?.trim() || "sv-SE";
  const decAttr = el.getAttribute("data-price-decimals");
  const decimals =
    decAttr != null && decAttr.trim() !== "" ? Number(decAttr) : null;

  const formatted = formatPriceValue(el.textContent, { locale, decimals });
  if (formatted != null) el.textContent = formatted;
}

function run() {
  document
    .querySelectorAll("[data-price-format]")
    .forEach((el) => applyElement(el));
}

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  run();
  // Safety passes re-scan for late-rendered CMS items; applied elements are no-ops.
  SAFETY_PASS_DELAYS.forEach((ms) => setTimeout(run, ms));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
