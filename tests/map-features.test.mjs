// DOM tests for the shared map render engine's pure helpers (src/map-render.js).
// Framework-free: run with `node tests/map-features.test.mjs`.
//
// These lock the behaviour that moved OUT of explorer.js when the marker /
// popup / cluster / camera layer was extracted, so the same contract keeps
// holding for every surface that renders CMS-authored pins. The camera and the
// live markers need a real Mapbox instance and are verified in the browser, not
// here; what IS covered is everything that runs before Mapbox is involved:
//
//   extractFeatures  — which CMS items become map features, and which are
//                      dropped (missing fields, unparseable or 0,0 coords)
//   cloneTemplate    — the marker/popup clone is detached from the source card
//                      and stripped of ids + BOTH hook namespaces, so a clone on
//                      the map can never match a template query, and hiding a
//                      template in Designer can't hide its clones
//   pointKey         — the stable marker identity used to move (not recreate)
//                      markers across renders
//   getClusterSizeTier — the count → `data-size` bucketing the Webflow embed
//                      styles against
//
// Like tests/explorer-exclusive-dom.test.mjs this drives an ALREADY-INSTALLED
// Chrome over CDP (puppeteer-core, a devDependency — no bundled-browser
// download) and imports the real module. Nothing is copied, inlined or stubbed.
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
if (!existsSync(path.join(SRC_DIR, "map-render.js")))
  skip(`no map-render.js under ${SRC_DIR}`);

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
// A trimmed copy of the shipped studio card: the coordinate/id fields Webflow
// binds, plus the marker and popup the CMS item carries for its own pin. Six
// items cover the accepted case and every documented rejection.

function card(id, attrs) {
  const {
    lat = null,
    lng = null,
    studioId = null,
    marker = true,
    popup = true,
  } = attrs;
  return `
  <div class="card" id="${id}">
    ${lat === null ? "" : `<div data-explorer-field="studio-lat">${lat}</div>`}
    ${lng === null ? "" : `<div data-explorer-field="studio-lng">${lng}</div>`}
    ${studioId === null ? "" : `<div data-explorer-field="studio-id"> ${studioId} </div>`}
    ${
      marker
        ? `<div data-explorer-element="studio-marker" id="${id}-marker" style="display:none">
             <span data-explorer-element="studio-marker-inner"
                   data-map-element="nested-hook" id="${id}-inner">pin</span>
           </div>`
        : ""
    }
    ${popup ? `<div data-explorer-element="studio-popup">${id} popup</div>` : ""}
  </div>`;
}

