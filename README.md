# Frido Price Tracker — a scraper that repairs itself

**Into the Scrape-Verse** (WeMakeDevs × Bright Data), August 2026

Live price and stock tracking for [Frido](https://store.myfrido.com), an Indian
D2C ergonomics brand, built on a **Bright Data Scraper Studio** collector and a
pipeline that detects its own breakage and calls `bdata scraper heal` — driven
from plain-English descriptions of what looks wrong, not from selectors.

Two surfaces read the same API: a glassmorphism dashboard and a Telegram bot.

> **On the heals:** three real heals were generated and approved against this
> collector. None of them changed the scraper's output. That is documented
> honestly in [`scraper/heal-log.md`](scraper/heal-log.md), along with the
> elimination process used to isolate why — it looks like a platform-side
> issue in `@brightdata/cli` 0.3.5, not an application bug.

| | |
|---|---|
| **Collector ID** | `c_mt11rkfr1irkjzsb9` |
| **Target** | `https://store.myfrido.com/collections/*` |
| **Heal events** | 3 real heals, all approved — see [`scraper/heal-log.md`](scraper/heal-log.md) for what actually happened |
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
  Frido's collections
- **Detects its own breakage** — a run returning zero rows is treated as a
  broken scraper, not an empty catalogue
- **Heals itself** by calling `bdata scraper heal` with a description of the
  symptom, then re-running and recording the outcome
- **Diffs** each run against the previous snapshot: price drops, restocks,
  sold-outs, new products
- **Alerts** subscribed Telegram chats when something meaningful changes

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
placeholder until a card scrolls into view. Two heals were spent trying to fix
this and neither worked, because the production run never scrolls, so the image
URL genuinely is not in the DOM it sees.

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
npm run scrape            # real bdata scraper run, auto-heals on empty output
```

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
| `/latest` | Current prices, biggest discounts first |
| `/deals` | Everything at 50%+ off |
| `/categories` | Item counts and entry prices per category |
| `/subscribe` · `/unsubscribe` | Price-drop and restock alerts |
| `/status` | Scraper health, last run, last heal |
| `/heal <what broke>` | Admin — real `bdata scraper heal` from chat |
| `/approve` | Admin — approve a heal awaiting sign-off |
| `/refresh` | Admin — trigger a scrape |

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
- **None of the three heals changed the scraper's output.** All three generated
  a validated fix and were approved successfully (`status: "done"`), but a
  subsequent `bdata scraper run` returned byte-identical output every time — on
  the default *and* `dev` versions, and after waiting out any propagation delay.
  This was isolated deliberately: heal #3 targeted a pure output transform
  (`"63% OFF"` → `63`) requiring no DOM inspection at all, and still had zero
  effect. [`scraper/heal-log.md`](scraper/heal-log.md) documents the full
  elimination process. The heal *invocation* works; the heal *effect* does not
  reach production output in `@brightdata/cli` 0.3.5.
- **`bdata scraper run --version dev` is broken in 0.3.5.** The CLI's global
  `-v, --version` flag swallows it: it prints `0.3.5` and exits without running
  the scraper. Use `--version=dev`.
- **The backend is written to survive a heal regardless.**
  `normalizeProduct()` accepts both the string and numeric form of every field,
  so whenever a heal does land, nothing downstream needs changing.

## Security

`.env` files are gitignored; `.env.example` carries placeholders only. The
Collector ID is not a secret (it is an identifier, useless without account
credentials) so it is committed deliberately to make the project reproducible.
The Bright Data API key and Telegram token never appear in the repo.
