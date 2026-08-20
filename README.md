<div align="center">

# 🛒 Frido Price Tracker

**A scraper that repairs itself when the site changes.**

Live price, stock and deal tracking across [store.myfrido.com](https://store.myfrido.com) —
built on Bright Data Scraper Studio, with a web dashboard and a Telegram bot.

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
| 🛍️ Products | **140** across 16 categories |
| 🖼️ With images | **140** (100%) |
| 📦 Cheaper in a multi-pack | **33** |
| 🏷️ Average discount | **44%** |
| ⛔ Currently sold out | **23** |
| 💰 Total below MRP | **₹3,10,731** |

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
- 📈 **Price history** — every run kept, so "is this cheap?" has a real answer
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

### 2 · Backend

```bash
cd backend
npm install
cp .env.example .env      # collector IDs are pre-filled
npm start                 # → http://localhost:4000
npm run scrape            # first data
```

### 3 · Dashboard

```bash
cd dashboard
npm install && npm run dev    # → http://localhost:3000
```

`/api/*` proxies to the backend, so there is no CORS setup and no API URL in
the client bundle.

### 4 · Telegram bot

Create a bot with [@BotFather](https://t.me/BotFather), then:

```bash
cd telegram-bot
npm install
cp .env.example .env      # paste TELEGRAM_BOT_TOKEN
npm start
```

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
```

---

## 🤖 Bot commands

| Command | What it does |
|---|---|
| `/deals` | Discount bands as tap-through buttons, with counts |
| `/latest` | Top 20 by discount |
| `/categories` | Item counts and entry prices |
| `/watch <name>` | Follow one product |
| `/watchlist` · `/unwatch` | Manage what you follow |
| `/subscribe` · `/unsubscribe` | Catalogue-wide alerts |
| `/status` | Tracker state, last run, last repair |

Admin only: `/heal <what broke>`, `/approve`, `/refresh`.

---

## 🔌 API

| Method | Route | Returns |
|---|---|---|
| `GET` | `/api/data` | Latest snapshot, with deal scores and pack pricing |
| `GET` | `/api/status` | State, last run, last repair, progress |
| `GET` | `/api/heals` | Repair timeline with field coverage |
| `GET` | `/api/history?url=` | Price points for one product |
| `GET` | `/api/runs` | Recent run log |
| `POST` | `/api/refresh` | Trigger a scrape |
| `POST` | `/api/heal` · `/api/heal/approve` | Repair the scraper |

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
