// Unit tests for the city-registry pure parser.
// Framework-free: run with `node tests/city-registry.test.mjs`.
import assert from "node:assert/strict";
import { cityFromAttrs } from "../src/city-registry.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

check(
  "full item → slug, name, vars, coords",
  cityFromAttrs({
    "data-city-slug": "sto",
    "data-city-name": "Stockholm",
    "data-city-var-phone": "+46 8 123",
    "data-city-var-lat": "59.33",
    "data-city-var-lng": "18.07",
  }),
  {
    slug: "sto",
    name: "Stockholm",
    vars: { phone: "+46 8 123", lat: "59.33", lng: "18.07" },
    coords: [18.07, 59.33],
  },
);

check(
  "missing slug → null",
  cityFromAttrs({ "data-city-name": "Nowhere" }),
  null,
);

check(
  "blank slug → null",
  cityFromAttrs({ "data-city-slug": "   ", "data-city-name": "X" }),
  null,
);

check(
  "missing name → empty string name",
  cityFromAttrs({ "data-city-slug": "cph" }),
  { slug: "cph", name: "", vars: {}, coords: null },
);

check(
  "invalid lat/lng → coords null",
  cityFromAttrs({
    "data-city-slug": "osl",
    "data-city-name": "Oslo",
    "data-city-var-lat": "abc",
    "data-city-var-lng": "10.7",
  }),
  { slug: "osl", name: "Oslo", vars: { lat: "abc", lng: "10.7" }, coords: null },
);

check(
  "slug/name trimmed",
  cityFromAttrs({ "data-city-slug": "  sto  ", "data-city-name": "  Stockholm  " }),
  { slug: "sto", name: "Stockholm", vars: {}, coords: null },
);

console.log(`✓ all ${passed} assertions passed`);
