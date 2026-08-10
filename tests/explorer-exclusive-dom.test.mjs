// DOM tests for the explorer's "Show exclusive to tier" switch.
// Framework-free: run with `node tests/explorer-exclusive-dom.test.mjs`.
//
// The shipped explorer page renders the filter bar TWICE inside the single
// filters form — a desktop copy and a mobile copy, each with its own membership
// radios and its own exclusive toggle, only one of which is visible at a time.
// syncExclusiveToggle rewrites `fs-list-value` on the toggle to track the
// selected membership; if it only reaches the first copy, the mobile switch
// stays value-less and Finsweet filters on the raw Webflow `value` ("Value"),
// which matches no studio — the mobile bug this file pins down.
//
// Like tests/dropdown-dom.test.mjs, this drives an ALREADY-INSTALLED Chrome
// over CDP (puppeteer-core, a devDependency — no bundled-browser download) and
// imports the real src/explorer.js. Nothing is copied, inlined or stubbed:
// explorer.js self-runs setupFilterForms() on import, and the harness mounts
// the markup before importing so that boot pass sees it.
//
// If no Chrome can be found, or puppeteer-core is not installed, it prints a
// skip line and exits 0 so `node tests/*.test.mjs` keeps working everywhere.
//
// Point it at a different tree with EXPLORER_SRC_DIR=/path/to/src.

import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(
  process.env.EXPLORER_SRC_DIR || path.join(HERE, "..", "src"),
);

// ── Skip gates ───────────────────────────────────────────────

function skip(reason) {
  console.log(`- skipped: ${reason}`);
  process.exit(0);
}

/** Locate an installed Chrome/Chromium. Never downloads one. */
function findChrome() {
  const fromEnv =
    process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ],
  };
  for (const p of candidates[process.platform] || [])
    if (existsSync(p)) return p;

  for (const bin of ["google-chrome", "chromium", "chromium-browser"]) {
    try {
      const p = execFileSync("command", ["-v", bin], {
        shell: true,
        encoding: "utf8",
      }).trim();
      if (p && existsSync(p)) return p;
    } catch (_) {
      /* not on PATH */
    }
  }
  return null;
}

let puppeteer;
try {
  ({ default: puppeteer } = await import("puppeteer-core"));
} catch (_) {
  skip("puppeteer-core is not installed (devDependency) — run `pnpm install`");
}

const chromePath = findChrome();
if (!chromePath)
  skip("no installed Chrome/Chromium found (set CHROME_PATH to override)");
if (!existsSync(path.join(SRC_DIR, "explorer.js")))
  skip(`no explorer.js under ${SRC_DIR}`);

// ── Assertions ───────────────────────────────────────────────