const SHELL = `<!doctype html>
<meta charset="utf-8">
<title>map-render helpers harness</title>
<body>
<div id="items">
  ${card("ok", { lat: "59.9139", lng: "10.7522", studioId: "studio-a" })}
  ${card("noid", { lat: "1.5", lng: "2.5" })}
  ${card("zero", { lat: "0", lng: "0", studioId: "studio-zero" })}
  ${card("nan", { lat: "not-a-number", lng: "10", studioId: "studio-nan" })}
  ${card("nomarker", { lat: "5", lng: "6", studioId: "studio-nm", marker: false })}
  ${card("nolat", { lng: "6", studioId: "studio-nolat" })}
</div>
<script type="module">
import {
  extractFeatures,
  cloneTemplate,
  pointKey,
  getClusterSizeTier,
} from "/src/map-render.js";

const cards = (...ids) => ids.map((i) => document.getElementById(i));

window.__extract = (...ids) =>
  extractFeatures(cards(...ids)).map((f) => ({
    coordinates: f.coordinates,
    id: f.id,
    key: pointKey(f),
    hasPopup: Boolean(f.popupEl),
  }));

// Clone the "ok" card's marker and report what survived the strip.
window.__clone = () => {
  const source = document.getElementById("ok-marker");
  const clone = cloneTemplate(source);
  document.body.appendChild(clone);
  return {
    text: clone.textContent.trim(),
    display: clone.style.display,
    hasId: clone.hasAttribute("id"),
    innerHasId: Boolean(clone.querySelector("[id]")),
    hasHook: clone.hasAttribute("data-explorer-element"),
    innerHasHook: Boolean(clone.querySelector("[data-explorer-element]")),
    // The other hook namespace must go too: a cluster template is found by
    // data-map-element, and a clone that kept it would be hidden by whatever
    // CSS hides the template.
    innerHasMapHook: Boolean(clone.querySelector("[data-map-element]")),
    // The source card must be untouched — it is still CMS-bound content.
    sourceStillInCard: document.getElementById("ok-marker") !== null,
    sourceStillHidden:
      document.getElementById("ok-marker").style.display === "none",
    // A clone must never be found by a template query.
    templateQueryCount: document.querySelectorAll(
      '[data-explorer-element="studio-marker"]',
    ).length,
  };
};

window.__cloneNull = () => cloneTemplate(null);

window.__tiers = (counts) => counts.map(getClusterSizeTier);

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

/** A fresh page per scenario — map-render.js memoises per module instance. */
async function newPage() {
  const page = await browser.newPage();
  await page.goto(`${BASE}/harness.html`, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 10000 });
  return page;
}

try {
  // ── 1. A complete card becomes a feature ───────────────────────────
  // Coordinates are [lng, lat] — Mapbox order, NOT the CMS field order — and
  // the id is trimmed so whitespace in the Webflow binding can't fork the key.
  {
    const page = await newPage();
    check(
      "1. a complete card extracts as [lng, lat] with a trimmed id",
      await page.evaluate(() => window.__extract("ok")),
      [
        {
          coordinates: [10.7522, 59.9139],
          id: "studio-a",
          key: "studio-a",
          hasPopup: true,
        },
      ],
    );
    await page.close();
  }

  // ── 2. Every documented rejection is dropped ───────────────────────
  // 0,0 is the CMS "no coordinates" sentinel; without this the studio lands in
  // the Gulf of Guinea and drags the fitBounds camera out to sea with it.
  {
    const page = await newPage();
    check(
      "2. 0,0 / unparseable / marker-less / field-less cards are all skipped",
      await page.evaluate(() =>
        window.__extract("zero", "nan", "nomarker", "nolat"),
      ),
      [],
    );
    await page.close();
  }

  // ── 3. Mixed input keeps the good ones, in order ───────────────────
  {
    const page = await newPage();
    check(
      "3. a mixed set yields only the valid features, in DOM order",
      await page.evaluate(() =>
        window.__extract("zero", "ok", "nomarker", "noid"),
      ),
      [
        {
          coordinates: [10.7522, 59.9139],
          id: "studio-a",
          key: "studio-a",
          hasPopup: true,
        },
        { coordinates: [2.5, 1.5], id: "", key: "2.5,1.5", hasPopup: true },
      ],
    );
    await page.close();
  }

  // ── 4. An id-less card falls back to a coordinate key ──────────────
  // pointKey is the marker's identity across renders; two id-less studios at
  // the same spot are genuinely the same marker, which is the intended collapse.
  {
    const page = await newPage();
    check(
      "4. pointKey falls back to the coordinate pair when the id is empty",
      await page.evaluate(() => window.__extract("noid")[0].key),
      "2.5,1.5",
    );
    await page.close();
  }

  // ── 5. The clone is detached, visible, and un-findable ─────────────
  // The stripping is what stops a marker already on the map from matching the
  // template query on the next render — the bug that would clone clones.
  {
    const page = await newPage();
    check(
      "5. cloneTemplate strips ids + hooks, unhides, and leaves the source card intact",
      await page.evaluate(() => window.__clone()),
      {
        text: "pin",
        display: "",
        hasId: false,
        innerHasId: false,
        hasHook: false,
        innerHasHook: false,
        innerHasMapHook: false,
        sourceStillInCard: true,
        sourceStillHidden: true,
        templateQueryCount: 5, // the five authored markers, never the clone
      },
    );
    await page.close();
  }

  // ── 6. A missing template is null, not a throw ─────────────────────
  // Callers rely on this: `const el = cloneTemplate(x); if (!el) return;`
  {
    const page = await newPage();
    check(
      "6. cloneTemplate(null) returns null instead of throwing",
      await page.evaluate(() => window.__cloneNull()),
      null,
    );
    await page.close();
  }

  // ── 7. Cluster size tiers bucket on the documented boundaries ──────
  {
    const page = await newPage();
    check(
      "7. getClusterSizeTier buckets sm/md/lg/xl on <10 / <50 / <200 / rest",
      await page.evaluate(() =>
        window.__tiers([1, 9, 10, 49, 50, 199, 200, 5000]),
      ),
      ["sm", "sm", "md", "md", "lg", "lg", "xl", "xl"],
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
console.log(`✓ map-render helpers: ${passed} checks passed`);
