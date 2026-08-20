# Collector Reference

## Products scraper

| | |
|---|---|
| **Collector ID** | `c_mt11rkfr1irkjzsb9` |
| **Name** | `frido-products` |
| **Console** | https://brightdata.com/cp/scrapers/c_mt11rkfr1irkjzsb9 |
| **Created** | 2026-08-20 |
| **Target** | `https://store.myfrido.com/collections/*` |

### Why this target

Frido is an Indian D2C ergonomics brand (cushions, pillows, orthotics,
footwear). It is **not** in Bright Data's pre-built scraper library, which
covers global marketplaces rather than regional D2C storefronts.

It also satisfies the "genuinely useful to track" criterion: it is a Shopify
store running near-permanent discount campaigns, so prices and stock move
frequently — 14 of the 49 products in the first run were already out of stock,
and average discount sat at 51%.

The catch that makes it a real scraping problem: **the product grid is
client-side rendered**. Fetching the collection page over HTTP returns only
navigation and footer markup — zero products, zero prices. Confirmed during
target selection:

```bash
bdata scrape https://store.myfrido.com/collections/tt-pillows --format markdown
# 669 lines, exactly one "₹" on the page — and that one is a promo banner.
```

`/collections/*/products.json` (the usual Shopify escape hatch) redirects back
to HTML, so that route is closed too.

### Created with

```bash
bdata scraper create "https://store.myfrido.com/collections/tt-pillows" \
  "For each product card in the collection grid, extract: product_name, \
   current_price (number, INR), original_price (number, INR, if a struck-through MRP \
   is shown), discount_percent, availability (in stock or sold out), rating, \
   review_count, product_url (absolute), image_url, and category (the collection \
   name shown on the page). Return one row per product." \
  --name frido-products
```

Nine AI build steps ran: `prepare_intent_analyzer`, `planner`, `discovery`,
`collector_mainatiner`, `output_schema_generator`, `code_generator`,
`input_schema_generator`, `preview_runner`, `preview_picker`.

Raw output: [`create-products.json`](create-products.json)

### Running it

```bash
# single collection
bdata scraper run c_mt11rkfr1irkjzsb9 https://store.myfrido.com/collections/tt-pillows --pretty

# batch — one job across many collections
bdata scraper run c_mt11rkfr1irkjzsb9 \
  --urls "https://store.myfrido.com/collections/tt-pillows,https://store.myfrido.com/collections/tt-cushions-all-products" \
  --pretty
```

Batching is what the backend uses; a single call across 2 collections returned
49 rows.

## Pack-pricing scraper

| | |
|---|---|
| **Collector ID** | `c_mt15pipw2hu94v7ehy` |
| **Name** | `frido-pack-pricing` |
| **Console** | https://brightdata.com/cp/scrapers/c_mt15pipw2hu94v7ehy |
| **Target** | `https://store.myfrido.com/products/*` |

Collection pages show only the single-unit price. Product pages carry a
multi-pack buy-box that is often a better deal than the headline discount:

```
Frido Ultimate Cozy Pillow
  1 Pillow  → ₹699/unit
  2 Pillows → ₹599.50/unit  (total ₹1,199)
  4 Pillows → ₹574.80/unit  (total ₹2,299)   ← 18% cheaper per unit
```

Created with:

```bash
bdata scraper create "https://store.myfrido.com/products/frido-ultimate-cozy-pillow" \
  "Extract the multi-pack pricing options from the product page buy-box. For each pack \
   option shown, extract: pack_label, unit_count, price_per_unit, total_price. Also \
   extract product_name and the headline discount_percent." \
  --name frido-pack-pricing
```

Note the output nests options in a `pack_options` array rather than returning
one row per pack, and products without a pack selector return an empty array —
[`scrape-packs.js`](../backend/src/jobs/scrape-packs.js) stores only rows with
more than one option, since a lone "1 Pillow" entry says nothing the collection
page did not.

## Output schema

One row per product. Field names below are what the backend stores after
normalisation — see `normalizeProduct()` in
[`backend/src/brightdata.js`](../backend/src/brightdata.js).

| Field | Type | Notes |
|---|---|---|
| `product_name` | string | Required; a row without one is dropped. |
| `current_price` | number \| null | INR. |
| `original_price` | number \| null | Struck-through MRP where shown. |
| `discount_percent` | number \| null | Scraper returns `"63% OFF"`; coerced to `63`. |
| `availability` | string \| null | `"in stock"` / `"out of stock"`. |
| `rating` | number \| null | **Always null** — not present on collection pages. |
| `review_count` | number \| null | **Always null** — same reason. |
| `product_url` | string | Absolute. |
| `image_url` | string \| null | See the heal log — this field needed repair. |
| `category` | string | Derived from the source collection URL, not the page. |

### Two things the raw output does not give you

1. **`category` is unreliable in the payload.** The scraper fills it
   sporadically, and when it does it returns a *badge* ("Newly Launched")
   rather than the collection. Each row does carry `input.url`, so the backend
   derives the category from the collection slug instead
   (`tt-pillows` → `Pillows`). That is what `categoryFromUrl()` does.

2. **`rating` / `review_count` are never populated.** They are not rendered on
   collection pages at all. The columns are kept nullable rather than dropped,
   so a future heal pointed at product detail pages can fill them without a
   schema migration.

## Self-healing

See [`heal-log.md`](heal-log.md) for the full break → heal → verify record.

Both heals returned `status: "awaiting_approval"` rather than applying
silently, so each needed:

```bash
bdata scraper approve c_mt11rkfr1irkjzsb9
```
