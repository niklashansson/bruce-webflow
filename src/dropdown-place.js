/**
 * Pure placement helper for dropdown.js. Framework-free (no DOM, no globals)
 * so the flip / shift / clamp rules live in one unit-testable place.
 *
 * Everything is plain numbers in CLIENT coordinates — the same space
 * getBoundingClientRect() reports in. The caller measures and applies; this
 * only decides.
 *
 * Rules, in order:
 *   1. Prefer below the anchor. If the panel's natural height fits there, done.
 *   2. Otherwise try above. If it fits there, flip.
 *   3. If it fits neither, take whichever side has more room and clamp the
 *      height to it — the caller scrolls the overflow inside the panel.
 *   4. Left-align to the anchor, then slide horizontally to stay inside the
 *      viewport's inset box.
 *
 * @param {object} input
 * @param {{top: number, bottom: number, left: number, width: number}} input.anchor
 *   Client rect of the toggle.
 * @param {{width: number, height: number}} input.panel
 *   The panel's NATURAL size — measured unconstrained, before any clamping.
 * @param {{top: number, left: number, width: number, height: number}} input.viewport
 *   The visible band, in client coordinates. With a soft keyboard open this is
 *   the visual viewport: shorter than, and possibly offset from, the layout one.
 * @param {number} [input.gap=8] Space between the anchor and the panel.
 * @param {number} [input.inset=8] Minimum space between the panel and the
 *   viewport edge.
 * @returns {{placement: "bottom" | "top", top: number, left: number, maxHeight: number}}
 */
export function place({ anchor, panel, viewport, gap = 8, inset = 8 }) {
  const viewportBottom = viewport.top + viewport.height;
  const viewportRight = viewport.left + viewport.width;

  // Room available to the panel on each side, with the gap and the edge inset
  // already deducted. Goes negative when the anchor sits outside the viewport.
  const spaceBelow = viewportBottom - inset - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - (viewport.top + inset);

  // Ties go to "bottom" — the default reading direction for a dropdown.
  let placement;
  if (panel.height <= spaceBelow) placement = "bottom";
  else if (panel.height <= spaceAbove) placement = "top";
  else placement = spaceAbove > spaceBelow ? "top" : "bottom";

  const space = placement === "bottom" ? spaceBelow : spaceAbove;
  // Floor at 0: an anchor scrolled off-screen must not yield a negative
  // max-height, which CSS would reject and leave the panel unclamped.
  const maxHeight = Math.max(0, Math.min(panel.height, space));

  const top =
    placement === "bottom" ? anchor.bottom + gap : anchor.top - gap - maxHeight;

  // Left-align to the anchor, then shift into the inset box. When the panel is
  // wider than that box the two bounds invert, so pin to the left edge rather
  // than letting the clamp snap it right.
  const minLeft = viewport.left + inset;
  const maxLeft = viewportRight - inset - panel.width;
  const left =
    maxLeft < minLeft
      ? minLeft
      : Math.min(Math.max(anchor.left, minLeft), maxLeft);

  return { placement, top, left, maxHeight };
}
