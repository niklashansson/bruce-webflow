// Unit test for the studios search-redirect serializer.
// Framework-free: run with `node tests/studios-search-query.test.mjs`.
// FormData is a Node global (18+). The source module's auto-boot is guarded
// against a missing `document`, so importing it here is side-effect free.

import assert from "node:assert/strict";
import { buildSearchQuery } from "../src/studios-search-redirect.js";
import { tallyCheckedFilters } from "../src/studios-filter-count.js";

/** Build a FormData from ordered [name, value] pairs (mirrors checked inputs). */
function fd(pairs) {
  const f = new FormData();
  for (const [k, v] of pairs) f.append(k, v);
  return f;
}

let passed = 0;
function check(label, actual, expected) {
  assert.equal(actual, expected, `${label}\n  expected: ${expected}\n  actual:   ${actual}`);
  passed++;
}

// Nothing entered → empty string (caller redirects to bare action).
check("empty", buildSearchQuery(fd([])), "");

// Whitespace-only query is dropped.
check("whitespace q", buildSearchQuery(fd([["q", "   "]])), "");

// Query only, trimmed. URLSearchParams encodes spaces as "+".
check("query only", buildSearchQuery(fd([["q", "  yoga studios  "]])), "q=yoga+studios");

// A single filter value → clean key=value (no JSON array).
check(
  "single filter",
  buildSearchQuery(fd([["city", "Bergen"]])),
  "city=Bergen",
);

// Multiple values in one group → repeated keys, in DOM order.
check(
  "multi same group",
  buildSearchQuery(fd([["city", "Bergen"], ["city", "Oslo"]])),
  "city=Bergen&city=Oslo",
);

// q first, then groups in DOM order.
check(
  "query + multi groups",
  buildSearchQuery(
    fd([
      ["q", "boxing"],
      ["tier", "BASE"],
      ["city", "Bergen"],
      ["city", "Oslo"],
      ["category", "Yoga"],
    ]),
  ),
  "q=boxing&tier=BASE&city=Bergen&city=Oslo&category=Yoga",
);

// Non-ASCII values survive (København → percent-encoded).
check(
  "non-ascii value",
  buildSearchQuery(fd([["city", "København"]])),
  "city=K%C3%B8benhavn",
);

// Special characters in values are encoded safely (no ambiguity with &).
check(
  "special chars",
  buildSearchQuery(fd([["category", "Strength & Cardio"]])),
  "category=Strength+%26+Cardio",
);

// ── tallyCheckedFilters ──────────────────────────────────────
// Input is the list of `name`s of checked filter inputs (DOM order).

{
  const r = tallyCheckedFilters([]);
  check("tally empty total", r.total, 0);
  check("tally empty groups", r.byGroup.size, 0);
}

{
  const r = tallyCheckedFilters(["city_equal"]);
  check("tally single total", r.total, 1);
  check("tally single group", r.byGroup.get("city_equal"), 1);
}

{
  const r = tallyCheckedFilters(["city_equal", "city_equal", "tier_equal"]);
  check("tally mixed total", r.total, 3);
  check("tally mixed city", r.byGroup.get("city_equal"), 2);
  check("tally mixed tier", r.byGroup.get("tier_equal"), 1);
}

console.log(`✓ all ${passed} assertions passed`);
