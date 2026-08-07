/**
 * Nearby Plan — pure helper for the explorer's "Show studios in nearby areas"
 * switch.
 *
 * Framework-free (no DOM, no imports) so the inversion and the N-way sync are
 * unit-testable in Node. The DOM applier lives in explorer.js. (Same split as
 * city-links-plan.js ↔ city-links.js.)
 *
 * A Finsweet condition input only contributes while it is CHECKED, but the
 * behaviour we want is the opposite shape: the `in-metro equal true` condition
 * has to be active while the visible switch is OFF. So the state is split
 * across two inputs that are always inverses of each other —
 *
 *     toggle.checked === !source.checked
 *
 * — and this function decides, for one refresh, what every input should be.
 * Spec: docs/superpowers/specs/2026-08-07-explorer-nearby-toggle-design.md
 */

/**
 * @param {object} state
 * @param {boolean[]} state.toggles      current .checked of each visible toggle
 * @param {boolean[]} state.sources      current .checked of each hidden source
 * @param {"toggle"|"source"|null} state.originKind  what caused this refresh
 * @param {number} state.originIndex     index into `toggles`, when originKind is "toggle"
 * @param {boolean} [state.clearPending] a global "Clear all" is in flight
 * @returns {{toggles: boolean[], sources: boolean[], nearby: boolean}}
 */
export function planNearby({
  toggles,
  sources,
  originKind,
  originIndex,
  clearPending = false,
}) {
  // "Clear all" returns the page to its defaults, and the default is
  // metro-only. Without this, Finsweet's clear would leave the source
  // unchecked — a cleared state that differs from the initial state.
  // Beats every other branch, including a toggle the user just flipped.
  const nearby = clearPending
    ? false
    : originKind === "toggle" && originIndex >= 0 && originIndex < toggles.length
      ? // The user acted on a visible switch: it is the intent, and the
        // sources follow it inverted.
        toggles[originIndex]
      : // Everything else — Finsweet's afterRender, URL restore, first paint.
        // The first source in DOM order is canonical; it is what Finsweet
        // persists to the URL. No sources authored at all → the default.
        sources.length > 0 && !sources[0];

  return {
    toggles: toggles.map(() => nearby),
    sources: sources.map(() => !nearby),
    nearby,
  };
}
