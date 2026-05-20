/**
 * Studios Search Redirect (off-page searchbar)
 *
 * The studios searchbar (free-text query + filter dropdowns) appears on pages
 * where `studios.js` does NOT run. On those pages the searchbar has nothing to
 * filter, so this module turns it into a redirect: it collects the typed query
 * plus every checked filter and sends the visitor to the search page with all
 * of it applied via URL params. Active-filter count badges are reflected via
 * the shared `studios-filter-count` util.
 *
 * On the live search page (`/s`) this module no-ops entirely — the searchbar
 * there is owned by `studios.js` + Finsweet, which drives the same count util.
 *
 * ── Webflow markup ───────────────────────────────────────────
 * Author the off-page searchbar as a form marked `data-studios-search`:
 *
 *   <form data-studios-search action="/s">
 *     <input type="search"   name="q">                       <!-- free text  -->
 *     <input type="radio"    name="tier"     value="BASE">    <!-- single group -->
 *     <input type="checkbox" name="city"     value="Bergen">  <!-- multi group  -->
 *     <input type="checkbox" name="category" value="Yoga">    <!-- multi group  -->
 *     <button type="submit">Search</button>
 *   </form>
 *
 *   - `data-studios-search` on the <form> is the bind marker.
 *   - `action` is the redirect path (defaults to `/s` if absent/empty).
 *   - Each filter input's `name` is the Finsweet field key (`city`, `category`,
 *     `tier` — i.e. the checkbox `fs-list-field` on the search page); its
 *     `value` is the filter value. Selection state is native `:checked`.
 *   - Single-value group → `radio`; multi-value group → `checkbox`.
 *   - Enter-to-submit and accessibility come from the native form.
 *   - Count badges / active-state styling: see `studios-filter-count.js` for
 *     the `data-search-count` / `data-search-group` hooks.
 *   - Optional clear controls: `[data-search-clear]` clears all groups,
 *     `[data-search-clear="city_equal"]` clears one. See "Clearing" below.
 *
 * ── URL format ───────────────────────────────────────────────
 * Clean, shareable params: each selected value is a `key=value` pair, with
 * repeated keys for multi-select — `/s?q=boxing&city=Bergen&city=Oslo&category=Yoga`.
 * The free-text query is a trimmed `q`. Empty groups and an empty query are
 * omitted; submitting with nothing set redirects to the bare action. On the
 * search page, `studios.js` reads these and applies them to the Finsweet
 * filters (which then takes over the URL in its own format).
 */

import { updateFilterCounts } from "./studios-filter-count.js";

const FORM_SELECTOR = "form[data-studios-search]";
const LIVE_COMPONENT_SELECTOR = '[data-studios-element="component"]';
const CLEAR_SELECTOR = "[data-search-clear]";
const QUERY_FIELD = "q";
const DEFAULT_ACTION = "/s";

/**
 * Serialize a searchbar form's fields into a clean URL query string (no leading
 * "?", already URL-encoded). Pure — depends only on its FormData argument.
 *
 * Each filter input's `name` is the Finsweet field key (`city`, `category`,
 * `tier`); multiple selected values become repeated keys
 * (`city=Bergen&city=Oslo`). The free-text query is `q`, trimmed and omitted
 * when empty. `studios.js` reads these on the search page and applies them to
 * the Finsweet filters.
 *
 * @param {FormData} formData
 * @returns {string}
 */
export function buildSearchQuery(formData) {
  const params = new URLSearchParams();

  const query = (formData.get(QUERY_FIELD) ?? "").toString().trim();
  if (query) params.set(QUERY_FIELD, query);

  // Append every non-query field's checked values in DOM order, so the URL is
  // stable and readable. Repeated keys carry multi-select groups.
  for (const [key, value] of formData.entries()) {
    if (key === QUERY_FIELD) continue;
    params.append(key, value.toString());
  }

  return params.toString();
}

/** @param {HTMLFormElement} form */
function handleSubmit(form, event) {
  event.preventDefault();
  const action = form.getAttribute("action") || DEFAULT_ACTION;
  const query = buildSearchQuery(new FormData(form));
  window.location.assign(query ? `${action}?${query}` : action);
}

// ── Clearing ─────────────────────────────────────────────────
// A click on `[data-search-clear]` unchecks filter options and refreshes the
// counts. Empty value clears every group; `data-search-clear="city_equal"`
// clears just that group. The text query is never touched. preventDefault keeps
// a clear button/link from submitting the form.

/**
 * @param {HTMLFormElement} form
 * @param {Element} trigger
 */
function handleClear(form, trigger) {
  const group = trigger.getAttribute("data-search-clear");
  const selector = group
    ? `input[name="${CSS.escape(group)}"]`
    : "input[type=checkbox], input[type=radio]";

  form.querySelectorAll(selector).forEach((el) => {
    const input = /** @type {HTMLInputElement} */ (el);
    if (input.type === "checkbox" || input.type === "radio") {
      input.checked = false;
    }
  });

  // Programmatic `.checked` changes don't fire `change`, so refresh directly.
  updateFilterCounts(form);
}

/** Initialize all off-page redirect forms. Safe to call multiple times. */
export function initStudiosSearchRedirect() {
  // The live search page owns its searchbar (Finsweet + studios.js).
  if (document.querySelector(LIVE_COMPONENT_SELECTOR)) return;

  document.querySelectorAll(FORM_SELECTOR).forEach((el) => {
    const form = /** @type {HTMLFormElement} */ (el);
    if (form.dataset.searchRedirectInit) return;
    form.dataset.searchRedirectInit = "true";

    form.addEventListener("submit", (event) => handleSubmit(form, event));
    form.addEventListener("change", () => updateFilterCounts(form));
    form.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(CLEAR_SELECTOR);
      if (!trigger) return;
      event.preventDefault();
      handleClear(form, trigger);
    });

    updateFilterCounts(form);
  });
}

// ── Auto-boot ────────────────────────────────────────────────
// Guarded so the module stays importable in Node (unit tests) where there is
// no `document`.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudiosSearchRedirect, {
      once: true,
    });
  } else {
    initStudiosSearchRedirect();
  }
}
