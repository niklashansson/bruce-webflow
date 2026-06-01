/**
 * Variables (Placeholder Replacement)
 *
 * Replaces {{key}} placeholders in text and common attributes across the page.
 * Supports scoped (per-ancestor) and global variables.
 *
 * Two namespaces:
 *   • `$`-prefixed keys (built-in dynamics like {{$year}}) resolve only
 *     against the module-level globals map — never the ancestor chain.
 *   • Everything else: nearest ancestor `data-var-{key}` wins, falling
 *     back to a `[data-variable-key]` element anywhere on the page.
 *
 * Unknown keys are left as-is so typos are visible in the published site.
 *
 * Usage in Webflow:
 *
 *   Global values (place anywhere — typically inside a hidden CMS collection):
 *     <div data-variable-key="company-name" data-variable-value="Bruce Studios"></div>
 *     <div data-variable-key="phone" data-variable-value="+46 31 ..."></div>
 *
 *   Scoped values — must use the data-var-* prefix so generic Webflow data
 *   attributes (data-loop, data-src, ...) can't collide with placeholders:
 *     <div data-var-author-name="Johan Andersson">
 *       <p>{{author-name}}</p>  →  Johan Andersson
 *     </div>
 *
 *   Built-in dynamics — reserved `$` prefix isolates them from user keys:
 *     <p>© {{$year}}</p>
 *
 *   Anywhere in text content:
 *     <p>Welcome to {{company-name}}. © {{$year}}</p>
 *
 *   In attributes (href, src, alt, title, aria-label, placeholder, value):
 *     <a href="mailto:{{email}}">Contact</a>
 *
 * Handles late-arriving content (async / CMS injection) via a
 * debounced re-scan + delayed safety passes.
 *
 * Loaded globally — no external dependencies.
 */

// ── Module-level constants ───────────────────────────────────

// Keys allow `$` so built-in dynamics like {{$year}} live in a reserved
// namespace that can't be shadowed by CMS-defined variables.
// PATTERN is `/g` (used by String.replace); HAS_PATTERN is the same expression
// without `/g` for stateless `.test()` checks — calling `.test()` on a `/g`
// regex advances lastIndex and can return inconsistent results across calls.
const PATTERN = /\{\{\s*([\$\w-]+)\s*\}\}/g;
const HAS_PATTERN = /\{\{\s*[\$\w-]+\s*\}\}/;

const BUILTIN_PREFIX = "$";

const ATTRS = [
  "href",
  "src",
  "alt",
  "title",
  "aria-label",
  "placeholder",
  "value",
];
const ATTR_SELECTOR = ATTRS.map((a) => `[${a}*="{{"]`).join(",");
const SAFETY_PASS_DELAYS = [500, 1500, 3500]; // ms

// Globals are seeded with `$`-prefixed built-ins so user-defined CMS keys
// can never shadow them. Populated further from [data-variable-key] on each
// pass to catch late-loaded items.
/** @type {Record<string, string>} */
const globals = {
  $year: String(new Date().getFullYear()),
};

// Originals of text nodes and attributes that ever contained {{...}}. process()
// always substitutes from the stored template, never from the current value —
// so calling setGlobal() after the first pass actually re-renders. Without
// this, the first pass would overwrite the placeholders and any subsequent
// re-scan would find nothing to replace.
/** @type {WeakMap<Text, string>} */
const textTemplates = new WeakMap();
/** @type {Map<Element, Record<string, string>>} */
const attrTemplates = new Map();

/**
 * Load global key/value pairs from any [data-variable-key] element on
 * the page. Idempotent — re-runs on each pass to catch late-loaded items.
 */
function loadGlobals() {
  document.querySelectorAll("[data-variable-key]").forEach((el) => {
    const key = el.getAttribute("data-variable-key");
    const value = el.getAttribute("data-variable-value");
    // First definition wins. Built-ins ($-prefixed) are seeded first so they
    // can't be silently replaced by a CMS item with the same key.
    if (key && !(key in globals)) {
      globals[key] = value ?? "";
    }
  });
}

/**
 * Resolve a {{key}} reference against scoped + global sources.
 *
 * Reserved-prefix keys (starting with `$`) are built-ins and bypass the
 * ancestor walk — they only resolve against the globals map.
 *
 * @param {string} key
 * @param {Node} node
 * @returns {string | null} The replacement value, or null if unresolved.
 */
function resolve(key, node) {
  if (key.startsWith(BUILTIN_PREFIX)) {
    return key in globals ? globals[key] : null;
  }

  const scopedAttr = `data-var-${key}`;

  /** @type {Element | null} */
  let el =
    node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement;

  while (el) {
    if (el.hasAttribute(scopedAttr)) {
      return el.getAttribute(scopedAttr) ?? "";
    }
    el = el.parentElement;
  }

  return key in globals ? globals[key] : null;
}

/**
 * Build a replacer function bound to a specific node for scope resolution.
 *
 * @param {Node} node
 * @returns {(match: string, key: string) => string}
 */
