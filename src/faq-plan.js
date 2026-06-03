/**
 * Pure planner for FAQ nesting.
 *
 * Given the section slugs of the target drop-zones (in section order) and the
 * section slugs of the source items (in item order), compute how to nest items
 * under sections: which items belong to each target, which items match no
 * section (orphans), and which targets receive no items (empty).
 *
 * Indexes refer to positions in the input arrays, so the DOM layer can map them
 * back to elements without re-matching. Slugs are unique in practice; if a slug
 * is repeated across targets, the first target wins and the rest stay empty.
 *
 * @param {string[]} targetSlugs  section slug of each target, in section order
 * @param {string[]} itemSlugs    section slug of each item, in item order
 * @returns {{
 *   groups: Array<{ slug: string, itemIndexes: number[] }>,
 *   orphanItemIndexes: number[],
 *   emptyTargetSlugs: string[],
 * }}
 */
export function planFaqNesting(targetSlugs, itemSlugs) {
  const slugToGroup = new Map();
  const groups = targetSlugs.map((slug) => {
    const group = { slug, itemIndexes: [] };
    // First target for a given slug owns its items.
    if (!slugToGroup.has(slug)) slugToGroup.set(slug, group);
    return group;
  });

  const orphanItemIndexes = [];
  itemSlugs.forEach((slug, index) => {
    const group = slugToGroup.get(slug);
    if (group) group.itemIndexes.push(index);
    else orphanItemIndexes.push(index);
  });

  const emptyTargetSlugs = groups
    .filter((group) => group.itemIndexes.length === 0)
    .map((group) => group.slug);

  return { groups, orphanItemIndexes, emptyTargetSlugs };
}
