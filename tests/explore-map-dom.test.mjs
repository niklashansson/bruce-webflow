// DOM tests for the standalone map section (src/explore-map.js).
// Framework-free: run with `node tests/explore-map-dom.test.mjs`.
//
// This file exists to pin the two properties that justify the component's
// shape, neither of which is visible in the source alone:
//
//   1. LAZINESS. Mapbox GL (~460 kB) and supercluster sit behind an
//      IntersectionObserver, so a visitor who loads a page with the section
//      below the fold and never scrolls to it must never fetch either. The
//      module code itself is bundled eagerly — that is what makes this worth
//      testing: nothing about the source reads as lazy except the observer,
//      and only watching the network proves it still is.
//
//   2. OPT-IN CLUSTERING. Supercluster is fetched if and only if the section
//      authored a cluster template. This is the payload half of the opt-in;
//      the rendering half needs a live Mapbox instance and is verified in the
//      browser instead.
//
// Requests to the CDNs are intercepted and aborted — the assertions are about
// what the page ASKS for, so nothing external is actually downloaded, and the
// test works offline.
//
// Like the other DOM tests this drives an ALREADY-INSTALLED Chrome over CDP
// (puppeteer-core, a devDependency — no bundled-browser download), and skips
// with exit 0 when there is no Chrome or no puppeteer-core.
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
if (!existsSync(path.join(SRC_DIR, "explore-map.js")))
  skip(`no explore-map.js under ${SRC_DIR}`);

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
// The section sits below a tall spacer so it starts well outside the
// IntersectionObserver's 200px margin — the "never scrolled there" case.
// `?cluster=1` authors a cluster template; `?empty=1` drops the studios.

function card(id, lat, lng) {
  return `
  <div data-map-element="item" id="${id}">
    <div data-explorer-field="studio-lat">${lat}</div>
    <div data-explorer-field="studio-lng">${lng}</div>
    <div data-explorer-field="studio-id">${id}</div>
    <div data-explorer-element="studio-marker" style="display:none">pin</div>
    <div data-explorer-element="studio-popup">${id}</div>
  </div>`;
}

const SHELL = `<!doctype html>
<meta charset="utf-8">
<title>explore-map harness</title>
<style>
  body { margin: 0 }
  #spacer { height: 400vh }
  [data-map-element="target"] { height: 300px }
</style>
<body>
<div id="spacer">scroll down</div>
<section data-map-element="wrap" id="section">
  <div data-map-element="target"></div>
  <div id="cluster-slot"></div>
  <div id="items"></div>
</section>
<script type="module">
const params = new URLSearchParams(location.search);

if (params.get("cluster")) {
  document.getElementById("cluster-slot").innerHTML =
    '<div data-map-element="cluster-template"><span data-explorer-field="count">0</span></div>';
}
if (!params.get("empty")) {
  document.getElementById("items").innerHTML = ${JSON.stringify("")} +
    [
      ${JSON.stringify(card("a", "59.91", "10.75"))},
      ${JSON.stringify(card("b", "59.92", "10.76"))},
    ].join("");
}

window.__scrollToSection = () => {
  document.getElementById("section").scrollIntoView();
};
window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__mapReady = () =>
  document.getElementById("section").dataset.mapReady ?? null;

await import("/src/explore-map.js");
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

/**
 * A fresh page per scenario, recording every request and aborting the CDN ones
 * so nothing is really downloaded. Returns helpers over the recorded log.
 */
async function newPage(query = "") {
  const page = await browser.newPage();
  const requested = [];
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    requested.push(url);
    if (url.includes("api.mapbox.com") || url.includes("unpkg.com")) {
      return req.abort();
    }
    req.continue();
  });
  await page.goto(`${BASE}/harness.html${query}`, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 10000 });
  const saw = (needle) => requested.some((u) => u.includes(needle));
  return { page, saw, requested };
}

/** Scroll the section into view and give the observer + import time to run. */
async function reveal(page) {
  await page.evaluate(() => window.__scrollToSection());
  await page.evaluate(() => window.__sleep(500));
}

try {
  // ── 1. No map libraries are fetched for an off-screen section ──────
  // The section is parked under a 400vh spacer, well outside the observer's
  // 200px margin — the "loaded the page, never scrolled" visitor.
  {
    const { page, saw } = await newPage();
    await page.evaluate(() => window.__sleep(300));
    check(
      "1. an off-screen section fetches neither mapbox nor supercluster",
      { mapbox: saw("mapbox-gl.js"), supercluster: saw("supercluster") },
      { mapbox: false, supercluster: false },
    );
    await page.close();
  }

  // ── 2. Scrolling to it loads mapbox ────────────────────────────────
  {
    const { page, saw } = await newPage();
    await reveal(page);
    check(
      "2. revealing the section loads mapbox",
      saw("mapbox-gl.js"),
      true,
    );
    await page.close();
  }

  // ── 3. No cluster template → supercluster is never fetched ─────────
  // The payload half of opt-in clustering.
  {
    const { page, saw } = await newPage();
    await reveal(page);
    check(
      "3. a points-only section never fetches supercluster",
      saw("supercluster"),
      false,
    );
    await page.close();
  }

  // ── 4. A cluster template → supercluster IS fetched ────────────────
  {
    const { page, saw } = await newPage("?cluster=1");
    await reveal(page);
    check(
      "4. a section with a cluster template fetches supercluster",
      saw("supercluster"),
      true,
    );
    await page.close();
  }

  // ── 5. Mapbox is fetched exactly once ──────────────────────────────
  // start() is guarded and the observer disconnects; scrolling away and back
  // must not start a second map.
  {
    const { page, requested } = await newPage();
    await reveal(page);
    await reveal(page);
    check(
      "5. mapbox is requested exactly once across repeated reveals",
      requested.filter((u) => u.includes("mapbox-gl.js")).length,
      1,
    );
    await page.close();
  }

  // ── 6. An empty collection still starts, and warns ─────────────────
  // A section whose CMS list rendered nothing should degrade to an empty map,
  // not throw on the way there.
  {
    const { page, saw } = await newPage("?empty=1");
    // Puppeteer reports console.warn as type "warn" (not CDP's "warning").
    const warnings = [];
    page.on("console", (m) => {
      if (m.type() === "warn") warnings.push(m.text());
    });
    await reveal(page);
    check(
      "6. an empty collection still starts the map and warns",
      {
        mapbox: saw("mapbox-gl.js"),
        warned: warnings.some((w) => w.includes("[explore-map] No ")),
      },
      { mapbox: true, warned: true },
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
console.log(`✓ explore-map DOM: ${passed} checks passed`);
