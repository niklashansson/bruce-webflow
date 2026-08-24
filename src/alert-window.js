/**
 * Alert banner date-window filtering (KIN-102).
 *
 * Studio template pages carry two alert banner slots synced from the Bruce
 * Partner API. Webflow Designer already handles existence ("Alert N Message is
 * set") and styling (CRITICAL vs INFO variant); this module only hides banners
 * whose date window doesn't cover now. Webflow's date conditions are
 * day-granular, which is why the timestamp comparison lives here.
 *
 * Each alert element carries Designer custom attributes bound to its slot's
 * CMS fields:
 *   data-alert-start  ISO 8601 UTC timestamp, "" when unset
 *   data-alert-end    ISO 8601 UTC timestamp, "" when unset (most alerts —
 *                     empty means "show indefinitely")
 *
 * Selection is attribute-based (not class/page-scoped) so both slots and any
 * future page reusing the component are covered; pages without the attributes
 * no-op. Banners are server-rendered by Webflow, so one pass on DOM ready is
 * enough — no observers. The inline display:none beats Webflow's class-driven
 * display values, and a hidden banner never has to reappear within a page
 * view.
 */

import { decideAlertVisible } from "./alert-window-decide.js";

const SELECTOR = "[data-alert-start], [data-alert-end]";

function init() {
  const now = new Date();
  document.querySelectorAll(SELECTOR).forEach((el) => {
    const visible = decideAlertVisible(
      el.getAttribute("data-alert-start"),
      el.getAttribute("data-alert-end"),
      now,
    );
    if (!visible) el.style.display = "none";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
