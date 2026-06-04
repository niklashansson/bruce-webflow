// Unit tests for the city-links-plan pure helpers.
// Framework-free: run with `node tests/city-links-plan.test.mjs`.
import assert from "node:assert/strict";
import { matchSection, resolveHref } from "../src/city-links-plan.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

const GATEWAYS = { memberships: "/memberships", studios: "/studios" };
const LINK_MAP = {
  memberships: {
    stockholm: "/memberships/stockholm",
    oslo: "/memberships/oslo",
  },
  studios: { stockholm: "/studios/city/stockholm" },
};

// ── matchSection ─────────────────────────────────────────────
check("exact match → section", matchSection("/memberships", GATEWAYS), "memberships");
check("trailing slash on link → still matches", matchSection("/memberships/", GATEWAYS), "memberships");
check("other section exact match", matchSection("/studios", GATEWAYS), "studios");
check("sub-page → null", matchSection("/memberships/foretag", GATEWAYS), null);
check("unrelated path → null", matchSection("/about", GATEWAYS), null);
check("empty gateways → null", matchSection("/memberships", {}), null);

// ── resolveHref ──────────────────────────────────────────────
check(
  "active city with page → city url",
  resolveHref({ section: "memberships", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/memberships/oslo",
);
check(
  "active city without page in section → gateway fallback",
  resolveHref({ section: "studios", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/studios",
);
check(
  "neutral → gateway path",
  resolveHref({ section: "memberships", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: null }),
  "/memberships",
);
check(
  "query + hash preserved on city url",
  resolveHref({ section: "memberships", search: "?plan=pro", hash: "#faq" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" }),
  "/memberships/oslo?plan=pro#faq",
);
check(
  "query + hash preserved on neutral fallback",
  resolveHref({ section: "memberships", search: "?plan=pro", hash: "#faq" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: null }),
  "/memberships?plan=pro#faq",
);

console.log(`✓ all ${passed} assertions passed`);
