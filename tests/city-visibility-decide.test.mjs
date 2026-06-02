// Unit tests for the city-visibility pure decision helper.
// Framework-free: run with `node tests/city-visibility-decide.test.mjs`.
import assert from "node:assert/strict";
import { decideVisibility } from "../src/city-visibility-decide.js";

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
const A = (over) => Object.assign({ show: null, hide: null, none: false, any: false }, over);

// ── no constraints → visible ─────────────────────────────────
check("no attributes → visible", decideVisibility(A({}), "sto", CITIES), { visible: true, unknownValues: [] });

// ── show ─────────────────────────────────────────────────────
check("show match → visible", decideVisibility(A({ show: "sto" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show mismatch → hidden", decideVisibility(A({ show: "cph" }), "sto", CITIES), { visible: false, unknownValues: [] });
check("show list, one matches → visible", decideVisibility(A({ show: "cph, sto" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show by name, case-insensitive → visible", decideVisibility(A({ show: "Stockholm" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show, neutral active → hidden", decideVisibility(A({ show: "sto" }), null, CITIES), { visible: false, unknownValues: [] });
check("show empty value → visible (no-op)", decideVisibility(A({ show: "" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show unknown token → hidden + reported", decideVisibility(A({ show: "malmo" }), "sto", CITIES), { visible: false, unknownValues: ["malmo"] });

// ── hide ─────────────────────────────────────────────────────
check("hide match → hidden", decideVisibility(A({ hide: "sto" }), "sto", CITIES), { visible: false, unknownValues: [] });
check("hide non-match → visible", decideVisibility(A({ hide: "cph" }), "sto", CITIES), { visible: true, unknownValues: [] });
check("hide, neutral active → visible", decideVisibility(A({ hide: "sto" }), null, CITIES), { visible: true, unknownValues: [] });

// ── none ─────────────────────────────────────────────────────
check("none, neutral active → visible", decideVisibility(A({ none: true }), null, CITIES), { visible: true, unknownValues: [] });
check("none, city active → hidden", decideVisibility(A({ none: true }), "sto", CITIES), { visible: false, unknownValues: [] });

// ── any ──────────────────────────────────────────────────────
check("any, city active → visible", decideVisibility(A({ any: true }), "sto", CITIES), { visible: true, unknownValues: [] });
check("any, neutral active → hidden", decideVisibility(A({ any: true }), null, CITIES), { visible: false, unknownValues: [] });

// ── combined constraints (AND) ───────────────────────────────
check("show+any, match & active → visible", decideVisibility(A({ show: "sto", any: true }), "sto", CITIES), { visible: true, unknownValues: [] });
check("show+hide same city → hidden", decideVisibility(A({ show: "sto", hide: "sto" }), "sto", CITIES), { visible: false, unknownValues: [] });

console.log(`✓ all ${passed} assertions passed`);
