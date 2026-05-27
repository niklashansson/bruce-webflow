// Unit tests for the city-visibility pure decision helper.
// Framework-free: run with `node tests/city-visibility-decide.test.mjs`.
// The helper has no DOM/global deps, so importing it in Node is safe.

import assert from "node:assert/strict";
import { shouldShow } from "../src/city-visibility-decide.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

const CITIES = [
  { slug: "sto", name: "Stockholm" },
  { slug: "cph", name: "Copenhagen" },
  { slug: "osl", name: "Oslo" },
];

// ── empty / missing attribute → always visible ───────────────
check(
  "null attribute → visible",
  shouldShow(null, "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "empty attribute → visible",
  shouldShow("", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "whitespace-only attribute → visible",
  shouldShow("   ", "sto", CITIES),
  { visible: true, unknownValues: [] },
);

// ── pre-boot (no active slug) hides non-empty attributes ─────
check(
  "null activeSlug, non-empty attr → hidden",
  shouldShow("sto", null, CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "null activeSlug, empty attr → visible",
  shouldShow("", null, CITIES),
  { visible: true, unknownValues: [] },
);

// ── single value: slug match ─────────────────────────────────
check(
  "single slug match",
  shouldShow("sto", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single slug mismatch",
  shouldShow("cph", "sto", CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "single slug match, mixed case attr",
  shouldShow("STO", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single slug match, mixed case slug",
  shouldShow("sto", "STO", CITIES),
  { visible: true, unknownValues: [] },
);

// ── single value: name match ─────────────────────────────────
check(
  "single name match (exact case)",
  shouldShow("Stockholm", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single name match (lower case)",
  shouldShow("stockholm", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "single name mismatch",
  shouldShow("Copenhagen", "sto", CITIES),
  { visible: false, unknownValues: [] },
);

// ── multi-value lists ────────────────────────────────────────
check(
  "comma list, one slug matches",
  shouldShow("cph, sto", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "comma list, no match",
  shouldShow("cph, osl", "sto", CITIES),
  { visible: false, unknownValues: [] },
);
check(
  "comma list, extra whitespace tolerated",
  shouldShow("  cph ,   sto  ", "cph", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "comma list, mix of slug + name",
  shouldShow("Copenhagen, osl", "osl", CITIES),
  { visible: true, unknownValues: [] },
);

// ── unknown tokens reported ──────────────────────────────────
check(
  "unknown single value → hidden + reported",
  shouldShow("malmo", "sto", CITIES),
  { visible: false, unknownValues: ["malmo"] },
);
check(
  "unknown + known, known matches → visible, unknown still reported",
  shouldShow("malmo, sto", "sto", CITIES),
  { visible: true, unknownValues: ["malmo"] },
);
check(
  "unknown + known, neither matches → hidden + reported",
  shouldShow("malmo, cph", "sto", CITIES),
  { visible: false, unknownValues: ["malmo"] },
);
check(
  "multiple unknown values reported",
  shouldShow("malmo, gothenburg", "sto", CITIES),
  { visible: false, unknownValues: ["malmo", "gothenburg"] },
);

// ── edge cases ───────────────────────────────────────────────
check(
  "comma-only attribute → visible (no real tokens)",
  shouldShow(", ,", "sto", CITIES),
  { visible: true, unknownValues: [] },
);
check(
  "empty cities array, non-empty attribute → hidden, value reported",
  shouldShow("sto", "sto", []),
  { visible: false, unknownValues: ["sto"] },
);

console.log(`✓ all ${passed} assertions passed`);
