# Frido Price Tracker — a scraper that repairs itself

**Into the Scrape-Verse** (WeMakeDevs × Bright Data), August 2026

Live price and stock tracking for [Frido](https://store.myfrido.com), an Indian
D2C ergonomics brand, built on a **Bright Data Scraper Studio** collector and a
pipeline that detects its own breakage and calls `bdata scraper heal` — driven
from plain-English descriptions of what looks wrong, not from selectors.

Two surfaces read the same API: a minimal web dashboard and a Telegram bot.

> **The one thing to know about healing:** approving a heal and *saving* the
> healed template are two different operations. Running the `next_step` command
> the CLI prints (`bdata scraper approve <id>`) returns `status: "done"` while
> silently leaving the fix unsaved — the next run still executes the old code.
> Pass `--auto-save`. Details and the diagnosis in
> [`scraper/heal-log.md`](scraper/heal-log.md).

| | |
|---|---|
| **Collector ID** | `c_mt11rkfr1irkjzsb9` |
| **Target** | `https://store.myfrido.com/collections/*` |
| **Heal events** | 4 real heals — the fourth landed, taking `discount_percent` from 0/49 numeric to **48/49**. See [`scraper/heal-log.md`](scraper/heal-log.md) |
| **Sample output** | [`scraper/sample-pillows.json`](scraper/sample-pillows.json) |

---

## The problem

Frido runs near-permanent discount campaigns — average discount across the
catalogue is **51%**, and **29% of tracked products were already sold out** on
the first run. Prices and stock move constantly, and there is no price history,
no restock notification, and no way to tell whether today's "72% OFF" is
actually better than last week's.

Scraping it is not trivial either. The product grid is **client-side rendered**:

```bash
bdata scrape https://store.myfrido.com/collections/tt-pillows --format markdown
# 669 lines of nav and footer. Exactly one "₹" on the page — a promo banner.
# Zero products. Zero prices.
```

`/collections/*/products.json`, the usual Shopify escape hatch, redirects back
to HTML. So a plain HTTP fetch gets you nothing, and any CSS selector you write
by hand against a Shopify theme is one deploy away from breaking.

That is the case for a self-healing scraper.

## What it does

- **Tracks** name, price, MRP, discount, availability, URL and image across
  Frido's whole catalogue — 146 products, 31 collections
- **Detects its own degradation** — not just zero rows, but coverage
  regressions, row-count collapse and prices that stop parsing
- **Heals itself** by calling `bdata scraper heal` with a description of the
  symptom, then re-running and recording the before/after field coverage
- **Finds pack pricing the storefront hides** — a mask listed at ₹349 costs
  ₹174.80 per unit in a four-pack, a better deal than the headline discount
- **Scores prices against their own history** — "is this actually cheap?"
  rather than "what is the MRP discount?"
- **Diffs** each run against the previous snapshot: price drops, restocks,
  sold-outs, new products
- **Alerts** Telegram — catalogue-wide for subscribers, per-product for
  watchers

---

## Architecture

```
                    Bright Data Scraper Studio
                    collector c_mt11rkfr1irkjzsb9
                              │
                    bdata scraper run / heal / approve
                              │
                      backend/src/pipeline.js
                  ┌───────────┴───────────┐
            run returns rows?        zero rows
                  │                       │
            dedupe by URL          bdata scraper heal
                  │                       │
          enrich missing images     re-run & record
                  │                       │
              diff vs prev                │
                  └───────────┬───────────┘
                        SQLite (node:sqlite)
                              │
                      Express API :4000
                     ┌────────┴────────┐
              Next.js dashboard    Telegram bot
```

One database, one API, two surfaces — the bot performs no scraping of its own,
so the two views cannot drift apart.

### The self-healing loop

`backend/src/pipeline.js` is the core. An empty extraction is the failure
signal:

```js
let result = await runScraper({ collectorId, urls });

if (!result.ok && autoHeal) {
  const healId = recordHeal({ trigger: 'auto', status: 'healing', ... });
  const heal = await healScraper({ collectorId, prompt: healPrompt });

  if (heal.awaitingApproval) {
    // Bright Data can return a heal that needs sign-off. We surface it on the
    // dashboard rather than auto-approving — a scraper that rewrites itself
    // unsupervised is not obviously a good idea.
    updateHeal(healId, { status: 'awaiting_approval' });
    return { ok: false, healAwaitingApproval: true };
  }

  result = await runScraper({ collectorId, urls }); // re-run after the fix
}
```

Every cycle lands in `heal_events` and renders on the dashboard timeline.

### Batch runs are capped — chunk them

Passing all 31 collection URLs to a single `bdata scraper run --urls` call
returns roughly **5 products per collection**, silently. The same collector,
given 4 URLs at a time, returns the full grid:

| Collection | 31 URLs at once | 4 URLs at a time |
|---|---|---|
| Orthotics | 2 | **17** |
| Insoles | 8 | **11** |
| Socks | 7 | **9** |

Nothing errors — the run reports success with a short result set, so it is easy
to mistake for a small catalogue. `runChunked()` in
[`pipeline.js`](backend/src/pipeline.js) splits the URL list into batches of
`SCRAPE_CHUNK_SIZE` (default 4) and concatenates the rows.

### Image backfill — where healing was the wrong tool

Frido's collection grid lazy-loads its product images: `src` stays a
placeholder until a card scrolls into view. Two heals were aimed at this and
neither could have worked — the production run never scrolls, so the image URL
is genuinely absent from the DOM the scraper sees. No prompt recovers data that
is not on the page.

The fix was not a better heal prompt. Shopify exposes
`/products/{handle}.json` per product, which returns the full image list
directly, so [`backend/src/enrich.js`](backend/src/enrich.js) backfills any row
that came back without an image — five requests in flight at a time.

That took image coverage from **~8%** to near-complete. Worth stating plainly:
self-healing is for a scraper whose selectors have drifted, not for data that
was never on the page.

---

## Setup

Requires **Node 22.5+** (the backend uses the built-in `node:sqlite` — no
native compilation) and a Bright Data account.

```bash
git clone <your-repo-url>
cd scrape-verse-project
```

### 1. Bright Data CLI

```bash
npx -p @brightdata/cli bdata login
```

Apply the promo code `wemakedevs` in Billing for $50 of credit. Verify:

```bash
npx -p @brightdata/cli bdata budget
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # COLLECTOR_ID is pre-filled
npm start                 # → http://localhost:4000
```

First data:

```bash
npm run scrape            # real bdata scraper run, auto-heals on degradation
```

Other jobs:

| Command | What it does |
|---|---|
| `npm run scrape` | Full catalogue: chunked runs, dedupe, image backfill, anomaly check |
| `npm run scrape-packs` | Multi-pack pricing from product pages (second collector) |
| `npm run refresh-images` | Re-point every product at the store's own first image |
| `npm run seed-categories` | Rediscover collections from the category index |
| `npm run demo-break` | Simulated break → auto-heal fires, for the demo video |
| `npm run import-heals` | Load CLI-run heal artifacts into the timeline |

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev               # → http://localhost:3000
```

`/api/*` is proxied to the backend, so no CORS setup and no separate API URL in
the browser.

### 4. Telegram bot

Create a bot with [@BotFather](https://t.me/BotFather), then:

```bash
cd telegram-bot
npm install
cp .env.example .env      # paste TELEGRAM_BOT_TOKEN
npm start
```

Send `/heal` once to learn your chat ID, then put it in
`TELEGRAM_ADMIN_CHAT_IDS` to unlock the admin commands.

---

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/data` | Latest snapshot |
| `GET` | `/api/status` | Health, last run, last heal, subscriber count |
| `GET` | `/api/heals` | Full heal timeline |
| `GET` | `/api/history?url=` | Price points for one product |
| `GET` | `/api/runs` | Recent run log |
| `POST` | `/api/refresh` | Trigger a scrape (auto-heals) |
| `POST` | `/api/heal` | Manual `bdata scraper heal` |
| `POST` | `/api/heal/approve` | Approve or reject a pending heal |

Write endpoints honour `ADMIN_TOKEN` via the `x-admin-token` header when set.

## Telegram commands

| Command | Behaviour |
|---|---|
| `/deals` | Discount bands as tappable buttons — `Under 25%`, `25–39%`, `40–49%`, `50–69%`, `70%+`, with counts |
| `/latest` | Top 20 of the catalogue, discounts first |
| `/categories` | Item counts and entry prices per category |
| `/watch <name>` | Follow one product; disambiguates when a name is ambiguous |
| `/watchlist` · `/unwatch <name>` | Manage what you follow |
| `/subscribe` · `/unsubscribe` | Catalogue-wide price and stock alerts |
| `/status` | Scraper health, last run, last heal |
| `/heal <what broke>` | Admin — real `bdata scraper heal` from chat |
| `/approve` | Admin — approve a heal awaiting sign-off |
| `/refresh` | Admin — trigger a scrape |

Bands are **exclusive**: `50–69%` does not include the 70%+ items. Long lists
paginate inside one message, edited in place, so the keyboard stays attached.

Run `npm run preview` in `telegram-bot/` to render every message against the
live API without needing a token.

## Automation

[`.github/workflows/scrape-and-heal.yml`](.github/workflows/scrape-and-heal.yml)
runs the scrape every 6 hours, auto-heals on empty extraction, and caches the
SQLite file between runs so the diff engine always has a previous snapshot to
compare against.

Locally, set `ENABLE_SCHEDULER=true` to use the in-process `node-cron` instead.

---

## Honest notes

Things worth knowing if you are reading the code or the heal log:

- **`rating` and `review_count` are always null.** They are not rendered on
  collection pages. The columns are kept nullable so a later heal aimed at
  product detail pages can fill them without a migration.
- **`category` is not taken from the scraper output.** It fills that field
  sporadically and returns a badge ("Newly Launched") rather than the
  collection, so the backend derives it from the source collection URL instead.
- **Approving a heal does not save it.** `bdata scraper approve <id>` — the
  exact command the CLI's own `next_step` field tells you to run — approves the
  fix without persisting the template, and reports `status: "done"` either way.
  The next run keeps executing the old code. Pass `--auto-save` to `heal` or
  `approve`. The tell is in `completed_steps`: a heal that landed ends with
  `save_new_template`, one that did not ends at `user_approval`. Three heals
  were lost to this before it was spotted.
- **`bdata scraper run --version dev` is broken in 0.3.5.** The CLI's global
  `-v, --version` flag swallows it: it prints `0.3.5` and exits without running
  the scraper. Use `--version=dev`.
- **The backend checks `saved`, not `status`.** A heal is recorded as healed
  only when `save_new_template` appears in its steps — otherwise it is recorded
  as failed with the reason, however successful the status field looks.
- **`normalizeProduct()` accepts both shapes of every field**, so a heal that
  changes `"63% OFF"` into `63` cannot break anything downstream.

## Security

`.env` files are gitignored; `.env.example` carries placeholders only. The
Collector ID is not a secret (it is an identifier, useless without account
credentials) so it is committed deliberately to make the project reproducible.
The Bright Data API key and Telegram token never appear in the repo.
