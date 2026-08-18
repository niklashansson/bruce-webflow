/**
 * City Switcher
 *
 * In-place ambient switching on pages without a city URL variant. Any element
 * with `data-set-city="<slug>"` becomes a switcher; `data-set-city=""` resets
 * to neutral. Active switchers are flagged `data-city-active="true"` for
 * styling, kept in sync with the live active city.
 *
 * Switching BETWEEN city pages (e.g. /studios/city/sto → …/cph) does not use
 * this module — those are plain CMS anchor links to each city's page, and the
 * destination page's data-city-lock resolves everything.
 *
 * Delegated listeners cover static + CMS-injected switchers. Keyboard
 * activation is added for non-native triggers (role="button"); native
 * <button>/<a> already fire click on Enter/Space.
 */

function syncActive(active) {
  document.querySelectorAll("[data-set-city]").forEach((el) => {
    /** @type {HTMLElement} */ (el).dataset.cityActive =
      el.getAttribute("data-set-city") === (active ?? "") ? "true" : "false";
  });
}

/**
 * Is this click headed somewhere? A switcher can also be a real link — a
 * gateway city-picker card sets the city AND navigates to the destination
 * (e.g. the autumn-campaign gateway → that city's country campaign page,
 * which carries no data-city-lock of its own). Suppressing the default there
 * would strand the visitor on the picker. Hash-only hrefs don't count: those
 * are in-place switchers wearing a link's clothes.
 */
function navigates(target) {
  const href = /** @type {Element|null} */ (target)
    ?.closest?.("a[href]")
    ?.getAttribute("href")
    ?.trim();
  return !!href && !href.startsWith("#");
}

function handle(e) {
  const trigger = /** @type {Element|null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger) return;
  // writeSaved() inside set() is synchronous localStorage, so the pick is
  // durable before the browser unloads the page.
  if (!navigates(e.target)) e.preventDefault();
  /** @type {any} */ (window).bruce?.city?.set(
    trigger.getAttribute("data-set-city") ?? "",
  );
}

document.addEventListener("click", handle);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const trigger = /** @type {Element|null} */ (e.target)?.closest?.(
    "[data-set-city]",
  );
  if (!trigger || trigger.tagName === "BUTTON" || trigger.tagName === "A") return;
  handle(e);
});

const boot = () => {
  /** @type {any} */ (window).bruce?.city?.onChange?.(syncActive);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
