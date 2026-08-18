// DOM tests for the city switcher: a switcher that is also a link must set the
// city AND still navigate, so a gateway city-picker card can hand the pick to
// the destination page (autumn-campaign gateway → country campaign page).
//
// Framework-free: run with `node tests/city-switcher-dom.test.mjs`.
//
// These properties cannot be checked without a real browser: they are about
// event propagation order, preventDefault, a real navigation and localStorage
// surviving it. So this file drives an ALREADY-INSTALLED Chrome over CDP
// (puppeteer-core, a devDependency — no bundled-browser download) against
// `src/` served over http://localhost, and imports the real modules. Nothing
// is copied, inlined or stubbed.
//
// If no Chrome can be found, or puppeteer-core is not installed, it prints a
// skip line and exits 0 so `node tests/*.test.mjs` keeps working everywhere.
//
// Point it at a different tree with CITY_SRC_DIR=/path/to/src.

import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(process.env.CITY_SRC_DIR || path.join(HERE, "..", "src"));

// ── Skip gates ───────────────────────────────────────────────

function skip(reason) {
  console.log(`- skipped: ${reason}`);
  process.exit(0);
}

/** Locate an installed Chrome/Chromium. Never downloads one. */
function findChrome() {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
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
  for (const p of candidates[process.platform] || []) if (existsSync(p)) return p;

  for (const bin of ["google-chrome", "chromium", "chromium-browser"]) {
    try {
      const p = execFileSync("command", ["-v", bin], { shell: true, encoding: "utf8" }).trim();
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
if (!chromePath) skip("no installed Chrome/Chromium found (set CHROME_PATH to override)");
if (!existsSync(path.join(SRC_DIR, "city-switcher.js")))
  skip(`no city-switcher.js under ${SRC_DIR}`);

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

// ── Static server + page shells ──────────────────────────────
//
// The registry is the hidden CMS list city-registry.js reads. `?nolist=1`
// omits it so the "registry renders late" path can be exercised: that is the
// state a visitor clicking a picker card before the CMS list settles is in.

const REGISTRY = `
<div data-city-list hidden>
  <div data-city-slug="stockholm"  data-city-name="Stockholm"  data-city-var-country="se"></div>
  <div data-city-slug="gothenburg" data-city-name="Gothenburg" data-city-var-country="se"></div>
  <div data-city-slug="copenhagen" data-city-name="Copenhagen" data-city-var-country="dk"></div>
</div>`;

const SHELL = (withList) => `<!doctype html>
<meta charset="utf-8">
<title>city switcher harness</title>
<body>
${withList ? REGISTRY : ""}
<a id="link" href="/dest.html" data-set-city="gothenburg">Gothenburg</a>
<div id="plain" role="button" data-set-city="stockholm">Stockholm</div>
<script type="module">
// Registered on window (the last hop of the bubble path) so it observes the
// switcher's document-level handler AFTER it has run.
window.__prevented = null;
window.addEventListener("click", (e) => { window.__prevented = e.defaultPrevented; });

window.__addRegistry = () => {
  document.body.insertAdjacentHTML("afterbegin", ${JSON.stringify(REGISTRY)});
};

await import("/src/city-context.js");
await import("/src/city-switcher.js");
window.__ready = true;
</script>
`;

const DEST = `<!doctype html>
<meta charset="utf-8">
<title>destination</title>
<body>arrived
`;

const MIME = { ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/harness.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(SHELL(!url.searchParams.has("nolist")));
  }
  if (url.pathname === "/dest.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(DEST);
  }
  if (url.pathname.startsWith("/src/")) {
    // Confined to SRC_DIR — no traversal out of the tree under test.
    const rel = url.pathname.slice("/src/".length);
    const file = path.resolve(SRC_DIR, rel);
    if (file.startsWith(SRC_DIR + path.sep) && existsSync(file)) {
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
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

/** A fresh page in its own browser context, so localStorage starts empty. */
async function newPage({ list = true } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/harness.html${list ? "" : "?nolist=1"}`, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 10000 });
  return { page, context };
}

const STORAGE_KEY = "bruce-city";

try {
  // ── 1. A switcher that is a link navigates, and the pick sticks ──
  // The autumn-campaign gateway: the card links to a COUNTRY page, which can
  // carry no data-city-lock, so the click itself is the only chance to record
  // which city the visitor picked. preventDefault() here would break the page.
  {
    const { page, context } = await newPage();
    // A swallowed timeout means "did not navigate" — reported by the check
    // below rather than thrown, so the later assertions still run.
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load", timeout: 4000 }).catch(() => {}),
      page.click("#link"),
    ]);
    const after = await page.evaluate((k) => ({
      pathname: location.pathname,
      saved: localStorage.getItem(k),
    }), STORAGE_KEY);
    check("1. link switcher navigates and persists the pick", after, {
      pathname: "/dest.html",
      saved: "gothenburg",
    });
    await context.close();
  }

  // ── 2. A non-link switcher still switches in place ─────────
  // Regression guard: in-place switching must keep suppressing the default.
  {
    const { page, context } = await newPage();
    await page.click("#plain");
    const after = await page.evaluate((k) => ({
      prevented: window.__prevented,
      saved: localStorage.getItem(k),
      active: window.bruce.city.get(),
      pathname: location.pathname,
    }), STORAGE_KEY);
    check("2. non-link switcher switches in place, default suppressed", after, {
      prevented: true,
      saved: "stockholm",
      active: "stockholm",
      pathname: "/harness.html",
    });
    await context.close();
  }

  // ── 3. A pick made before the registry settled is not dropped ──
  // set() validates against the registry read at boot. When the CMS list
  // renders after that read, an early click would otherwise be discarded.
  {
    const { page, context } = await newPage({ list: false });
    const after = await page.evaluate((k) => {
      window.__addRegistry();
      window.bruce.city.set("gothenburg");
      return { saved: localStorage.getItem(k), active: window.bruce.city.get() };
    }, STORAGE_KEY);
    check("3. set() sees a registry that rendered after boot", after, {
      saved: "gothenburg",
      active: "gothenburg",
    });
    await context.close();
  }

  // ── 4. An unknown slug is still rejected ───────────────────
  // The hardening in 3 must not turn set() into "write whatever you are given".
  {
    const { page, context } = await newPage();
    const after = await page.evaluate((k) => {
      window.bruce.city.set("atlantis");
      return { saved: localStorage.getItem(k), active: window.bruce.city.get() };
    }, STORAGE_KEY);
    check("4. unknown slug is ignored", after, { saved: null, active: null });
    await context.close();
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
console.log(`✓ city-switcher-dom: ${passed} assertions passed`);
