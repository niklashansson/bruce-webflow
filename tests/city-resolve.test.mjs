// Unit tests for the city-resolve pure helpers.
// Framework-free: run with `node tests/city-resolve.test.mjs`.
import assert from "node:assert/strict";
import { resolveActiveCity, buildPlaceholders } from "../src/city-resolve.js";

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
  { slug: "sto", name: "Stockholm", vars: { phone: "8-1" }, coords: null },
  { slug: "cph", name: "Copenhagen", vars: { phone: "45-2" }, coords: null },
];

// ── resolveActiveCity ────────────────────────────────────────
check(
  "lock wins over saved; seeds nothing when saved exists",
  resolveActiveCity({ lock: "sto", param: null, saved: "cph" }, CITIES),
  { active: "sto", seedPreference: null },
);
check(
  "lock with no saved pref → seeds the lock",
  resolveActiveCity({ lock: "sto", param: null, saved: null }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "lock with stale (invalid) saved pref → seeds the lock",
  resolveActiveCity({ lock: "sto", param: null, saved: "gone" }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "param overrides saved on non-locked page; never seeds",
  resolveActiveCity({ lock: null, param: "cph", saved: "sto" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "lock + param both present → lock wins",
  resolveActiveCity({ lock: "sto", param: "cph", saved: null }, CITIES),
  { active: "sto", seedPreference: "sto" },
);
check(
  "saved preference used when no lock/param",
  resolveActiveCity({ lock: null, param: null, saved: "cph" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "invalid lock falls through to saved",
  resolveActiveCity({ lock: "gone", param: null, saved: "cph" }, CITIES),
  { active: "cph", seedPreference: null },
);
check(
  "nothing valid → neutral",
  resolveActiveCity({ lock: null, param: null, saved: "gone" }, CITIES),
  { active: null, seedPreference: null },
);
check(
  "all empty → neutral",
  resolveActiveCity({ lock: null, param: null, saved: null }, CITIES),
  { active: null, seedPreference: null },
);

// ── buildPlaceholders ────────────────────────────────────────
check(
  "active city → city, city-name, vars",
  buildPlaceholders(CITIES[0], ["phone"]),
  { city: "sto", "city-name": "Stockholm", phone: "8-1" },
);
check(
  "neutral → all empty strings (incl. known var keys)",
  buildPlaceholders(null, ["phone"]),
  { city: "", "city-name": "", phone: "" },
);
check(
  "var key missing on active city → empty string",
  buildPlaceholders(CITIES[0], ["phone", "hours"]),
  { city: "sto", "city-name": "Stockholm", phone: "8-1", hours: "" },
);

console.log(`✓ all ${passed} assertions passed`);
