// Unit tests for the directions-url pure helpers.
// Framework-free: run with `node tests/directions-url.test.mjs`.
import assert from "node:assert/strict";
import {
  normalizeProvider,
  resolveProvider,
  isApplePlatform,
  buildDirectionsUrl,
  parseCoords,
  normalizeMode,
} from "../src/directions-url.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── normalizeProvider ────────────────────────────────────────
check("known provider", normalizeProvider("google"), "google");
check("case/whitespace tolerant", normalizeProvider("  Apple "), "apple");
check("unknown → null", normalizeProvider("bing"), null);
check("empty → null", normalizeProvider(""), null);
check("null → null", normalizeProvider(null), null);

// ── resolveProvider ──────────────────────────────────────────
check("platform default: apple", resolveProvider({ isApple: true }), "apple");
check("platform default: google", resolveProvider({ isApple: false }), "google");
check("stored beats platform", resolveProvider({ stored: "waze", isApple: true }), "waze");
check("override beats stored", resolveProvider({ override: "google", stored: "waze", isApple: true }), "google");
check("invalid override falls through", resolveProvider({ override: "bing", stored: "waze", isApple: true }), "waze");
check("invalid stored falls through", resolveProvider({ stored: "garbage", isApple: true }), "apple");

// ── isApplePlatform ──────────────────────────────────────────
check("UA-CH macOS", isApplePlatform({ userAgentData: { platform: "macOS" } }), true);
check("UA-CH iOS", isApplePlatform({ userAgentData: { platform: "iOS" } }), true);
check("UA-CH Android", isApplePlatform({ userAgentData: { platform: "Android" }, userAgent: "Macintosh" }), false);
check("UA iPhone", isApplePlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }), true);
check("UA iPadOS-as-Mac", isApplePlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }), true);
check("UA Windows", isApplePlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }), false);
check("empty nav", isApplePlatform({}), false);

// ── buildDirectionsUrl ───────────────────────────────────────
const dest = { lat: 55.6, lng: 13.0, name: "Bruce Malmö" };
check(
  "apple with label",
  buildDirectionsUrl("apple", dest),
  "https://maps.apple.com/?daddr=55.6%2C13&dirflg=d&q=Bruce+Malm%C3%B6",
);
check(
  "apple without label",
  buildDirectionsUrl("apple", { lat: 55.6, lng: 13.0 }),
  "https://maps.apple.com/?daddr=55.6%2C13&dirflg=d",
);
check(
  "google ignores name",
  buildDirectionsUrl("google", dest),
  "https://www.google.com/maps/dir/?api=1&destination=55.6%2C13",
);
check("waze", buildDirectionsUrl("waze", dest), "https://waze.com/ul?ll=55.6%2C13&navigate=yes");
check(
  "negative coords preserved",
  buildDirectionsUrl("google", { lat: -33.9, lng: 151.2 }),
  "https://www.google.com/maps/dir/?api=1&destination=-33.9%2C151.2",
);

// ── place mode ───────────────────────────────────────────────
const place = { mode: "place" };
check(
  "apple place with label",
  buildDirectionsUrl("apple", dest, place),
  "https://maps.apple.com/?ll=55.6%2C13&q=Bruce+Malm%C3%B6",
);
check(
  "google place",
  buildDirectionsUrl("google", dest, place),
  "https://www.google.com/maps/search/?api=1&query=55.6%2C13",
);
check("waze place (no navigate)", buildDirectionsUrl("waze", dest, place), "https://waze.com/ul?ll=55.6%2C13");
check("normalizeMode place", normalizeMode(" Place "), "place");
check("normalizeMode default", normalizeMode("route"), "directions");
check("normalizeMode null", normalizeMode(null), "directions");

// ── parseCoords ──────────────────────────────────────────────
check("parses strings", parseCoords("55.6", " 13.0 "), { lat: 55.6, lng: 13 });
check("missing lng → null", parseCoords("55.6", null), null);
check("non-numeric → null", parseCoords("abc", "13"), null);
check("empty → null", parseCoords("", ""), null);

console.log(`ok - ${passed} checks passed`);