function replacer(node) {
  return (match, key) => {
    const value = resolve(key, node);
    return value !== null ? value : match; // leave unresolved keys visible
  };
}

// ── Core processing ──────────────────────────────────────────

/**
 * Scan the entire document body and replace any {{key}} placeholders found.
 * Idempotent: nothing without {{...}} is touched, so multiple passes are safe.
 *
 * Always scans from document.body rather than from MutationObserver-supplied
 * subtrees — CMS rendering often inserts a parent container, then populates its
 * children in subsequent mutations. A full-body scan sidesteps that race.
 */
function process() {
  // Accept a text node if it currently contains {{...}} (first-pass discovery)
  // OR if it's already tracked (so we revisit it on every re-scan to honour
  // updated globals — without this, a re-scan after substitution would skip
  // the node and setGlobal() couldn't reactively update the page).
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (n) => {
        const tn = /** @type {Text} */ (n);
        return HAS_PATTERN.test(n.nodeValue || "") || textTemplates.has(tn)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  /** @type {Text[]} */
  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(/** @type {Text} */ (n));

  for (const tn of textNodes) {
    let tmpl = textTemplates.get(tn);
    if (tmpl === undefined) {
      tmpl = tn.nodeValue || "";
      textTemplates.set(tn, tmpl);
    }
    const next = tmpl.replace(PATTERN, replacer(tn));
    if (next !== tn.nodeValue) tn.nodeValue = next;
  }

  // Attribute scan: union of elements that currently contain `{{` (first-pass
  // discovery) with elements we've previously tracked (so re-scans pick them
  // up after their attribute has been substituted and no longer matches the
  // `[attr*="{{"]` selector).
  /** @type {Set<Element>} */
  const elementsToProcess = new Set(document.querySelectorAll(ATTR_SELECTOR));
  for (const el of attrTemplates.keys()) elementsToProcess.add(el);

  for (const el of elementsToProcess) {
    let originals = attrTemplates.get(el);
    for (const attr of ATTRS) {
      const cur = el.getAttribute(attr);
      if (cur === null) continue;
      if (!originals || !(attr in originals)) {
        if (!cur.includes("{{")) continue;
        if (!originals) {
          originals = {};
          attrTemplates.set(el, originals);
        }
        originals[attr] = cur;
      }
      const next = originals[attr].replace(PATTERN, replacer(el));
      if (next !== cur) el.setAttribute(attr, next);
    }
  }
}

// ── Debounced re-process ─────────────────────────────────────
// Any relevant DOM change schedules a single rAF-deferred re-scan, so a
// burst of CMS mutations triggers one pass instead of N. `dirty` lets
// the safety-pass timers skip their work on pages that have settled.

let pendingRafId = 0;
let dirty = false;

const runProcess = () => {
  loadGlobals(); // in case the globals list itself was CMS-rendered
  process();
  dirty = false;
};

const scheduleProcess = () => {
  dirty = true;
  if (pendingRafId) return;
  pendingRafId = requestAnimationFrame(() => {
    pendingRafId = 0;
    runProcess();
  });
};

/**
 * Cheap pre-filter for the MutationObserver: only re-process if the added
 * subtree could plausibly affect placeholder resolution. Skips the constant
 * DOM churn from sliders, tabs, video players, etc.
 *
 * @param {Node} node
 */
function subtreeIsRelevant(node) {
  if (node.nodeType === 3) {
    return (node.nodeValue || "").includes("{{");
  }
  if (node.nodeType !== 1) return false;
  const el = /** @type {Element} */ (node);
  // Text-content placeholders are the common case.
  if ((el.textContent || "").includes("{{")) return true;
  // Attribute placeholders + new [data-variable-key] definitions are rarer
  // but possible — one CSS engine call each.
  if (el.matches(ATTR_SELECTOR) || el.querySelector(ATTR_SELECTOR)) return true;
  if (
    el.matches("[data-variable-key]") ||
    el.querySelector("[data-variable-key]")
  )
    return true;
  return false;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize variable replacement: load globals + run an initial pass.
 * Safe to call multiple times.
 */
export function initVariables() {
  runProcess();
}

/**
 * Manually trigger a re-scan (e.g. after injecting custom dynamic content).
 */
export function refreshVariables() {
  scheduleProcess();
}

/**
 * Programmatically set a global variable. Useful for runtime values
 * (user state, A/B test variant, geo) that can't live in CMS. Triggers
 * a full-document re-scan, so batch calls when possible.
 *
 * @param {string} key
 * @param {string} value
 */
export function setGlobal(key, value) {
  globals[key] = value;
  scheduleProcess();
}

// ── MutationObserver: catch late-arriving content ────────────
const mutationObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (subtreeIsRelevant(node)) {
        scheduleProcess();
        return;
      }
    }
  }
});

// ── Auto-boot ────────────────────────────────────────────────
const boot = () => {
  initVariables();
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(() => {
      if (dirty) runProcess();
    }, ms),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
