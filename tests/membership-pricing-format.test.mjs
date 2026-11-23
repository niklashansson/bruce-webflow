// Unit tests for the membership-pricing-format pure helpers.
// Framework-free: run with `node tests/membership-pricing-format.test.mjs`.
// Tests use locale "en-US" for deterministic group separators (sv-SE uses a
// non-breaking space, which is awkward to assert against in source).
import assert from "node:assert/strict";
import { formatPrice, findTier, buildTierView, resolveVariants } from "../src/membership-pricing-format.js";

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
check("rounds half-up to whole by default", formatPrice(611950, { locale: "en-US" }), "6,120");
check("discount amount", formatPrice(40000, { locale: "en-US" }), "400");
check("large value grouped", formatPrice(1571900, { locale: "en-US" }), "15,719");
check("respects fractionDigits", formatPrice(129900, { locale: "en-US", fractionDigits: 2 }), "1,299.00");
check("zero", formatPrice(0, { locale: "en-US" }), "0");

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

// ── period variants (CPH: committed/prepaid are 12 mo, page shows 6 mo) ──
// Shape from /partner/membership/info?city_code=cph&campaign_code=BLACKWEEK26.
const CPH_BASE = {
  tier_code: "BASE",
  prices: {
    flexible: { list_price: 59900, price: 29950, discount: { amount: 29950 } },
    committed: { list_price: 49900, price: 24950, discount: { amount: 24950 } },
    prepaid: { list_price: 479900, price: 479900, discount: null },
    committed_periods: [
      { months: 6, list_price: 54900, price: 27450, discount: { amount: 27450 } },
      { months: 12, list_price: 49900, price: 24950, discount: { amount: 24950 } },
    ],
    prepaid_periods: [
      { months: 12, list_price: 479900, price: 479900, discount: null },
      { months: 6, list_price: 319900, price: 319900, discount: null },
    ],
  },
};
const cph = buildTierView(CPH_BASE, { locale: "en-US", fractionDigits: 2 });
check("committed uses shortest period (6 mo), not 12-mo committed", cph["committed.price"], "274.50");
check("committed list_price from 6-mo period", cph["committed.list_price"], "549.00");
check("committed discount from 6-mo period", cph["committed.discount"], "274.50");
check("prepaid uses shortest period regardless of array order", cph["prepaid.price"], "3,199.00");
check("flexible unaffected", cph["flexible.price"], "299.50");
check("no slots emitted for *_periods keys", Object.keys(cph).some((k) => k.includes("_periods")), false);

const cph12 = buildTierView(CPH_BASE, { locale: "en-US", months: 12 });
check("explicit months=12 picks the 12-mo period", cph12["committed.price"], "250");
check("explicit months=12 prepaid", cph12["prepaid.price"], "4,799");

const cphMissing = buildTierView(CPH_BASE, { locale: "en-US", months: 3 });
check("unknown months falls back to shortest period", cphMissing["committed.price"], "275");

check("resolveVariants exposes the effective discount", resolveVariants(CPH_BASE.prices).prepaid.discount, null);
check("resolveVariants without periods keeps base variant", resolveVariants(findTier(PAYLOAD, "EPIC").prices).committed.price, 109900);
check("resolveVariants null → {}", resolveVariants(null), {});

console.log(`✓ all ${passed} assertions passed`);
