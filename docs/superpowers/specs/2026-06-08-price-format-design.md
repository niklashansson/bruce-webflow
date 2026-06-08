# Price Format — Attribute-Driven Number Formatting

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation

## Problem

Plain numeric prices authored in Webflow (e.g. `129000`) should render as
locale-grouped numbers (`129 000`) without hand-formatting in the CMS or per-page
embeds. We want one attribute an author can drop on any element holding a raw
number to have it formatted in place on the client.

This is distinct from `membership-pricing.js`, which fetches campaign pricing from
the Bruce API and works in minor units (öre). This module only formats numbers
already present in the DOM.

## Scope

- Client-side only. One new module `src/price-format.js`, registered in
  `src/index.js`, matching the existing per-component init pattern.
- Number only — no currency symbol. Webflow markup supplies the unit text, matching
  the existing `formatPrice` convention in `membership-pricing-format.js`.

Out of scope: currency symbol rendering, fetching, minor-unit (öre) conversion,
server-side rendering, reacting to later DOM mutations beyond the safety passes.

## Markup Contract

```html
<span data-price-format>129000</span>                              → 129 000
<span data-price-format>129.95</span>                              → 129,95
<span data-price-format data-price-locale="en-US">129000</span>    → 129,000
<span data-price-format data-price-decimals="2">129000</span>      → 129 000,00
```

- `data-price-format` — marks the element. Required.
- `data-price-locale` — optional, default `"sv-SE"`.
- `data-price-decimals` — optional. When omitted, preserve the number of decimals
  present in the raw value (`129.95` → 2, `129000` → 0). When set, force that fixed
  count.

The authored raw value is a plain number using `.` as the decimal separator and no
grouping. Surrounding whitespace is tolerated.

## Behavior

- Read the element's own `textContent`, parse it, format via `Number.toLocaleString`
  with `minimumFractionDigits`/`maximumFractionDigits`, and write the result back
  into the same element.
- Decimal count: `data-price-decimals` if present and valid; otherwise the count of
  digits after the `.` in the raw string.
- Invalid / empty / non-numeric content is left untouched — no write, no console
  noise.
- Idempotent: a `WeakSet` marks processed elements so re-runs (safety passes) skip
  already-formatted elements rather than re-parsing grouped output.

## Structure

One file, `src/price-format.js`:

- `formatPriceValue(raw, { locale, decimals })` — pure function: parse + format,
  returns `null` for non-numeric input.
- DOM/boot shell: `querySelectorAll("[data-price-format]")`, per-element apply with
  the `WeakSet` guard, plus the boot + delayed safety-pass pattern from
  `membership-pricing.js` to catch late-rendered CMS items.

(No separate `-format.js` sibling: the repo has no test runner wired up — `pnpm test`
is a stub — so the öre-module's pure/shell split for Node unit tests buys nothing
here. Kept as one focused file.)
