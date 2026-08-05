// DOM smoke tests for the dropdown top-layer portal and its tracking loop.
// Framework-free: run with `node tests/dropdown-dom.test.mjs`.
//
// Unlike the other files in tests/, these properties cannot be checked without
// a real layout engine: they are about the CSS cascade, the popover UA sheet,
// scrollbar gutters, ResizeObserver and rAF scheduling. So this file drives an
// ALREADY-INSTALLED Chrome over CDP (puppeteer-core, a devDependency — no
// bundled-browser download) against `src/` served over http://localhost, and
// imports the real modules. Nothing is copied, inlined or stubbed.
//
// If no Chrome can be found, or puppeteer-core is not installed, it prints a
// skip line and exits 0 so `node tests/*.test.mjs` keeps working everywhere.
//
// Point it at a different tree with DROPDOWN_SRC_DIR=/path/to/src — that is
// how the known-bad builds in the plan are re-checked.

import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(process.env.DROPDOWN_SRC_DIR || path.join(HERE, "..", "src"));

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

  // Last resort: ask the shell, for distro layouts not covered above.
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
if (!existsSync(path.join(SRC_DIR, "dropdown.js")))
  skip(`no dropdown.js under ${SRC_DIR}`);

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

// ── Static server + instrumented page shell ──────────────────
//
// The shell patches window/document/visualViewport addEventListener,
// ResizeObserver and requestAnimationFrame BEFORE importing the module, so
// every listener, observer and frame the module asks for is attributable.
// `?nopopover=1` deletes HTMLElement.prototype.showPopover first, which is the
// only way to exercise the CAN_PORTAL === false branch — it is read at module
// evaluation time.

const SHELL = `<!doctype html>
<meta charset="utf-8">
<title>dropdown harness</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  /* No document scrollbar, so the viewport box is the same on every platform. */
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
</style>
<body>
<script type="module">
if (new URLSearchParams(location.search).has("nopopover"))
  delete HTMLElement.prototype.showPopover;

const log = {
  win: { add: [], remove: [] },
  vv: { add: [], remove: [] },
  doc: { add: [], remove: [] },
  roConstructed: 0,
  rafCount: 0,
};
const roInstances = [];
window.__log = log;
window.__realRaf = window.requestAnimationFrame.bind(window);

function patch(target, bucket) {
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = function (type, fn, opts) { bucket.add.push(type); return add(type, fn, opts); };
  target.removeEventListener = function (type, fn, opts) { bucket.remove.push(type); return remove(type, fn, opts); };
}
patch(window, log.win);
patch(document, log.doc);
if (window.visualViewport) patch(window.visualViewport, log.vv);

const RealRO = window.ResizeObserver;
window.ResizeObserver = class extends RealRO {
  constructor(cb) { super(cb); this.__targets = new Set(); log.roConstructed++; roInstances.push(this); }
  observe(t, o) { this.__targets.add(t); return super.observe(t, o); }
  unobserve(t) { this.__targets.delete(t); return super.unobserve(t); }
  disconnect() { this.__targets.clear(); return super.disconnect(); }
};
window.__roObserved = () => roInstances.reduce((n, i) => n + i.__targets.size, 0);

const realRaf = window.requestAnimationFrame;
window.requestAnimationFrame = function (cb) { log.rafCount++; return realRaf.call(window, cb); };

// Tally helper: ["scroll","scroll","resize"] -> {scroll:2,resize:1}
window.__tally = (list) => list.reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});

window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Samples CONSECUTIVE animation frames. A two-state oscillation looks
// perfectly stable at any single sample phase, so single snapshots are
// worthless here. Uses the UNPATCHED rAF so the harness never inflates the
// module's own frame count.
window.__sampleFrames = (selector, n) => new Promise((resolve) => {
  const out = [];
  const step = () => {
    const c = document.querySelector(selector);
    out.push([c.style.top, c.style.maxHeight, c.style.overflow, c.scrollHeight, c.clientWidth].join("|"));
    if (out.length >= n) return resolve(out);
    window.__realRaf(step);
  };
  window.__realRaf(step);
});

window.__mount = (css, html) => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  window.__initDropdown();
};

const mod = await import("/src/dropdown.js");
window.__initDropdown = mod.initDropdown;
window.__ready = true;
</script>
`;

const MIME = { ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8" };

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
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scaling-factor=1"],
  // Puppeteer passes --hide-scrollbars in headless by default, which makes
  // EVERY scrollbar zero-width. That silently disarms assertion 6: the whole
  // oscillation depends on a scrollbar consuming layout width.
  ignoreDefaultArgs: ["--hide-scrollbars"],
});

