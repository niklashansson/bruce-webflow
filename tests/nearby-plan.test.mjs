// Unit tests for the nearby-plan pure helper.
// Framework-free: run with `node tests/nearby-plan.test.mjs`.
import assert from "node:assert/strict";
import { planNearby } from "../src/nearby-plan.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── toggle-origin branch ─────────────────────────────────────
check(
  "user switches nearby ON → every source unchecks, other toggles follow",
  planNearby({
    toggles: [true, false],
    sources: [true, true],
    originKind: "toggle",
    originIndex: 0,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "user switches nearby OFF → every source rechecks",
  planNearby({
    toggles: [false, true],
    sources: [false, false],
    originKind: "toggle",
    originIndex: 0,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);
check(
  "the mobile copy can originate too",
  planNearby({
    toggles: [false, true],
    sources: [true, true],
    originKind: "toggle",
    originIndex: 1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);

// ── canonical-source branch ──────────────────────────────────
check(
  "source-origin → first source is canonical, disagreeing duplicate converges",
  planNearby({
    toggles: [false, false],
    sources: [false, true],
    originKind: "source",
    originIndex: 1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "URL restore with nearby enabled → toggles come up on",
  planNearby({
    toggles: [false, false],
    sources: [false, false],
    originKind: null,
    originIndex: -1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "first paint → source checked, toggles off, metro only",
  planNearby({
    toggles: [false, false],
    sources: [true, true],
    originKind: null,
    originIndex: -1,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── loop termination ─────────────────────────────────────────
// The .click() we issue on a source re-enters the applier down the
// source branch. It must return the state it was handed, unchanged, or the
// handler would write again and never settle.
check(
  "already-consistent state returns itself (nearby on)",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: "source",
    originIndex: 0,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  "already-consistent state returns itself (nearby off)",
  planNearby({
    toggles: [false, false],
    sources: [true, true],
    originKind: "source",
    originIndex: 0,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── clear ────────────────────────────────────────────────────
check(
  "a pending global clear beats the toggle the user just flipped",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: "toggle",
    originIndex: 0,
    clearPending: true,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);
check(
  "a pending global clear beats an unchecked canonical source",
  planNearby({
    toggles: [true, true],
    sources: [false, false],
    originKind: null,
    originIndex: -1,
    clearPending: true,
  }),
  { toggles: [false, false], sources: [true, true], nearby: false },
);

// ── degenerate input ─────────────────────────────────────────
// A locale or template that never authored the hidden input must not read as
// "nearby enabled" — with nothing to filter on, the honest answer is the
// default.
check(
  "no sources at all → default (nearby hidden)",
  planNearby({ toggles: [false], sources: [], originKind: null, originIndex: -1 }),
  { toggles: [false], sources: [], nearby: false },
);
check(
  // sources: [false, false] (nearby: true) rather than [true, true] (nearby:
  // false) so this can't pass by accident — toggles[7] is undefined either
  // way, but only the canonical-source fallback lands on `true` here. Dropping
  // the `originIndex < toggles.length` guard would read toggles[7] as falsy
  // and wrongly answer `false`.
  "an out-of-range originIndex falls back to the canonical source",
  planNearby({
    toggles: [false, false],
    sources: [false, false],
    originKind: "toggle",
    originIndex: 7,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  // The applier really can produce -1 (indexOf's miss value) for a
  // non-"toggle" origin; planNearby must still take the canonical-source
  // branch rather than reading toggles[-1].
  "originKind toggle with originIndex -1 falls back to the canonical source",
  planNearby({
    toggles: [false, false],
    sources: [false, false],
    originKind: "toggle",
    originIndex: -1,
  }),
  { toggles: [true, true], sources: [false, false], nearby: true },
);
check(
  // "one dropdown authored with the pair, the other with only the visible
  // half" — the two .map()s over toggles/sources are independent, so mismatched
  // lengths must not throw or misalign.
  "mismatched array lengths (two toggles, one source) still resolve",
  planNearby({
    toggles: [false, false],
    sources: [false],
    originKind: "source",
    originIndex: -1,
  }),
  { toggles: [true, true], sources: [false], nearby: true },
);

console.log(`✓ all ${passed} assertions passed`);
