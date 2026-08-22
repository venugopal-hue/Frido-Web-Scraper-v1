<div align="center">

# 🛒 Frido Price Tracker

**A scraper that repairs itself when the site changes.**

Live price, stock and deal tracking across [store.myfrido.com](https://store.myfrido.com) —
built on Bright Data Scraper Studio, with a web dashboard and a Telegram bot.

**API:** [frido-web-scraper-v1-1.onrender.com](https://frido-web-scraper-v1-1.onrender.com/api/status) ·
**Bot:** [@Frido_WebScraper_Bot](https://t.me/Frido_WebScraper_Bot)

![Node](https://img.shields.io/badge/Node-22.5%2B-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)
![Bright Data](https://img.shields.io/badge/Bright%20Data-Scraper%20Studio-0F62FE)

</div>

---

## 📊 What it tracks

| | |
|---|---|
| 🛍️ Products | **146** across 19 categories |
| 🖼️ With images | **146** (100%) |
| 📦 Cheaper in a multi-pack | **34** |
| 🏷️ Average discount | **44%** |
| ⛔ Currently sold out | **26** |
| 💰 Total below MRP | **₹3,18,531** |

Refreshed **hourly**, with every run stored so prices can be compared over time.

---

## 🎯 The problem

Frido runs near-permanent discount campaigns, so prices and stock move
constantly — and nothing tells you whether today's "72% off" is actually a good
price, or when a sold-out item comes back.

Scraping it is not straightforward either. **The product grid is rendered
client-side:**

```bash
bdata scrape https://store.myfrido.com/collections/tt-pillows --format markdown | grep -c "₹"
# 1   ← and that one is a promo banner
```

669 lines of navigation and footer. Zero products, zero prices.
`/collections/*/products.json` — the usual Shopify escape hatch — redirects
back to HTML.

So a plain fetch gets nothing, and any hand-written CSS selector is one theme
deploy away from breaking. That is the case for a self-healing scraper.

---

## ✨ Features

- 🔧 **Self-healing** — describe what looks wrong in plain English, the scraper
  rewrites its own extraction logic
- 🩺 **Degradation detection** — not just "zero rows": coverage regressions,
  row-count collapse and prices that stop parsing all trigger a repair
- 📦 **Pack pricing the storefront hides** — a mask listed at ₹349 costs
  **₹174.80 per unit** in a four-pack
- 🎯 **Target price alerts** — `/watch cozy pillow below 600` stays silent
  until it actually drops that low
- 📈 **Price history** — every run kept, so "is this cheap?" has a real answer
- 🔀 **What changed** — the diff between the last two runs, on the dashboard
- ⇄ **Compare** — up to three products side by side, best value marked per row
- 📊 **Category insights** — where the discounts actually concentrate
- 📥 **CSV export** — the current snapshot, pack pricing included
- 🔔 **Alerts** — price drops, restocks and new products, catalogue-wide or for
  one product you follow
- 🤖 **Two surfaces, one API** — dashboard and bot cannot drift apart

---

## 🏗️ Architecture

```
              Bright Data Scraper Studio
        c_mt11rkfr1irkjzsb9 · c_mt15pipw2hu94v7ehy
                          │
              bdata scraper run / heal / approve
                          │
                  backend/src/pipeline.js
              ┌───────────┴───────────┐
        rows returned?           nothing returned
              │                         │
        dedupe by URL            bdata scraper heal
              │                         │
      backfill missing images    re-run & record
              │                         │
        check for degradation           │
              └───────────┬─────────────┘
                    SQLite (node:sqlite)
                          │
                   Express API :4000
                  ┌───────┴───────┐
          Next.js dashboard   Telegram bot
```

---

## 🚀 Setup

Requires **Node 22.5+** — the backend uses the built-in `node:sqlite`, so
there is no native build step.

### 1 · Bright Data CLI

```bash
npx -p @brightdata/cli bdata login
```

### 2 · Dashboard

```bash
cd dashboard
npm install && npm run dev
```

It talks to the deployed API at
`https://frido-web-scraper-v1-1.onrender.com` out of the box, so there is
nothing else to start. `/api/*` is proxied server-side, so no CORS setup and no
API URL in the client bundle.

### 3 · Backend (only to run your own)

```bash
cd backend
npm install
cp .env.example .env      # collector IDs are pre-filled
npm start
npm run scrape            # first data
```

Then point the other two at it with `API_BASE_URL=http://localhost:4000` in
`dashboard/.env` and `telegram-bot/.env`.

### 4 · Telegram bot

Create a bot with [@BotFather](https://t.me/BotFather), then:

```bash
cd telegram-bot
npm install
cp .env.example .env      # paste TELEGRAM_BOT_TOKEN
npm start
```

Only ever run one instance — Telegram allows a single poller per token, and a
second one makes both drop updates with a 409.

Send `/heal` once to learn your chat ID, then add it to
`TELEGRAM_ADMIN_CHAT_IDS` for the admin commands.

> ⚠️ The **backend** sends alerts, not the bot — put the same token in
> `backend/.env` too, or broadcasts silently do nothing.

---

## 🛠️ Commands

```bash
npm run scrape           # full catalogue: chunked runs, dedupe, images, health check
npm run scrape-packs     # multi-pack pricing from product pages
npm run refresh-images   # re-point every product at the store's first image
npm run seed-categories  # rediscover collections
npm run demo-break       # simulated break → auto-heal fires
npm run test-alerts      # prove the Telegram alert path works, no waiting
npm run import-heals     # load CLI heal artifacts into the timeline
```

---

## 🤖 Bot commands

| Command | What it does |
|---|---|
| `/deals` | Filter by how much is off — tap a range |
| `/latest` | Biggest savings right now |
| `/categories` | What each category has, and its cheapest item |
| `/watch cozy pillow` | Tell me whenever this price changes |
| `/watch cozy pillow below 600` | Only tell me when it drops under ₹600 |
| `/watchlist` | What I follow, and how close to my price |
| `/unwatch cozy pillow` | Stop following it |
| `/subscribe` · `/unsubscribe` | Alerts for the whole store |
| `/status` | Is the tracker working, and when did it last update |

Admin only: `/heal <what broke>`, `/approve`, `/refresh`.

---

## 🔌 API

| Method | Route | Returns |
|---|---|---|
| `GET` | `/api/data` | Latest snapshot, with deal scores and pack pricing |
| `GET` | `/api/status` | State, last run, last repair, live progress |
| `GET` | `/api/changes` | Diff between the two most recent runs |
| `GET` | `/api/heals` | Repair timeline with field coverage |
| `GET` | `/api/history?url=` | Price points for one product |
| `GET` | `/api/sparklines` | Bulk price series, one request for the whole grid |
| `GET` | `/api/watchlist` | Every followed product, with target prices |
| `GET` | `/api/runs` · `/api/categories` | Run log, discovered collections |
| `GET` | `/api/export.csv` | Current snapshot as CSV |
| `POST` | `/api/refresh` | Trigger a scrape |
| `POST` | `/api/heal` · `/api/heal/approve` | Repair the scraper |
| `POST`/`DELETE` | `/api/watches` · `/api/subscribers` | Manage alerts |

Write routes honour `ADMIN_TOKEN` via the `x-admin-token` header. **Set it
before exposing the API** — those routes spend Bright Data credit, and the
check is skipped when the token is blank.

---

## 🧠 Three things worth knowing

Each of these cost real debugging time and none of them announce themselves.

### Approving a repair does not save it

`bdata scraper approve <id>` — the exact command the CLI's own `next_step`
field tells you to run — approves the fix **without persisting the template**,
and reports `status: "done"` either way. The next run silently executes the old
code.

The tell is in `completed_steps`:

```
approve alone         … step_advance → user_approval
approve --auto-save   … step_advance → user_approval → save_new_template
```

Three repairs were lost to this. The pipeline now checks for
`save_new_template` rather than trusting the status field. Full diagnosis in
[`scraper/heal-log.md`](scraper/heal-log.md).

### Large batches are silently capped

Passing all 31 collection URLs to one `run --urls` call returns roughly five
products per collection. Same collector, four URLs at a time:

| Collection | 31 at once | 4 at a time |
|---|---|---|
| Orthotics | 2 | **17** |
| Insoles | 8 | **11** |
| Socks | 7 | **9** |

Nothing errors — it just looks like a small catalogue.

### Self-healing cannot conjure data that was never on the page

The grid lazy-loads images, so `src` stays a placeholder until a card scrolls
into view — and the production run never scrolls. Two repairs were aimed at
this and neither could have worked.

The fix was `/products/{handle}.json`, which returns the image list directly.
Coverage went from **8% → 100%**.

---

## 📁 Structure

```
backend/          Express API, scrape pipeline, scheduler, alerts
  src/pipeline.js   scrape → dedupe → enrich → detect → heal
  src/anomaly.js    degradation detection
  src/enrich.js     image backfill
dashboard/        Next.js UI
telegram-bot/     bot + message builders
scraper/          collector notes and repair evidence
```

---

## 🔒 Security

`.env` files are gitignored; `.env.example` holds placeholders only. Collector
IDs are committed deliberately — they are identifiers, useless without account
credentials. API keys and bot tokens appear nowhere in the repo.
