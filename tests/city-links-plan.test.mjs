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
check("trailing slash in gateway value → still matches", matchSection("/memberships", { memberships: "/memberships/" }), "memberships");

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
check(
  "unknown section (not in gateways) → empty base, never the string 'undefined'",
  resolveHref({ section: "nope", search: "", hash: "" }, { gateways: GATEWAYS, linkMap: LINK_MAP, active: null }),
  "",
);

// ── resolveHref, keyed by city var ───────────────────────────
const KEYED_GATEWAYS = { ...GATEWAYS, terms: "/terms/se" };
const KEYED_LINK_MAP = {
  ...LINK_MAP,
  terms: { se: "/terms/se", dk: "/terms/dk", no: "/terms/no" },
};
const KEY_BY = { terms: "country" };

check(
  "keyed section + active city with country → country url",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "copenhagen", activeVars: { country: "dk" } },
  ),
  "/terms/dk",
);
check(
  "keyed section + neutral → gateway (default country)",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: null, activeVars: null },
  ),
  "/terms/se",
);
check(
  "keyed section + active city missing the var → gateway fallback",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "stockholm", activeVars: {} },
  ),
  "/terms/se",
);
check(
  "keyed section + var value with no list entry → gateway fallback",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "helsinki", activeVars: { country: "fi" } },
  ),
  "/terms/se",
);
check(
  "keyed section + empty-string var value → gateway fallback",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "stockholm", activeVars: { country: "" } },
  ),
  "/terms/se",
);
check(
  "keyed section preserves query + hash",
  resolveHref(
    { section: "terms", search: "?ref=footer", hash: "#privacy" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "oslo", activeVars: { country: "no" } },
  ),
  "/terms/no?ref=footer#privacy",
);
check(
  "keyed section + uppercase var value matches lowercase list key (synced SE vs terms se)",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "copenhagen", activeVars: { country: "DK" } },
  ),
  "/terms/dk",
);
check(
  "keyed section + lowercase var value matches uppercase list key",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: { ...KEYED_LINK_MAP, terms: { SE: "/terms/se", NO: "/terms/no" } }, keyBy: KEY_BY, active: "oslo", activeVars: { country: "no" } },
  ),
  "/terms/no",
);
check(
  "slug lookup is case-insensitive too",
  resolveHref(
    { section: "memberships", search: "", hash: "" },
    { gateways: GATEWAYS, linkMap: LINK_MAP, active: "Oslo" },
  ),
  "/memberships/oslo",
);
check(
  "slug-keyed section ignores keyBy for other sections (regression)",
  resolveHref(
    { section: "memberships", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "oslo", activeVars: { country: "no" } },
  ),
  "/memberships/oslo",
);
check(
  "old call shape (no keyBy/activeVars) still resolves slug-keyed sections",
  resolveHref(
    { section: "memberships", search: "", hash: "" },
    { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" },
  ),
  "/memberships/oslo",
);

console.log(`✓ all ${passed} assertions passed`);
