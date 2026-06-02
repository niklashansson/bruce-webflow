# City content — editor guide

This site can show different content per city (Stockholm, Copenhagen, Oslo…),
or stay city-neutral on shared pages. You control it all with attributes in
Webflow — no code.

## The cities list

Cities live in one hidden Collection List (inside a global symbol, so it's on
every page). Each item carries:

| Attribute | Bind to | Required |
|---|---|---|
| `data-city-slug` | the city's Slug | yes |
| `data-city-name` | the city's Name | yes |
| `data-city-var-phone` | a per-city field (e.g. Phone) | no |
| `data-city-var-lat` / `data-city-var-lng` | coordinates | no |

Any `data-city-var-XYZ` becomes a placeholder `{{XYZ}}` you can use in text.
To add a city, add a Collection item — nothing else.

## City pages (e.g. /studios/city/stockholm)

On the City template pages, add one attribute to the page **Body** tag:

- `data-city-lock` → bind to the current item's **Slug**.

That tells the page "this whole page is about this city." Visitors' saved
choices never override it.

## Show or hide content per city

Put one of these on any element:

| To… | Add | Example |
|---|---|---|
| Show only in certain cities | `data-city-show="stockholm,oslo"` | a Stockholm-only banner |
| Hide in certain cities | `data-city-hide="stockholm"` | hide a promo in Stockholm |
| Show only when NO city is picked | `data-city-none` | a "Pick your city" prompt |
| Show only once a city IS picked | `data-city-any` | "View Stockholm studios →" |

Values accept the city slug or name, separated by commas. An element with
none of these always shows.

## Letting visitors switch city

- **Link to another city's page:** use a normal link to that city's page
  (e.g. the City Studios page). Nothing special needed.
- **Switch in place** (on shared pages like the homepage): add
  `data-set-city="stockholm"` to a button. `data-set-city=""` clears it back
  to neutral. The active button gets `data-city-active="true"` for styling.

## Placeholders you can type into text

| Type | Shows | When no city picked |
|---|---|---|
| `{{city-name}}` | Stockholm | (blank) |
| `{{city}}` | stockholm | (blank) |
| `{{city-path}}` | /stockholm | (blank) |
| `{{phone}}` (any city var) | that city's value | (blank) |

Tip for links: `/memberships{{city-path}}` becomes `/memberships/stockholm`
when a city is active, and `/memberships` when neutral — so it never breaks.

## What visitors see before picking a city

On shared pages with no city in the URL, the page is **neutral**: generic
content shows, city-specific blocks stay hidden, and `data-city-none` prompts
appear. Once they pick a city (or land on a city page), that choice is
remembered for next time.

## Gotchas

- The hidden cities list **must** be inside the global symbol, or city pages
  on some templates won't find it.
- Leaving a `data-city-show` value **blank** means "always show" (it's
  ignored), not "hide everywhere".
- Typos in a city name/slug = the element stays hidden. Check the slug.
