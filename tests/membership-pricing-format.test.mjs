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
