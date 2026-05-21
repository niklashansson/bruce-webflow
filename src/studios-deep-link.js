/**
 * Pure decision helpers for the inbound deep-link filter replay in studios.js.
 *
 * Kept framework-free (no DOM, no globals) so the "should we replay at all, and
 * which duplicate copy do we click?" rules live in one unit-testable place —
 * mirroring how `tallyCheckedFilters` lives in studios-filter-count.js. The DOM
 * wiring stays in studios.js `applyUrlDeepLinkFilters`.
 */

/**
 * Whether the inbound deep-link replay should run for this navigation type.
 *
 * On a back/forward navigation Finsweet restores its OWN filter state from the
 * URL it took over after the first apply. Replaying our URL params on top then
 * clicks a duplicate copy of an option Finsweet already checked — and two
 * checked copies of the same value make Finsweet read it twice, breaking
 * toggling (the "BLACK | BLACK" desync). The race between Finsweet's restore
 * and our replay is what made filtering intermittently wrong after going
 * back/forward. So only replay on a genuine inbound navigation or an explicit
 * reload; let Finsweet own restoration on back/forward.
 *
 * @param {string} navigationType - PerformanceNavigationTiming.type
 *   ("navigate" | "reload" | "back_forward" | "prerender").
 * @returns {boolean}
 */
export function shouldApplyDeepLinkFilters(navigationType) {
  return navigationType !== "back_forward";
}

/**
 * Given the duplicate copies of ONE filter option (the modal / nav / toolbar
 * triplet Finsweet never syncs), return the index to click, or -1 to leave
 * them alone.
 *
 * Skips entirely when ANY copy is already checked: the filter model already
 * holds that condition (the user, Finsweet's URL restore, or the browser's
 * form restoration checked one), so clicking another copy would register the
 * value a second time and desync. Otherwise prefers the copy inside the
 * visible toolbar dropdown (`inSearchGroup`) so the selection shows where the
 * user looks, falling back to the first copy.
 *
 * @param {{ checked: boolean, inSearchGroup: boolean }[]} copies
 * @returns {number} index into `copies`, or -1
 */
export function pickDeepLinkClickIndex(copies) {
  if (copies.length === 0) return -1;
  if (copies.some((c) => c.checked)) return -1;
  const grouped = copies.findIndex((c) => c.inSearchGroup);
  return grouped === -1 ? 0 : grouped;
}