let passed = 0;
const failures = [];
function check(label, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    passed++;
  } catch (_) {
    failures.push(
      `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
  }
}

// ── Static server + page shell ───────────────────────────────
//
// A trimmed copy of the shipped structure: ONE filters form holding a desktop
// and a mobile membership dropdown. Both radio sets share `name="tier"`, so all
// six radios form a single group exactly as they do live. Each copy owns an
// exclusive toggle carrying the Finsweet condition attributes with NO authored
// fs-list-value — that is the attribute explorer.js maintains.
//
// `?checked=<id>` ships one exclusive toggle pre-checked with no membership
// selected, to exercise the force-off branch on first paint.

function membershipCopy(scope) {
  return `
  <div data-dropdown-element="wrap" data-search-group="tiers" class="${scope}">
    <button type="button" fs-list-element="clear" fs-list-field="tiers">
      <div data-search-count="tiers" id="${scope}-count">0</div>
    </button>
    <label><input type="radio" name="tier" id="${scope}-base"
      fs-list-field="tiers" fs-list-value="base" fs-list-operator="contain" value="base"></label>
    <label><input type="radio" name="tier" id="${scope}-black"
      fs-list-field="tiers" fs-list-value="black" fs-list-operator="contain" value="black"></label>
    <label><input type="radio" name="tier" id="${scope}-epic"
      fs-list-field="tiers" fs-list-value="epic" fs-list-operator="contain" value="epic"></label>
    <label><input type="checkbox" id="${scope}-toggle"
      name="Toggle exclusive studios" data-explorer-element="exclusive-toggle"
      fs-list-field="tier" fs-list-operator="equal" value="Value"></label>
  </div>`;
}

const SHELL = `<!doctype html>
<meta charset="utf-8">
<title>explorer exclusive-toggle harness</title>
<body>
<main data-explorer-element="wrap">
  <div data-explorer-element="filter-bar">
    <form fs-list-element="filters">
      <input type="search" name="q" value="">
      ${membershipCopy("desktop")}
      ${membershipCopy("mobile")}
    </form>
  </div>
</main>
<script type="module">
// Pre-check one toggle BEFORE explorer.js boots, so its first pass sees a
// checked switch with no membership behind it.
const pre = new URLSearchParams(location.search).get("checked");
if (pre) document.getElementById(pre).checked = true;

// Finsweet is not on the page; explorer.js only pushes a callback onto this
// queue, which nothing drains. The filter-form wiring under test is
// independent of it.
window.FinsweetAttributes = [];

window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every exclusive toggle's live state, in DOM order.
window.__toggles = () =>
  [...document.querySelectorAll('[data-explorer-element="exclusive-toggle"]')].map(
    (el) => ({
      id: el.id,
      value: el.getAttribute("fs-list-value"),
      checked: el.checked,
    }),
  );

window.__wrapState = () => {
  const w = document.querySelector('[data-explorer-element="wrap"]');
  return {
    membership: w.dataset.explorerMembership ?? null,
    available: w.dataset.explorerExclusiveAvailable ?? null,
    exclusive: w.dataset.explorerExclusive ?? null,
  };
};

await import("/src/explorer.js");
window.__ready = true;
</script>
`;

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/harness.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(SHELL);
  }
  if (url.pathname.startsWith("/src/")) {
    // Confined to SRC_DIR — no traversal out of the tree under test.
    const rel = url.pathname.slice("/src/".length);
    const file = path.resolve(SRC_DIR, rel);
    if (file.startsWith(SRC_DIR + path.sep) && existsSync(file)) {
      res.writeHead(200, {
        "content-type": MIME[path.extname(file)] || "application/octet-stream",
      });
      return res.end(fs.readFileSync(file));
    }
  }
  res.writeHead(404).end("not found");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** A fresh page per scenario — explorer.js keeps module-global state. */
async function newPage(query = "") {
  const page = await browser.newPage();
  await page.goto(`${BASE}/harness.html${query}`, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 10000 });
  return page;
}

const click = (page, id) =>
  page.evaluate((i) => document.getElementById(i).click(), id);

try {
  // ── 1. A membership picked in the MOBILE copy reaches BOTH toggles ──
  // The live bug: syncExclusiveToggle used form.querySelector (singular), so
  // only the first copy in the DOM — the desktop one — was ever rewritten. The
  // mobile switch kept no fs-list-value, Finsweet fell back to the Webflow
  // `value="Value"`, and `tier equal Value` matched nothing → "0 studios".
  {
    const page = await newPage();
    await click(page, "mobile-epic");
    check(
      "1. mobile membership rewrites fs-list-value on every exclusive toggle",
      await page.evaluate(() => window.__toggles()),
      [
        { id: "desktop-toggle", value: "epic", checked: false },
        { id: "mobile-toggle", value: "epic", checked: false },
      ],
    );
    await page.close();
  }

  // ── 2. …and so does one picked in the DESKTOP copy (regression) ────
  {
    const page = await newPage();
    await click(page, "desktop-black");
    check(
      "2. desktop membership rewrites fs-list-value on every exclusive toggle",
      await page.evaluate(() => window.__toggles()),
      [
        { id: "desktop-toggle", value: "black", checked: false },
        { id: "mobile-toggle", value: "black", checked: false },
      ],
    );
    await page.close();
  }

  // ── 3. Flipping the MOBILE switch is reflected on the wrap ──────────
  // data-explorer-exclusive drives the page chrome. Read off the first toggle
  // only, it stayed "false" for the whole mobile layout.
  {
    const page = await newPage();
    await click(page, "mobile-epic");
    await click(page, "mobile-toggle");
    check(
      "3. mobile switch drives data-explorer-exclusive",
      await page.evaluate(() => window.__wrapState()),
      { membership: "epic", available: "true", exclusive: "true" },
    );
    await page.close();
  }

  // ── 4. The desktop switch keeps driving it (regression) ────────────
  {
    const page = await newPage();
    await click(page, "desktop-epic");
    await click(page, "desktop-toggle");
    check(
      "4. desktop switch drives data-explorer-exclusive",
      await page.evaluate(() => window.__wrapState()),
      { membership: "epic", available: "true", exclusive: "true" },
    );
    await page.close();
  }

  // ── 5. No membership → every checked switch is forced back off ─────
  // "Exclusive to X" has no meaning without an X. The force-off must reach the
  // mobile copy too, or a mis-restored state leaves `tier equal ""` filtering.
  {
    const page = await newPage("?checked=mobile-toggle");
    await page.evaluate(() => window.__sleep(50));
    check(
      "5. a checked mobile switch with no membership is forced off",
      await page.evaluate(() => ({
        toggles: window.__toggles(),
        wrap: window.__wrapState(),
      })),
      {
        toggles: [
          { id: "desktop-toggle", value: "", checked: false },
          { id: "mobile-toggle", value: "", checked: false },
        ],
        wrap: { membership: null, available: "false", exclusive: "false" },
      },
    );
    await page.close();
  }

  // ── 6. The switches never count into the filter badges ─────────────
  // reflectFilters exempts the toggle explicitly; with two of them, both must
  // be exempt or the membership badge reads 2 instead of 1.
  {
    const page = await newPage();
    await click(page, "mobile-epic");
    await click(page, "mobile-toggle");
    check(
      "6. exclusive switches stay out of the membership badge count",
      await page.evaluate(() => [
        document.getElementById("desktop-count").textContent,
        document.getElementById("mobile-count").textContent,
      ]),
      ["1", "1"],
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// ── Report ───────────────────────────────────────────────────

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n`);
  for (const f of failures) console.error(`✗ ${f}\n`);
  process.exit(1);
}
console.log(`✓ explorer exclusive-toggle DOM: ${passed} checks passed`);
