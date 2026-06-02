/**
 * Pure decision helper for city-visibility.js. Framework-free (no DOM, no
 * globals) so the "is this element visible in the active city" rules live in
 * one unit-testable place.
 *
 * Four independent attributes, AND-combined (an element typically carries
 * exactly one):
 *   show="a,b"  visible when active ∈ {a,b}
 *   hide="a,b"  hidden when active ∈ {a,b}  (so: visible otherwise, incl. neutral)
 *   none        visible only when active is null (neutral)
 *   any         visible only when active is non-null
 *
 * `activeSlug === null` means NEUTRAL — a real resolved state, not pre-boot.
 * (Pre-boot hiding is the CSS pre-hide rule's job, gated on is-city-ready.)
 *
 * show/hide values: comma-separated, trimmed, case-insensitive against both
 * city.slug and city.name. Empty/whitespace value is a no-op (no constraint).
 * Tokens matching no city are collected in `unknownValues` so the caller can
 * warn once per value; an unknown token never satisfies a `show`.
 *
 * @param {{show: string|null, hide: string|null, none: boolean, any: boolean}} attrs
 * @param {string | null} activeSlug
 * @param {Array<{slug: string, name: string}>} cities
 * @returns {{ visible: boolean, unknownValues: string[] }}
 */
export function decideVisibility(attrs, activeSlug, cities) {
  const unknownValues = [];
  const active = activeSlug ? activeSlug.toLowerCase() : null;

  // Returns { count, matched } for a comma list, pushing unknown tokens.
  function evalList(raw) {
    const tokens = (raw ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    let matched = false;
    for (const t of tokens) {
      const city = cities.find(
        (c) => c.slug.toLowerCase() === t || c.name.toLowerCase() === t,
      );
      if (!city) {
        unknownValues.push(t);
        continue;
      }
      if (active && city.slug.toLowerCase() === active) matched = true;
    }
    return { count: tokens.length, matched };
  }

  let visible = true;

  if (attrs.show != null) {
    const { count, matched } = evalList(attrs.show);
    if (count > 0 && !matched) visible = false;
  }
  if (attrs.hide != null) {
    const { count, matched } = evalList(attrs.hide);
    if (count > 0 && matched) visible = false;
  }
  if (attrs.none && active !== null) visible = false;
  if (attrs.any && active === null) visible = false;

  return { visible, unknownValues };
}
