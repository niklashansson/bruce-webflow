/**
 * City Links
 *
 * Auto-resolves plain in-site gateway links (e.g. /memberships, /studios and
 * their localized variants) to the active city's CMS page. Webflow renders the
 * real, fully-localized URLs into hidden source elements; this module copies
 * the right one onto every matching <a>. Pure match/compose logic lives in
 * city-links-plan.js.
 *
 * Source data (rendered in the global component, every page + locale):
 *   [data-city-gateway="<section>"]                  — anchor; localized gateway path
 *   [data-city-link-list="<section>"]                — Collection List wrapper
 *     [data-city-link-item][data-city-link-key][href] — city slug → localized URL
 *
 * Opt-out: <a data-city-link-skip> is never rewritten (keeps it pointing at the
 * neutral gateway, e.g. a "Browse all cities" link).
 *
 * Same DOM-shell role as city-context.js; pure logic lives in city-links-plan.js.
 */

import { matchSection, resolveHref } from "./city-links-plan.js";

const SAFETY_PASS_DELAYS = [500, 1500, 3500];

/** @type {WeakMap<HTMLAnchorElement, {section: string, search: string, hash: string}>} */
const managed = new WeakMap();

// ── Read source data ─────────────────────────────────────────

function readGateways() {
  /** @type {Record<string,string>} */
  const out = {};
  document.querySelectorAll("[data-city-gateway]").forEach((el) => {
    const section = el.getAttribute("data-city-gateway")?.trim();
    const href = el.getAttribute("href");
    if (section && href) out[section] = new URL(href, location.origin).pathname;
  });
  return out;
}

function readLinkMap() {
  /** @type {Record<string,Record<string,string>>} */
  const out = {};
  document.querySelectorAll("[data-city-link-list]").forEach((list) => {
    const section = list.getAttribute("data-city-link-list")?.trim();
    if (!section) return;
    const map = (out[section] ||= {});
    list.querySelectorAll("[data-city-link-item]").forEach((a) => {
      const key = a.getAttribute("data-city-link-key")?.trim();
      const href = a.getAttribute("href");
      if (key && href) map[key] = new URL(href, location.origin).pathname;
    });
  });
  return out;
}

// ── Apply ────────────────────────────────────────────────────

function apply(active) {
  const gateways = readGateways();
  if (Object.keys(gateways).length === 0) return; // sources not rendered yet
  const linkMap = readLinkMap();

  document.querySelectorAll("a[href]").forEach((el) => {
    const a = /** @type {HTMLAnchorElement} */ (el);
    if (a.hasAttribute("data-city-link-skip")) return;
    // Ignore our own source elements (gateway anchors + list items).
    if (a.closest("[data-city-link-list], [data-city-gateway]")) return;

    let entry = managed.get(a);
    if (!entry) {
      let url;
      try {
        url = new URL(a.getAttribute("href"), location.origin);
      } catch {
        return; // non-parseable href (mailto:, tel:, javascript:) — skip
      }
      const section = matchSection(url.pathname, gateways);
      if (!section) return; // not a gateway link
      entry = { section, search: url.search, hash: url.hash };
      managed.set(a, entry);
    }

    a.setAttribute("href", resolveHref(entry, { gateways, linkMap, active }));
  });
}

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  // onChange fires immediately if the chain has already resolved, and on every
  // later switch. Safety passes re-run apply so late-rendered CMS lists settle.
  /** @type {any} */ (window).bruce?.city?.onChange?.(apply);
  SAFETY_PASS_DELAYS.forEach((ms) =>
    setTimeout(
      () => apply(/** @type {any} */ (window).bruce?.city?.get?.() ?? null),
      ms,
    ),
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
