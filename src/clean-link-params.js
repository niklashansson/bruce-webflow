/**
 * Clean Link Params
 *
 * Strips empty query params from links whose href is assembled in a Webflow
 * code embed (e.g. the Clickable component's signup link). Embeds cannot
 * conditionally include a param, so unset component properties render as
 * `&campaign-code=` — this module removes them client-side on load. Pure
 * logic lives in clean-link-params-plan.js.
 *
 * Markup contract (either attribute on the <a> opts it in):
 *   <a data-bruce-id="…" href="…?tier=gold&campaign-code=">   — existing embed anchors
 *   <a data-clean-params href="…?tier=gold&campaign-code=">   — explicit marker for new embeds
 *
 * Only empty params are removed; the href is otherwise left alone. Links
 * cleaned once are claimed and skipped on later safety passes.
 */

import { stripEmptyParams } from "./clean-link-params-plan.js";

const SAFETY_PASS_DELAYS = [500, 1500, 3500];

const applied = new WeakSet();

function cleanLink(link) {
  if (applied.has(link)) return;
  applied.add(link);

  const href = link.getAttribute("href");
  const cleaned = stripEmptyParams(href, location.origin);
  if (cleaned != null) link.setAttribute("href", cleaned);
}

function run() {
  document
    .querySelectorAll("a[data-bruce-id], a[data-clean-params]")
    .forEach(cleanLink);
}

// ── Boot ─────────────────────────────────────────────────────

const boot = () => {
  run();
  // Safety passes re-scan for late-rendered CMS items; applied elements are no-ops.
  SAFETY_PASS_DELAYS.forEach((ms) => setTimeout(run, ms));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
