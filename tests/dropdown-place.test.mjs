// Unit tests for the pure dropdown placement helper.
// Framework-free: run with `node tests/dropdown-place.test.mjs`.
import assert from "node:assert/strict";
import { place } from "../src/dropdown-place.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// A 400x800 phone viewport with no visual-viewport offset.
const PHONE = { top: 0, left: 0, width: 400, height: 800 };

// ── Vertical placement ───────────────────────────────────────

check(
  "fits below — placed below, unclamped",
  place({
    anchor: { top: 100, bottom: 130, left: 20, width: 100 },
    panel: { width: 200, height: 300 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 20, maxHeight: 300 },
);

check(
  "does not fit below but fits above — flips, unclamped",
  place({
    anchor: { top: 600, bottom: 630, left: 20, width: 100 },
    panel: { width: 200, height: 400 },
    viewport: PHONE,
  }),
  { placement: "top", top: 192, left: 20, maxHeight: 400 },
);

check(
  "fits neither, more room above — flips and clamps to the space above",
  place({
    anchor: { top: 500, bottom: 530, left: 20, width: 100 },
    panel: { width: 200, height: 900 },
    viewport: PHONE,
  }),
  { placement: "top", top: 8, left: 20, maxHeight: 484 },
);

check(
  "fits neither, more room below — stays below and clamps",
  place({
    anchor: { top: 200, bottom: 230, left: 20, width: 100 },
    panel: { width: 200, height: 900 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 238, left: 20, maxHeight: 554 },
);

// ── Horizontal shift ─────────────────────────────────────────

check(
  "anchor near the right edge — panel shifts left to stay inside the inset",
  place({
    anchor: { top: 100, bottom: 130, left: 350, width: 40 },
    panel: { width: 200, height: 100 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 192, maxHeight: 100 },
);

check(
  "panel wider than the viewport — pinned to the left inset, not snapped right",
  place({
    anchor: { top: 100, bottom: 130, left: 350, width: 40 },
    panel: { width: 500, height: 100 },
    viewport: PHONE,
  }),
  { placement: "bottom", top: 138, left: 8, maxHeight: 100 },
);

// ── Visual viewport ──────────────────────────────────────────

check(
  "offset viewport (soft keyboard / pinch zoom) is respected",
  place({
    anchor: { top: 150, bottom: 180, left: 20, width: 100 },
    panel: { width: 200, height: 500 },
    viewport: { top: 100, left: 0, width: 400, height: 300 },
  }),
  { placement: "bottom", top: 188, left: 20, maxHeight: 204 },
);

// ── Degenerate space ─────────────────────────────────────────

check(
  "no room on either side — maxHeight floors at 0, never negative",
  place({
    anchor: { top: 0, bottom: 40, left: 20, width: 100 },
    panel: { width: 200, height: 300 },
    viewport: { top: 0, left: 0, width: 400, height: 40 },
  }),
  { placement: "bottom", top: 48, left: 20, maxHeight: 0 },
);

check(
  "custom gap and inset are honoured",
  place({
    anchor: { top: 100, bottom: 130, left: 0, width: 100 },
    panel: { width: 200, height: 100 },
    viewport: PHONE,
    gap: 4,
    inset: 16,
  }),
  { placement: "bottom", top: 134, left: 16, maxHeight: 100 },
);

console.log(`✓ all ${passed} assertions passed`);
