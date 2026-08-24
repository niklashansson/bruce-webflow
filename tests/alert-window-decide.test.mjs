// Unit tests for the alert-window-decide pure helper.
// Framework-free: run with `node tests/alert-window-decide.test.mjs`.
import assert from "node:assert/strict";
import { decideAlertVisible } from "../src/alert-window-decide.js";

let passed = 0;
function check(label, actual, expected) {
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  passed++;
}

// Fixed "now" so tests are deterministic: mid-day UTC.
const NOW = new Date("2026-08-24T12:00:00Z");

// ── Acceptance checks (KIN-102) ──────────────────────────────

check(
  "start in past + no end → visible",
  decideAlertVisible("2026-07-21T00:00:00Z", "", NOW),
  true,
);

check(
  "start in future → hidden",
  decideAlertVisible("2026-09-01T00:00:00Z", "", NOW),
  false,
);

check(
  "end in past → hidden",
  decideAlertVisible("2026-07-01T00:00:00Z", "2026-08-01T00:00:00Z", NOW),
  false,
);

check(
  "start today at midnight UTC → visible the same day",
  decideAlertVisible("2026-08-24T00:00:00Z", "", NOW),
  true,
);

check(
  "no dates at all → visible (no constraint)",
  decideAlertVisible("", "", NOW),
  true,
);

// ── Window edges ─────────────────────────────────────────────

check(
  "start exactly now → visible (strictly-after hides)",
  decideAlertVisible("2026-08-24T12:00:00Z", "", NOW),
  true,
);

check(
  "end exactly now → visible (strictly-before hides)",
  decideAlertVisible("", "2026-08-24T12:00:00Z", NOW),
  true,
);

check(
  "end in future, no start → visible",
  decideAlertVisible("", "2026-12-31T00:00:00Z", NOW),
  true,
);

check(
  "start past + end future (open window) → visible",
  decideAlertVisible("2026-08-01T00:00:00Z", "2026-12-31T00:00:00Z", NOW),
  true,
);

check(
  "start in future wins even with end in future",
  decideAlertVisible("2026-09-01T00:00:00Z", "2026-12-31T00:00:00Z", NOW),
  false,
);

// ── Missing / malformed input fails OPEN (alert stays visible) ──

check("null attributes → visible", decideAlertVisible(null, null, NOW), true);

check(
  "whitespace-only attributes → visible",
  decideAlertVisible("  ", "  ", NOW),
  true,
);

check(
  "unparsable start → no start constraint (visible)",
  decideAlertVisible("not-a-date", "", NOW),
  true,
);

check(
  "unparsable end → no end constraint (visible)",
  decideAlertVisible("", "garbage", NOW),
  true,
);

check(
  "unparsable end + future start → start still applies (hidden)",
  decideAlertVisible("2026-09-01T00:00:00Z", "garbage", NOW),
  false,
);

console.log(`✓ all ${passed} assertions passed`);
