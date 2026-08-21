// DOM smoke test for directions.js: link upgrade, per-link override, stored
// preference via the chooser, and MutationObserver pickup of inserted links.
// Framework-free: drives an installed Chrome over CDP like dropdown-dom.test.mjs;
// skips (exit 0) when no Chrome / puppeteer-core is available.
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(HERE, "..", "src");

function skip(reason) {
  console.log(`- skipped: ${reason}`);
  process.exit(0);
}
function findChrome() {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  };
  for (const p of candidates[process.platform] || []) if (existsSync(p)) return p;
  return null;
}
const chromePath = findChrome();
if (!chromePath) skip("no installed Chrome found");
let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  skip("puppeteer-core not installed");
}

const HTML = `<!doctype html><meta charset="utf-8">
<a id="a" href="https://example.com/static" data-directions
   data-directions-lat="55.6" data-directions-lng="13.0" data-directions-name="Bruce Malmö">A</a>
<a id="b" href="#" data-directions data-directions-provider="waze"
   data-directions-lat="55.6" data-directions-lng="13.0">B</a>
<a id="c" href="https://example.com/keep" data-directions data-directions-lat="oops" data-directions-lng="13.0">C</a>
<a id="p" href="#" data-directions data-directions-mode="place"
   data-directions-lat="55.6" data-directions-lng="13.0" data-directions-name="Bruce">P</a>
<button id="choose" data-directions-choose="apple">Apple</button>
<div id="host"></div>
<script type="module" src="/directions.js"></script>`;

const server = http.createServer((req, res) => {
  if (req.url === "/") return res.setHeader("content-type", "text/html").end(HTML);
  const file = path.join(SRC_DIR, req.url.split("?")[0]);
  if (!file.startsWith(SRC_DIR) || !existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", "text/javascript");
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
let passed = 0;
const check = (label, actual, expected) => { assert.equal(actual, expected, label); passed++; };
try {
  const page = await browser.newPage();
  // Force a non-Apple UA so the platform default is deterministic.
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120");
  await page.goto(base, { waitUntil: "networkidle0" });
  const href = (id) => page.$eval(`#${id}`, (el) => el.getAttribute("href"));

  check("platform default (Google) rewrites href", await href("a"), "https://www.google.com/maps/dir/?api=1&destination=55.6%2C13");
  check("per-link provider override", await href("b"), "https://waze.com/ul?ll=55.6%2C13&navigate=yes");
  check("place mode (Google)", await href("p"), "https://www.google.com/maps/search/?api=1&query=55.6%2C13");
  check("invalid coords leave authored href", await href("c"), "https://example.com/keep");

  await page.click("#choose");
  check("chooser stores + re-upgrades", await href("a"), "https://maps.apple.com/?daddr=55.6%2C13&dirflg=d&q=Bruce+Malm%C3%B6");
  check("override still wins after choice", await href("b"), "https://waze.com/ul?ll=55.6%2C13&navigate=yes");
  check("place mode follows chosen provider", await href("p"), "https://maps.apple.com/?ll=55.6%2C13&q=Bruce");
  check("preference persisted", await page.evaluate(() => localStorage.getItem("bruce:mapProvider")), "apple");

  await page.evaluate(() => {
    document.getElementById("host").innerHTML =
      '<div><a id="d" href="#" data-directions data-directions-lat="59.3" data-directions-lng="18.1">D</a></div>';
  });
  await new Promise((r) => setTimeout(r, 50));
  check("inserted link picked up by observer", await href("d"), "https://maps.apple.com/?daddr=59.3%2C18.1&dirflg=d");

  await page.reload({ waitUntil: "networkidle0" });
  check("stored preference survives reload", await href("a"), "https://maps.apple.com/?daddr=55.6%2C13&dirflg=d&q=Bruce+Malm%C3%B6");

  console.log(`✓ directions DOM: ${passed} checks passed`);
} finally {
  await browser.close();
  server.close();
}
