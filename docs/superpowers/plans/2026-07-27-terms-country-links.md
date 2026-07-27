# Terms Country Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terms links auto-resolve to `/terms/se`, `/terms/dk` or `/terms/no` based on the visitor's selected city, by letting `[data-city-link-list]` lists be keyed by a city variable (`country`) instead of the city slug.

**Architecture:** Extends the existing gateway-link rewriter. `src/city-links-plan.js` (pure, unit-tested) gains a keyed-by-var lookup in `resolveHref`; `src/city-links.js` (DOM shell) reads the new `data-city-link-by` attribute and passes the active city's vars through. Webflow renders all real localized URLs; JS never constructs a URL.

**Tech Stack:** Vanilla JS (Parcel-bundled), framework-free Node test files (`node tests/<file>.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-07-27-terms-country-links-design.md`

## Global Constraints

- **Never construct URLs in JS** — every href is copied from a Webflow-rendered element (localization gotcha).
- Slug-keyed sections (`memberships`, `studios`) must behave exactly as before; the old `resolveHref` call shape (no `keyBy`/`activeVars`) must still work.
- Fallback target for neutral / missing country / unknown country is the `terms` gateway (= Terms SE). Never a broken or guessed URL.
- Tests are framework-free `.mjs` files run with `node`, matching `tests/city-links-plan.test.mjs` style (its `check(label, actual, expected)` helper).
- `dist/` is committed **minified**: `rm -rf .parcel-cache dist && pnpm build` (never `--no-optimize`); after pushing, purge jsDelivr `@main`.
- Commit messages follow the repo's conventional-commit style (`feat(...)`, `docs(...)`, `test(...)`).

---

### Task 1: Pure core — keyed-by-var `resolveHref`

**Files:**
- Modify: `src/city-links-plan.js:31-45` (the `resolveHref` function + its JSDoc)
- Test: `tests/city-links-plan.test.mjs`

**Interfaces:**
- Consumes: existing `resolveHref({section, search, hash}, {gateways, linkMap, active})`.
- Produces: `resolveHref({section, search, hash}, {gateways, linkMap, keyBy, active, activeVars})` where `keyBy` is `Record<string,string>|undefined` (section → var name) and `activeVars` is `Record<string,string>|null|undefined` (active city's vars). Both new fields optional; omitting them preserves today's behavior. Task 2 calls this exact signature.

- [ ] **Step 1: Write the failing tests**

Append to `tests/city-links-plan.test.mjs`, before the final `console.log` line:

```js
// ── resolveHref, keyed by city var ───────────────────────────
const KEYED_GATEWAYS = { ...GATEWAYS, terms: "/terms/se" };
const KEYED_LINK_MAP = {
  ...LINK_MAP,
  terms: { se: "/terms/se", dk: "/terms/dk", no: "/terms/no" },
};
const KEY_BY = { terms: "country" };

check(
  "keyed section + active city with country → country url",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "copenhagen", activeVars: { country: "dk" } },
  ),
  "/terms/dk",
);
check(
  "keyed section + neutral → gateway (default country)",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: null, activeVars: null },
  ),
  "/terms/se",
);
check(
  "keyed section + active city missing the var → gateway fallback",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "stockholm", activeVars: {} },
  ),
  "/terms/se",
);
check(
  "keyed section + var value with no list entry → gateway fallback",
  resolveHref(
    { section: "terms", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "helsinki", activeVars: { country: "fi" } },
  ),
  "/terms/se",
);
check(
  "keyed section preserves query + hash",
  resolveHref(
    { section: "terms", search: "?ref=footer", hash: "#privacy" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "oslo", activeVars: { country: "no" } },
  ),
  "/terms/no?ref=footer#privacy",
);
check(
  "slug-keyed section ignores keyBy for other sections (regression)",
  resolveHref(
    { section: "memberships", search: "", hash: "" },
    { gateways: KEYED_GATEWAYS, linkMap: KEYED_LINK_MAP, keyBy: KEY_BY, active: "oslo", activeVars: { country: "no" } },
  ),
  "/memberships/oslo",
);
check(
  "old call shape (no keyBy/activeVars) still resolves slug-keyed sections",
  resolveHref(
    { section: "memberships", search: "", hash: "" },
    { gateways: GATEWAYS, linkMap: LINK_MAP, active: "oslo" },
  ),
  "/memberships/oslo",
);
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node tests/city-links-plan.test.mjs`
Expected: FAIL — an `AssertionError` on "keyed section + active city with country → country url" (current implementation looks up `linkMap.terms["copenhagen"]`, gets `undefined`, falls back to `/terms/se` instead of `/terms/dk`).

- [ ] **Step 3: Implement the keyed lookup**

Replace `resolveHref` (and its JSDoc) in `src/city-links-plan.js` with:

```js
/**
 * The href to set for a managed link. The lookup key is normally the active
 * city slug; a section listed in `keyBy` uses the active city's var of that
 * name instead (e.g. terms pages keyed by `country`). Falls back to the
 * gateway path when neutral OR when no entry exists for the key. Query + hash
 * are preserved verbatim.
 *
 * @param {{section: string, search: string, hash: string}} link
 * @param {{gateways: Record<string,string>, linkMap: Record<string,Record<string,string>>, keyBy?: Record<string,string>, active: string|null, activeVars?: Record<string,string>|null}} ctx
 * @returns {string}
 */
export function resolveHref(
  { section, search, hash },
  { gateways, linkMap, keyBy, active, activeVars },
) {
  const by = keyBy?.[section];
  const key = by ? (activeVars?.[by] ?? null) : active;
  const url = key ? linkMap[section]?.[key] : null;
  return (url ?? gateways[section] ?? "") + search + hash;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/city-links-plan.test.mjs`
Expected: `✓ all 20 assertions passed` (13 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/city-links-plan.js tests/city-links-plan.test.mjs
git commit -m "feat(city-links): resolveHref supports link lists keyed by a city var"
```

---

### Task 2: DOM shell — read `data-city-link-by`, pass active city vars

**Files:**
- Modify: `src/city-links.js:1-19` (header comment), `:41-55` (`readLinkMap`), `:59-86` (`apply`)

**Interfaces:**
- Consumes: `resolveHref(entry, { gateways, linkMap, keyBy, active, activeVars })` from Task 1; `window.bruce.city.all()` from `src/city-context.js` (returns `Array<{slug, name, vars, coords}>`).
- Produces: no exports (leaf module). DOM contract consumed by Task 3's Webflow setup: `[data-city-link-list="<section>"][data-city-link-by="<var>"]` wrappers with `[data-city-link-item][data-city-link-key="<var value>"]` children.

- [ ] **Step 1: Extend `readLinkMap` to also collect `keyBy`**

Replace `readLinkMap` in `src/city-links.js` with:

```js
function readLinkMap() {
  /** @type {Record<string,Record<string,string>>} */
  const map = {};
  /** @type {Record<string,string>} */
  const keyBy = {};
  document.querySelectorAll("[data-city-link-list]").forEach((list) => {
    const section = list.getAttribute("data-city-link-list")?.trim();
    if (!section) return;
    const by = list.getAttribute("data-city-link-by")?.trim();
    if (by) keyBy[section] = by;
    const m = (map[section] ||= {});
    list.querySelectorAll("[data-city-link-item]").forEach((a) => {
      const key = a.getAttribute("data-city-link-key")?.trim();
      const href = a.getAttribute("href");
      if (key && href) m[key] = new URL(href, location.origin).pathname;
    });
  });
  return { map, keyBy };
}
```

- [ ] **Step 2: Thread `keyBy` + `activeVars` through `apply`**

In `apply(active)`, replace the line

```js
  const linkMap = readLinkMap();
```

with

```js
  const { map: linkMap, keyBy } = readLinkMap();
  const activeCity = active
    ? /** @type {any} */ (window).bruce?.city?.all?.()?.find((c) => c.slug === active)
    : null;
  const activeVars = activeCity?.vars ?? null;
```

and replace the final `setAttribute` line

```js
    a.setAttribute("href", resolveHref(entry, { gateways, linkMap, active }));
```

with

```js
    a.setAttribute("href", resolveHref(entry, { gateways, linkMap, keyBy, active, activeVars }));
```

- [ ] **Step 3: Update the module header comment**

In the header comment of `src/city-links.js`, replace the source-data block

```
 * Source data (rendered in the global component, every page + locale):
 *   [data-city-gateway="<section>"]                  — anchor; localized gateway path
 *   [data-city-link-list="<section>"]                — Collection List wrapper
 *     [data-city-link-item][data-city-link-key][href] — city slug → localized URL
```

with

```
 * Source data (rendered in the global component, every page + locale):
 *   [data-city-gateway="<section>"]                  — anchor; localized gateway path
 *   [data-city-link-list="<section>"]                — list wrapper (Collection List or static)
 *     [data-city-link-item][data-city-link-key][href] — key → localized URL
 *   The key is the city slug, unless the wrapper sets data-city-link-by="<var>"
 *   — then it is the active city's data-city-var-<var> value (e.g. terms pages
 *   keyed by country).
```

- [ ] **Step 4: Run the full test suite (regression)**

Run: `for f in tests/*.test.mjs; do node "$f" || break; done`
Expected: every file prints `✓ all N assertions passed`, no assertion errors.

- [ ] **Step 5: Commit**

```bash
git add src/city-links.js
git commit -m "feat(city-links): read data-city-link-by and resolve keyed sections"
```

---

### Task 3: Editor docs + Webflow setup checklist

**Files:**
- Modify: `docs/editors/city-system.md:12-20` (cities-list table), `:61-63` (auto-link paragraph)

**Interfaces:**
- Consumes: the DOM contract from Task 2 (`data-city-link-by`, `data-city-var-country`).
- Produces: nothing code-facing; the Webflow checklist below is executed manually in the Designer (by Niklas), not by an agent.

- [ ] **Step 1: Document the country var in the cities-list table**

In `docs/editors/city-system.md`, add a row to the table under "The cities list", after the `data-city-var-lat` / `-lng` row:

```markdown
| `data-city-var-country` | the city's Country option (`se`/`dk`/`no`) | for Terms links |
```

- [ ] **Step 2: Document the auto-resolving Terms links**

Replace the paragraph at the end of "Placeholders you can type into text":

```markdown
Links to a city's Memberships or Studios page resolve automatically — just
link to `/memberships` or `/studios` as normal and the visitor's city is
applied for them. No `{{...}}` needed.
```

with:

```markdown
Links to a city's Memberships or Studios page resolve automatically — just
link to `/memberships` or `/studios` as normal and the visitor's city is
applied for them. No `{{...}}` needed.

Terms links work the same way per **country**: link to the Terms SE page as
normal, and visitors with a Danish or Norwegian city selected are routed to
`/terms/dk` / `/terms/no` instead. With no city selected, the link stays on
Terms SE. (Each city's Country field drives this.)
```

- [ ] **Step 3: Commit**

```bash
git add docs/editors/city-system.md
git commit -m "docs(editors): terms links resolve per country"
```

- [ ] **Step 4: Webflow setup (manual, in the Designer — user task)**

Not agent-executable; hand this checklist to Niklas:

1. Cities collection: add an **option field "Country"** with options `se`, `dk`, `no`; set it on every city (Stockholm/Gothenburg → `se`, Copenhagen → `dk`, Oslo → `no`).
2. Hidden cities registry (the `[data-city-list]` Collection List in the global component): on the item element, add attribute `data-city-var-country` bound to the **Country** field. Verify the published attribute value is lowercase `se`/`dk`/`no`.
3. Global component, next to the existing gateway anchors: add a hidden `<a>` with `data-city-gateway="terms"`, link type **Page → Terms SE**.
4. Global component: add a hidden div with `data-city-link-list="terms"` and `data-city-link-by="country"`, containing three link blocks (real **Page** links, never typed URLs):
   - `data-city-link-item` + `data-city-link-key="se"` → Terms SE page
   - `data-city-link-item` + `data-city-link-key="dk"` → Terms DK page
   - `data-city-link-item` + `data-city-link-key="no"` → Terms NO page
5. Author all footer/menu "Terms" links as normal **Page** links to Terms SE. Add `data-city-link-skip` to any link that must always stay on a specific page.
6. Publish (all locales).

---

### Task 4: Build + deploy

**Files:**
- Modify: `dist/` (regenerated, committed minified)

**Interfaces:**
- Consumes: all code from Tasks 1–2 merged on `main`.
- Produces: live bundle at jsDelivr `@main`. Safe to deploy **before** the Webflow changes in Task 3 Step 4 — with no `data-city-link-by` / `terms` elements in the DOM, the new code is a no-op.

- [ ] **Step 1: Clean build**

```bash
rm -rf .parcel-cache dist && pnpm build
```

Expected: Parcel reports all bundles built (index.js, explorer.js, studio.js), no errors. Do NOT use `--no-optimize` — dist ships minified.

- [ ] **Step 2: Sanity-check the bundle**

Run: `grep -c "data-city-link-by" dist/index.js`
Expected: `1` or more (the new attribute string is present in the minified bundle — guards against the stale-cache gotcha).

- [ ] **Step 3: Commit and push**

```bash
git add dist
git commit -m "build: dist for keyed city-link sections (terms)"
git push
```

- [ ] **Step 4: Purge jsDelivr edge cache**

```bash
curl "https://purge.jsdelivr.net/gh/niklashansson/bruce-webflow@main/dist/index.js"
```

Expected: JSON response with `"status": "finished"` (or per-file success flags). Browser/incognito cache clears do NOT bypass the CDN edge — this purge is required.

- [ ] **Step 5: Verify live (after Webflow setup is published)**

On the live site with a Danish city selected, a footer Terms link points at `/terms/dk` (or `/sv/terms/dk` on Swedish pages); with no city, `/terms/se`; switching city re-points it without reload.
