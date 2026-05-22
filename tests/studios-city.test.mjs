// Unit tests for the studios city-picker pure helpers.
// Framework-free: run with `node tests/studios-city.test.mjs`.
// The helper module has no DOM/global deps, so importing it in Node is safe.

import assert from "node:assert/strict";
import {
  nearestCitySlug,
  resolveInitialCitySelection,
  planCityFilterClicks,
} from "../src/studios-city-select.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── nearestCitySlug ──────────────────────────────────────────
const CITIES = [
  { slug: "sto", coords: [18.07, 59.33] }, // Stockholm
  { slug: "cph", coords: [12.57, 55.68] }, // Copenhagen
  { slug: "osl", coords: [10.75, 59.91] }, // Oslo
];

check("nearest: null coords", nearestCitySlug(null, CITIES), null);
check("nearest: no city has coords", nearestCitySlug([18, 59], [{ slug: "x", coords: null }]), null);
check("nearest: near Stockholm", nearestCitySlug([18.0, 59.0], CITIES), "sto");
check("nearest: near Copenhagen", nearestCitySlug([12.6, 55.7], CITIES), "cph");
check("nearest: near Oslo", nearestCitySlug([10.8, 59.9], CITIES), "osl");

// ── resolveInitialCitySelection (strong-signal rule) ─────────
check(
  "initial: url wins over geo",
  resolveInitialCitySelection({ urlCitySlug: "cph", geoNearestSlug: "sto" }),
  "cph",
);
check(
  "initial: geo when no url",
  resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: "sto" }),
  "sto",
);
check(
  "initial: all when no signal",
  resolveInitialCitySelection({ urlCitySlug: null, geoNearestSlug: null }),
  "all",
);

// ── planCityFilterClicks ─────────────────────────────────────
// Single-select hidden group. Works in fs-list-value (city name) terms.
check("plan: no-op both null", planCityFilterClicks({ targetValue: null, currentValue: null }), []);
check("plan: no-op same value", planCityFilterClicks({ targetValue: "Stockholm", currentValue: "Stockholm" }), []);
check("plan: engage from none", planCityFilterClicks({ targetValue: "Stockholm", currentValue: null }), ["Stockholm"]);
check("plan: clear to all", planCityFilterClicks({ targetValue: null, currentValue: "Stockholm" }), ["Stockholm"]);
check(
  "plan: switch cities (uncheck old, check new)",
  planCityFilterClicks({ targetValue: "Copenhagen", currentValue: "Stockholm" }),
  ["Stockholm", "Copenhagen"],
);

console.log(`✓ all ${passed} assertions passed`);
