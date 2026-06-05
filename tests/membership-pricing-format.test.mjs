// Unit tests for the membership-pricing-format pure helpers.
// Framework-free: run with `node tests/membership-pricing-format.test.mjs`.
// Tests use locale "en-US" for deterministic group separators (sv-SE uses a
// non-breaking space, which is awkward to assert against in source).
import assert from "node:assert/strict";
import { formatPrice, findTier, buildTierView } from "../src/membership-pricing-format.js";

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

console.log(`✓ all ${passed} assertions passed`);
