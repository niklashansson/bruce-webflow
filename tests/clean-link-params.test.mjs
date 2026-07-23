// Unit tests for the clean-link-params pure helper.
// Framework-free: run with `node tests/clean-link-params.test.mjs`.
import assert from "node:assert/strict";
import { stripEmptyParams } from "../src/clean-link-params-plan.js";

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(
    actual,
    expected,
    `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
  passed++;
}

// ── stripEmptyParams ─────────────────────────────────────────

check(
  "removes empty params, keeps filled ones",
  stripEmptyParams("https://app.example.com/en/signup?tier=gold&contract-type=&payment-plan=12&wellness=&campaign-code=&city_code="),
  "https://app.example.com/en/signup?tier=gold&payment-plan=12",
);

check(
  "all params empty → no query string at all",
  stripEmptyParams("https://app.example.com/en/signup?tier=&campaign-code="),
  "https://app.example.com/en/signup",
);

check(
  "no empty params → null (caller leaves DOM untouched)",
  stripEmptyParams("https://app.example.com/en/signup?tier=gold&payment-plan=12"),
  null,
);

check(
  "no query string → null",
  stripEmptyParams("https://app.example.com/en/signup"),
  null,
);

check(
  "hash survives cleaning",
  stripEmptyParams("https://app.example.com/signup?tier=&plan=3#pricing"),
  "https://app.example.com/signup?plan=3#pricing",
);

check(
  "falsy-looking values are kept",
  stripEmptyParams("https://app.example.com/signup?wellness=false&count=0&tier="),
  "https://app.example.com/signup?wellness=false&count=0",
);

check(
  "repeated key: only the empty occurrence is dropped",
  stripEmptyParams("https://app.example.com/signup?tier=&tier=gold"),
  "https://app.example.com/signup?tier=gold",
);

check(
  "bare key without = counts as empty",
  stripEmptyParams("https://app.example.com/signup?wellness&tier=gold"),
  "https://app.example.com/signup?tier=gold",
);

check(
  "relative href resolves against base",
  stripEmptyParams("/en/signup?tier=&plan=3", "https://app.example.com"),
  "https://app.example.com/en/signup?plan=3",
);

check("unparseable href → null", stripEmptyParams("http://"), null);
check("empty string → null", stripEmptyParams(""), null);

console.log(`clean-link-params: ${passed} checks passed`);
