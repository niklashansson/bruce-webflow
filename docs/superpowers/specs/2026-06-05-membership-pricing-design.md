# Membership Pricing — Client-Side Discount Pricing

**Date:** 2026-06-05
**Status:** Approved design, pre-implementation

## Problem

Membership pricing cards on the Webflow site render default (list) prices. When a
city and a campaign code are present on a card, we want to fetch campaign-specific
discount pricing from the Bruce API on the client and overwrite the card's prices,
revealing discount/list-price information where a saving applies. When the codes
are absent, the card keeps its Webflow-rendered defaults untouched.

## Scope

- Client-side only. No build/server changes beyond a new bundled module.
- One module + one pure-logic sibling, registered in `src/index.js`, matching the
  existing per-component pattern (DOM shell + pure logic, e.g. `city-context.js` /
  `city-resolve.js`, `city-links.js` / `city-links-plan.js`).
- Cards are self-contained: each carries its own city, campaign, tier, and
  formatting attributes.

Out of scope: loading/error UI, currency symbol rendering (Webflow markup supplies
the unit text), server-side rendering, caching across page loads.

## Data Source

```
GET https://api.bruce.app/partner/membership/info?city_code={city}&campaign_code={campaign}
```

- `city_code` is the card's city value **lowercased** (`STO` → `sto`).
- `campaign_code` is sent as-is (`VENTURE26`).
- Base URL is a module constant, overridable via `data-pricing-endpoint` on the
  card or `window.bruce.pricingEndpoint`.

### Response shape

```json
{
  "city_code": "STO",
  "campaign_code": "VENTURE26",
  "tiers": [
    {
      "tier_code": "EPIC",
      "prices": {
        "flexible":  { "list_price": 169900, "price": 129900, "discount": { "amount": 40000 } },
        "committed": { "list_price": 149900, "price": 109900, "discount": { "amount": 40000 } },
        "prepaid":   { "list_price": 1571900, "price": 1571900, "discount": null }
      }
    }
  ]
}
```

Prices and `discount.amount` are integers in **minor units** (öre): divide by 100
for display. `discount` is `null` when there is no saving (`list_price === price`).

## Attribute Schema

```
[data-pricing-card]                       ← marks + activates a card
  data-pricing-city="STO"                 ← required; lowercased into the request
  data-pricing-campaign="VENTURE26"       ← required
  data-pricing-tier="EPIC"                ← required; selects tier_code from response
  data-pricing-locale="sv-SE"             ← optional, default "sv-SE" (digit grouping)
  data-pricing-fraction-digits="0"        ← optional, default 0
  data-pricing-endpoint="https://…"       ← optional endpoint override

  [data-pricing-variant="committed"]      ← per-variant container; gets is-discounted toggled
     [data-price-slot="committed.price"]
     [data-price-slot="committed.list_price"]
     [data-price-slot="committed.discount"]   ← formatted discount.amount
  …repeat for flexible / prepaid
```

- Slots are keyed by the dotted `"{variant}.{field}"` string and filled by lookup
  regardless of nesting depth within the card.
- Fields per variant: `price`, `list_price`, `discount` (maps to `discount.amount`).
- Variants: `flexible`, `committed`, `prepaid`.

## Formatting

Number only — no currency symbol (Webflow supplies the unit):

```js
(value / 100).toLocaleString(locale, {
  minimumFractionDigits: fractionDigits, // default 0
  maximumFractionDigits: fractionDigits, // default 0
})
// 129900 → "1 299"  (sv-SE grouping)
// 40000  → "400"
```

## Behavior

1. **Gate:** if `data-pricing-city` or `data-pricing-campaign` is empty/missing,
   do nothing — Webflow defaults remain.
2. **Fetch:** deduped by a `Map<"city|campaign", Promise<json>>`, so multiple tier
   cards sharing the same city+campaign trigger a single network request.
3. **Apply:** locate the tier whose `tier_code` matches `data-pricing-tier`. For
   each variant, fill every matching `data-price-slot` by its dotted key. Toggle
   `is-discounted` on `[data-pricing-variant="{variant}"]` when that variant's
   `discount` is non-null; remove it otherwise. All slots are filled regardless of
   discount state (per Q6: "toggle a state class", site owns the CSS).
4. **Failure / missing tier / network or parse error:** `console.warn`, leave the
   Webflow defaults untouched. No loading or error UI.
5. **Idempotent:** a card that has already been applied is skipped on later safety
   passes via a `WeakSet` (mirrors the `managed` map in `city-links.js`).

## Boot

DOMContentLoaded + safety passes at `[500, 1500, 3500]` ms to handle late-rendered
CMS content, matching `city-context.js` / `city-links.js`.

## Files

- `src/membership-pricing-format.js` — pure: `formatPrice(minorUnits, opts)`,
  `buildTierView(tier, { locale, fractionDigits })` → `{ slots: Record<string,string>,
  discounted: Record<variant, boolean> }`. No DOM. Independently testable.
- `src/membership-pricing.js` — DOM shell: scan cards, read attributes, gate,
  deduped fetch, apply slot map + toggle classes, boot + safety passes.
- `src/index.js` — add `import "./membership-pricing.js";`.

## Edge Cases

- Card missing `data-pricing-tier` or tier absent in response → warn, skip card.
- A `data-price-slot` key with no corresponding value in the response → leave that
  slot's existing text.
- Variant present in DOM but absent in response → leave its slots; do not toggle.
- Endpoint returns non-2xx or invalid JSON → warn, keep defaults.
