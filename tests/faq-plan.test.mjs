// Unit tests for the faq-plan pure planner.
// Framework-free: run with `node tests/faq-plan.test.mjs`.
import assert from "node:assert/strict";
import { planFaqNesting } from "../src/faq-plan.js";

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
  "groups items under matching targets, in item order",
  planFaqNesting(["a", "b"], ["a", "a", "b"]),
  {
    groups: [
      { slug: "a", itemIndexes: [0, 1] },
      { slug: "b", itemIndexes: [2] },
    ],
    orphanItemIndexes: [],
    emptyTargetSlugs: [],
  },
);

check(
  "preserves item order within a group regardless of target order",
  planFaqNesting(["b", "a"], ["a", "b", "a"]),
  {
    groups: [
      { slug: "b", itemIndexes: [1] },
      { slug: "a", itemIndexes: [0, 2] },
    ],
    orphanItemIndexes: [],
    emptyTargetSlugs: [],
  },
);

check(
  "items with no matching target are orphans",
  planFaqNesting(["a"], ["a", "b"]),
  {
    groups: [{ slug: "a", itemIndexes: [0] }],
    orphanItemIndexes: [1],
    emptyTargetSlugs: [],
  },
);

check(
  "targets with no items are reported empty",
  planFaqNesting(["a", "b"], ["a"]),
  {
    groups: [
      { slug: "a", itemIndexes: [0] },
      { slug: "b", itemIndexes: [] },
    ],
    orphanItemIndexes: [],
    emptyTargetSlugs: ["b"],
  },
);

check(
  "duplicate target slug: first wins, the rest stay empty",
  planFaqNesting(["a", "a"], ["a"]),
  {
    groups: [
      { slug: "a", itemIndexes: [0] },
      { slug: "a", itemIndexes: [] },
    ],
    orphanItemIndexes: [],
    emptyTargetSlugs: ["a"],
  },
);

check("empty inputs produce empty plan", planFaqNesting([], []), {
  groups: [],
  orphanItemIndexes: [],
  emptyTargetSlugs: [],
});

console.log(`✓ all ${passed} assertions passed`);