/** A fresh instrumented page. Every scenario gets its own — module state
 *  (activeDropdown, the injected <style>, the zCounter) is module-global. */
async function newPage({ fallback = false, viewport = { width: 500, height: 600 } } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(`${BASE}/harness.html${fallback ? "?nopopover=1" : ""}`, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 10000 });
  return page;
}

const TOGGLE = '[data-dropdown-element="toggle"]';
const OPEN_SETTLE_MS = 350; // 200ms tween + slack for the settle callbacks

try {
  // ── 1. Authored styles survive portaling ───────────────────
  // Task 2, Critical 1: the first portal used a single :popover-open rule at
  // specificity (0,2,0), which beat the site's own Webflow classes and stripped
  // padding/background/border/colour/overflow off every panel it opened.
  {
    const page = await newPage();
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.w { position: relative; width: 300px; margin: 40px; }
       .authored {
         width: 260px;
         padding: 12px 16px;
         background-color: rgb(10, 20, 30);
         border: 2px solid rgb(200, 100, 50);
         color: rgb(240, 240, 240);
         overflow: hidden;
       }`,
      `<div data-dropdown-element="wrap" class="w">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="authored">
           <a href="#">one</a><a href="#">two</a>
         </div>
       </div>`,
    );
    await page.evaluate((s) => document.querySelector(s).click(), TOGGLE);
    await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS);
    const styles = await page.evaluate(() => {
      const c = document.querySelector(".authored");
      const s = getComputedStyle(c);
      return {
        padding: `${s.paddingTop} ${s.paddingLeft}`,
        background: s.backgroundColor,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        color: s.color,
        overflow: s.overflow,
        open: c.matches(":popover-open"),
      };
    });
    check(
      "1. authored padding/background/border/colour/overflow survive portaling",
      styles,
      {
        padding: "12px 16px",
        background: "rgb(10, 20, 30)",
        border: "2px solid rgb(200, 100, 50)",
        color: "rgb(240, 240, 240)",
        overflow: "hidden",
        open: true,
      },
    );
    await page.close();
  }

  // ── 2. The measurement window is clean ─────────────────────
  // Task 2, Critical 2: the UA [popover] rule applies the moment the attribute
  // is set — not gated on :popover-open — so portalOpen()'s width measurement
  // happened against `position: fixed`. An authored `width: 50%` then resolved
  // against the viewport, and an auto-width panel shrink-to-fit.
  {
    const page = await newPage();
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.mw { position: relative; width: 400px; }
       .m50 { width: 50%; }`,
      `<div data-dropdown-element="wrap" class="mw">
         <button data-dropdown-element="toggle">a</button>
         <div data-dropdown-element="content" class="m50"><a href="#">Item</a></div>
       </div>
       <div data-dropdown-element="wrap" class="mw">
         <button data-dropdown-element="toggle">b</button>
         <div data-dropdown-element="content" class="mauto"><a href="#">Item</a></div>
       </div>`,
    );
    // Reproduce portalOpen()'s measurement prelude exactly: inline display,
    // visibility, height and max-height, popover attribute set, showPopover()
    // NOT yet called.
    const measured = await page.evaluate(() => {
      const probe = (sel) => {
        const c = document.querySelector(sel);
        const enter = () => {
          c.style.visibility = "hidden";
          c.style.display = "block";
          c.style.height = "auto";
          c.style.maxHeight = "none";
        };
        enter();
        const withPopover = { position: getComputedStyle(c).position, width: c.offsetWidth };
        c.removeAttribute("popover");
        enter();
        const without = { position: getComputedStyle(c).position, width: c.offsetWidth };
        c.setAttribute("popover", "manual");
        return { withPopover, without };
      };
      return { fifty: probe(".m50"), auto: probe(".mauto") };
    });
    check(
      `2a. authored width:50% measures clean (with popover ${measured.fifty.withPopover.width}px, without ${measured.fifty.without.width}px)`,
      {
        position: measured.fifty.withPopover.position,
        sameWidth: measured.fifty.withPopover.width === measured.fifty.without.width,
      },
      { position: "static", sameWidth: true },
    );
    check(
      `2b. auto-width measures clean (with popover ${measured.auto.withPopover.width}px, without ${measured.auto.without.width}px)`,
      {
        position: measured.auto.withPopover.position,
        sameWidth: measured.auto.withPopover.width === measured.auto.without.width,
      },
      { position: "static", sameWidth: true },
    );
    await page.close();
  }

  // ── 3. Structural styles apply while open ──────────────────
  // The neutralising rule must not go so far that the panel stops being
  // positioned or stops being visible: :popover-open still owes us
  // position: fixed and display: block, the latter even over an authored
  // display: none (matching :popover-open does not imply rendered).
  {
    const page = await newPage();
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.w { position: relative; width: 300px; margin: 40px; }
       .hidden-panel { display: none; width: 200px; }`,
      `<div data-dropdown-element="wrap" class="w">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="hidden-panel">
           <a href="#">one</a><a href="#">two</a>
         </div>
       </div>`,
    );
    await page.evaluate((s) => document.querySelector(s).click(), TOGGLE);
    await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS);
    const structural = await page.evaluate(() => {
      const c = document.querySelector(".hidden-panel");
      const s = getComputedStyle(c);
      return { position: s.position, display: s.display, rendered: c.offsetHeight > 0 };
    });
    check(
      "3. an authored display:none panel opens fixed and block",
      structural,
      { position: "fixed", display: "block", rendered: true },
    );
    await page.close();
  }

  // ── 4. Flip and clamp ──────────────────────────────────────
  // The anchor sits 500px down a 600px viewport: 54px below it, 484px above.
  {
    const page = await newPage({ viewport: { width: 500, height: 600 } });
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.low { position: fixed; top: 500px; left: 20px; }
       .low button { display: block; height: 30px; width: 120px; }
       .fits { width: 200px; }
       .fits .item { height: 30px; }
       .huge { width: 200px; }
       .huge .item { height: 200px; }`,
      `<div data-dropdown-element="wrap" class="low">
         <button data-dropdown-element="toggle">flip</button>
         <div data-dropdown-element="content" class="fits">
           ${Array.from({ length: 10 }, () => '<div class="item"><a href="#">i</a></div>').join("")}
         </div>
       </div>
       <div data-dropdown-element="wrap" class="low">
         <button data-dropdown-element="toggle">clamp</button>
         <div data-dropdown-element="content" class="huge">
           ${Array.from({ length: 10 }, () => '<div class="item"><a href="#">i</a></div>').join("")}
         </div>
       </div>`,
    );

    const readPlacement = (panelSel, wrapSel) => {
      const c = document.querySelector(panelSel);
      const t = document.querySelector(`${wrapSel} [data-dropdown-element="toggle"]`);
      const cr = c.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      return {
        placement: c.closest("[data-dropdown-element=\"wrap\"]").getAttribute("data-dropdown-placement"),
        gapAboveAnchor: Math.round(tr.top - cr.bottom),
        height: Math.round(cr.height),
        top: Math.round(cr.top),
        scrolls: c.scrollHeight > c.clientHeight,
        overflow: getComputedStyle(c).overflow,
      };
    };

    await page.evaluate(() => document.querySelectorAll('[data-dropdown-element="toggle"]')[0].click());
    await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS);
    const flipped = await page.evaluate(readPlacement, ".fits", ".low:nth-of-type(1)");
    check(
      "4a. a panel that cannot fit below flips above with an 8px gap, unclamped",
      { ...flipped, overflow: undefined },
      {
        placement: "top",
        gapAboveAnchor: 8,
        height: 300,
        top: 192,
        scrolls: false,
        overflow: undefined,
      },
    );

    await page.evaluate(() => document.querySelectorAll('[data-dropdown-element="toggle"]')[1].click());
    await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS + 250);
    const clamped = await page.evaluate(readPlacement, ".huge", ".low:nth-of-type(2)");
    check(
      "4b. a panel that fits neither side is clamped to the larger side and scrolls",
      clamped,
      {
        placement: "top",
        gapAboveAnchor: 8,
        height: 484,
        top: 8,
        scrolls: true,
        overflow: "auto",
      },
    );
    await page.close();
  }

  // ── 5. Content changes re-place a settled panel ────────────
  // Task 3, Important: the ResizeObserver watched the panel, whose own border
  // box is capped by the inline max-height reposition() writes — so once a
  // panel clamped, the observer was inert for exactly the case it existed to
  // catch. It observes the panel's element children instead.
  {
    const page = await newPage({ viewport: { width: 500, height: 600 } });
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.low { position: fixed; top: 500px; left: 20px; }
       .low button { display: block; height: 30px; width: 120px; }
       .grow { width: 200px; }
       .grow .item { height: 30px; }`,
      `<div data-dropdown-element="wrap" class="low">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="grow">
           <div class="list">
             ${Array.from({ length: 10 }, () => '<div class="item"><a href="#">i</a></div>').join("")}
           </div>
         </div>
       </div>`,
    );
    await page.evaluate((s) => document.querySelector(s).click(), TOGGLE);
    await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS);
    const before = await page.evaluate(() => {
      const c = document.querySelector(".grow");
      return { top: c.style.top, maxHeight: c.style.maxHeight };
    });
    // Shrink the observed child, then let the observer -> rAF -> reposition
    // chain run.
    await page.evaluate(async () => {
      const list = document.querySelector(".grow .list");
      for (let i = 0; i < 5; i++) list.lastElementChild.remove();
      await window.__sleep(200);
    });
    const after = await page.evaluate(() => {
      const c = document.querySelector(".grow");
      const t = document.querySelector('[data-dropdown-element="toggle"]');
      const cr = c.getBoundingClientRect();
      return {
        top: c.style.top,
        maxHeight: c.style.maxHeight,
        gapAboveAnchor: Math.round(t.getBoundingClientRect().top - cr.bottom),
      };
    });
    check(
      `5. shrinking content re-places a settled top panel (top ${before.top} -> ${after.top}, max-height ${before.maxHeight} -> ${after.maxHeight})`,
      {
        topMoved: before.top !== after.top,
        maxHeightMoved: before.maxHeight !== after.maxHeight,
        top: after.top,
        maxHeight: after.maxHeight,
        gapAboveAnchor: after.gapAboveAnchor,
      },
      {
        topMoved: true,
        maxHeightMoved: true,
        top: "342px",
        maxHeight: "150px",
        gapAboveAnchor: 8,
      },
    );
    await page.close();
  }

  // ── 6. Reposition converges ────────────────────────────────
  // Task 3 fix round 1, Critical. On classic (space-consuming) scrollbars a
  // width-driven child creates a feedback loop: clamp -> overflow:auto ->
  // scrollbar -> child narrows -> child shortens -> fits -> unclamp ->
  // scrollbar goes -> child widens -> child grows -> clamp, once per frame,
  // forever, with no ResizeObserver-loop warning (the callback defers to rAF).
  // Invisible on macOS with overlay scrollbars, hence ::-webkit-scrollbar.
  {
    const page = await newPage({ viewport: { width: 500, height: 300 } });
    const OSC_CSS = `
      .top { position: fixed; top: 0; left: 0; }
      .top button { display: block; height: 20px; width: 120px; }
      .osc { width: 220px; }
      /* A styled scrollbar is a classic, space-consuming one — the platform
         default on macOS is an overlay scrollbar, which cannot oscillate. */
      .osc::-webkit-scrollbar { width: 15px; background: #eee; }
      .osc::-webkit-scrollbar-thumb { background: #999; }
      .sq { width: 100%; aspect-ratio: 1 / 1; background: linear-gradient(#ccc, #333); }`;
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      OSC_CSS,
      `<div data-dropdown-element="wrap" class="top">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="osc"><div class="sq"></div></div>
       </div>`,
    );

    // Measure the child's two heights rather than assuming a 15px gutter.
    const heights = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "osc";
      probe.style.cssText = "position:absolute;visibility:hidden;top:0;left:0;height:50px;";
      probe.innerHTML = '<div class="sq"></div>';
      document.body.appendChild(probe);
      probe.style.overflow = "visible";
      const unclamped = probe.scrollHeight;
      probe.style.overflow = "scroll";
      const withScrollbar = probe.clientWidth;
      probe.remove();
      return { unclamped, withScrollbar };
    });
    check(
      `6-setup. the oscillation geometry is real: classic scrollbar reserves ${heights.unclamped - heights.withScrollbar}px`,
      { gutter: heights.unclamped - heights.withScrollbar > 0 },
      { gutter: true },
    );

    // Available space below the anchor is viewportHeight - 36 (20px toggle,
    // 8px gap, 8px inset). Sweep it across the band between the child's
    // with-scrollbar and unclamped heights — a single size can converge by
    // luck.
    const lo = heights.withScrollbar;
    const hi = heights.unclamped;
    const sweep = [lo + 1, lo + 4, Math.round((lo + hi) / 2), hi - 1].filter(
      (s, i, a) => s > lo && s < hi && a.indexOf(s) === i,
    );
    check("6-setup. sweep brackets both heights", { sizes: sweep.length >= 3 }, { sizes: true });

    for (const space of sweep) {
      await page.setViewport({ width: 500, height: space + 36 });
      await page.evaluate((s) => document.querySelector(s).click(), TOGGLE);
      await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS + 300);
      const result = await page.evaluate(async () => {
        const before = window.__log.rafCount;
        const frames = await window.__sampleFrames(".osc", 12);
        await window.__sleep(800);
        return { frames, rafDelta: window.__log.rafCount - before, state: frames[frames.length - 1] };
      });
      check(
        `6. reposition converges with ${space}px available (state ${result.state}, ${result.rafDelta} module rAFs in ~1s)`,
        { distinctFrames: new Set(result.frames).size, settled: result.rafDelta <= 3 },
        { distinctFrames: 1, settled: true },
      );
      await page.evaluate((s) => document.querySelector(s).click(), TOGGLE);
      await page.evaluate((ms) => window.__sleep(ms), OPEN_SETTLE_MS);
    }
    await page.close();
  }

  // ── 7. Listeners net to zero ───────────────────────────────
  {
    const page = await newPage();
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.w { position: relative; width: 300px; margin: 40px; }
       .p { width: 200px; }`,
      `<div data-dropdown-element="wrap" class="w">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="p"><a href="#">one</a></div>
       </div>`,
    );
    const tallies = await page.evaluate(async (settle) => {
      const toggle = document.querySelector('[data-dropdown-element="toggle"]');
      for (let i = 0; i < 3; i++) {
        toggle.click();
        await window.__sleep(settle);
        toggle.click();
        await window.__sleep(settle);
      }
      const { win, vv } = window.__log;
      return {
        winAdd: window.__tally(win.add),
        winRemove: window.__tally(win.remove),
        vvAdd: window.__tally(vv.add),
        vvRemove: window.__tally(vv.remove),
        observed: window.__roObserved(),
      };
    }, OPEN_SETTLE_MS);
    check(
      "7a. window scroll/resize listeners net to zero over 3 open/close cycles",
      { add: tallies.winAdd, remove: tallies.winRemove },
      { add: { scroll: 3, resize: 3 }, remove: { scroll: 3, resize: 3 } },
    );
    check(
      "7b. visualViewport listeners net to zero over 3 open/close cycles",
      { add: tallies.vvAdd, remove: tallies.vvRemove },
      { add: { resize: 3, scroll: 3 }, remove: { resize: 3, scroll: 3 } },
    );
    check(
      "7c. the ResizeObserver's observed target count returns to zero",
      { observed: tallies.observed },
      { observed: 0 },
    );
    await page.close();
  }

  // ── 8. The fallback path attaches nothing ──────────────────
  {
    const page = await newPage({ fallback: true });
    await page.evaluate(
      (css, html) => window.__mount(css, html),
      `.w { position: relative; width: 300px; margin: 40px; }
       .p { width: 200px; }`,
      `<div data-dropdown-element="wrap" class="w">
         <button data-dropdown-element="toggle">t</button>
         <div data-dropdown-element="content" class="p"><a href="#">one</a></div>
       </div>`,
    );
    const fallback = await page.evaluate(async (settle) => {
      const toggle = document.querySelector('[data-dropdown-element="toggle"]');
      const panel = document.querySelector(".p");
      toggle.click();
      await window.__sleep(settle);
      const opened = {
        expanded: toggle.getAttribute("aria-expanded"),
        display: getComputedStyle(panel).display,
        rendered: panel.offsetHeight > 0,
      };
      toggle.click();
      await window.__sleep(settle);
      const closed = {
        expanded: toggle.getAttribute("aria-expanded"),
        display: getComputedStyle(panel).display,
      };
      return {
        opened,
        closed,
        canPortal: "showPopover" in HTMLElement.prototype,
        hasPopoverAttr: panel.hasAttribute("popover"),
        winAdds: window.__log.win.add.length,
        vvAdds: window.__log.vv.add.length,
        roConstructed: window.__log.roConstructed,
        docAdds: window.__tally(window.__log.doc.add),
      };
    }, OPEN_SETTLE_MS);
    check(
      "8a. with showPopover deleted, no window/visualViewport listeners and no ResizeObserver",
      {
        canPortal: fallback.canPortal,
        hasPopoverAttr: fallback.hasPopoverAttr,
        winAdds: fallback.winAdds,
        vvAdds: fallback.vvAdds,
        roConstructed: fallback.roConstructed,
      },
      { canPortal: false, hasPopoverAttr: false, winAdds: 0, vvAdds: 0, roConstructed: 0 },
    );
    check(
      "8b. the shared dismissal listeners still attach, and only those",
      fallback.docAdds,
      { click: 1, keydown: 1 },
    );
    check(
      "8c. the dropdown still opens and closes on the fallback path",
      { opened: fallback.opened, closed: fallback.closed },
      {
        opened: { expanded: "true", display: "block", rendered: true },
        closed: { expanded: "false", display: "none" },
      },
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} of ${passed + failures.length} assertions failed\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`✓ all ${passed} assertions passed`);
