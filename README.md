# Frido Web Scraper

A production-grade, self-healing web scraper, real-time analytics dashboard, and Telegram alert bot designed to track prices, discounts, stock availability, and hidden multi-pack unit savings across [store.myfrido.com](https://store.myfrido.com).

Powered by **Bright Data Scraper Studio**, **Node.js (node:sqlite)**, **Next.js 14 App Router**, and **Telegram Bot API**.

---

## Project Description

Frido runs frequent promotional campaigns and dynamic discounts across its catalog. Standard scrapers fail on this storefront because the product catalog is rendered client-side and dynamic DOM updates break traditional static CSS selectors.

**Frido Web Scraper** solves this with an end-to-end self-healing architecture:
1. **Resilient Extraction**: Leverages Bright Data Scraper Studio collectors capable of automatic AI prompt-driven DOM self-healing when storefront structures shift.
2. **Schema & Degradation Monitoring**: Detects extraction anomalies, field fill-rate regressions, and stock state transitions.
3. **Multi-Pack Value Discovery**: Identifies hidden quantity discounts and unit-level savings obscured on collection pages.
4. **Interactive SaaS Analytics**: Modern light-themed dashboard providing catalog exploration, price history charts, side-by-side product comparisons, category analytics, and run-over-run diff radars.
5. **Telegram Bot Alerts**: Instant push notifications for subscriber-configured target price thresholds and catalog restocks.

---

## Features

- **Automated Self-Healing Scraper**: Detects selector degradation and applies natural language repair prompts to rewrite extraction logic automatically.
- **Modern SaaS Web Dashboard**: Premium light-themed analytics dashboard featuring collapsible sidebar navigation, live status pills, KPI metric cards, and responsive layout.
- **Interactive Price History**: Step-after line charts with historical price points, MRP reference lines, and all-time high/low tracking.
- **Hidden Pack Pricing**: Calculates exact unit savings for multi-pack bundles that are only revealed on individual product detail pages.
- **Product Matrix Comparison**: Side-by-side comparison tool for up to 3 items highlighting best price, highest discount, and lowest unit cost.
- **Run-over-Run Diff Radar**: Immediate visualization of price drops, price hikes, restocks, new additions, and delisted items between scrape passes.
- **Category Discount Distribution**: Proportional progress analytics showing discount concentration across all catalog categories.
- **Telegram Bot Integration**: Conversational bot with interactive pagination keyboards, `/watch` target price alerts, and category summaries.
- **CSV Data Export**: One-click download of the complete tracked catalog snapshot including pack breakdown and historical metrics.

---

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts
- **Backend & API**: Node.js 22+ (native `node:sqlite`), Express 4, CORS, dotenv, node-cron
- **Data Storage**: SQLite with Write-Ahead Logging (`WAL` mode)
- **Scraper Infrastructure**: Bright Data Scraper Studio CLI (`@brightdata/cli`), Bright Data REST API
- **Bot Platform**: Telegram Bot API (`node-telegram-bot-api`)

---

## Project Structure

```
Frido-Web-Scraper-v1/
├── dashboard/                 # Next.js 14 Web Application
│   ├── app/                   # App Router layout, pages, and global styles
│   │   ├── globals.css        # Light theme design tokens and component styles
│   │   ├── layout.tsx         # Root HTML layout & font settings
│   │   └── page.tsx           # Main dashboard view orchestrator
│   ├── components/            # UI components (Sidebar, Header, ProductGrid, etc.)
│   ├── lib/                   # API client, type definitions, and helper functions
│   └── package.json           # Frontend dependencies and scripts
│
├── backend/                   # Express API Server & Pipeline Scheduler
│   ├── src/
│   │   ├── server.js          # REST API endpoints & route handlers
│   │   ├── pipeline.js        # Scrape ingestion, batching, and healing logic
│   │   ├── db.js              # SQLite schema, queries, and baseline seeder
│   │   ├── brightdata.js      # Bright Data Scraper Studio integration
│   │   ├── anomaly.js         # Degradation & fill-rate regression detectors
│   │   ├── deal-score.js      # Statistical deal classification algorithms
│   │   ├── enrich.js          # Product image and metadata enrichment
│   │   ├── scheduler.js       # Hourly cron schedule executor
│   │   └── jobs/              # Standalone maintenance & scraping scripts
│   └── package.json           # Backend dependencies and scripts
│
├── scraper/                   # Bright Data Scraper Definitions & Heal Logs
│   ├── collector.md           # Collector schemas, setup instructions, and rules
│   ├── heal-log.md            # Self-healing audit history and diagnosis notes
│   └── *.json                 # Collector schemas and sample outputs
│
├── telegram-bot/              # Telegram Bot Client
│   ├── bot.js                 # Telegram bot polling and command handlers
│   ├── format.js              # Message templates & inline keyboard builders
│   ├── preview.js             # Local preview script for testing all bot outputs
│   └── package.json           # Telegram bot dependencies
│
└── README.md                  # Project documentation
```

---

## Installation

Ensure you have **Node.js 22.5.0 or higher** installed.

### 1. Install Frontend Dependencies
```bash
cd dashboard
npm install
```

### 2. Install Backend Dependencies
```bash
cd ../backend
npm install
```

### 3. Install Telegram Bot Dependencies
```bash
cd ../telegram-bot
npm install
```

---

## Environment Variables

Each component includes an `.env.example` template with required variable names. **Never commit `.env` files or API secrets to version control.**

### Backend (`backend/.env`)
| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | API server port | `4000` |
| `DB_PATH` | Relative or absolute path to SQLite database | `../data/scrapeverse.db` |
| `COLLECTOR_ID` | Bright Data collector ID for products | Provided in `.env.example` |
| `PACKS_COLLECTOR_ID` | Bright Data collector ID for multi-packs | Provided in `.env.example` |
| `CATEGORIES_COLLECTOR_ID` | Optional Bright Data category collector | Empty |
| `BRIGHTDATA_API_KEY` | Optional Bright Data API Key (if not using `bdata login`) | Secret |
| `ADMIN_TOKEN` | Secret protecting credit-spending endpoints (`/api/refresh`, `/api/heal`) | Secret |
| `AUTO_HEAL` | Automatically trigger self-healing on failure | `true` |
| `ENABLE_SCHEDULER` | Enable background cron job | `true` |
| `CRON_SCHEDULE` | Cron pattern for periodic scraping | `0 * * * *` (hourly) |
| `SCRAPE_CHUNK_SIZE` | URLs per Bright Data batch | `4` |
| `SCRAPE_CONCURRENCY` | Concurrent scraping jobs | `3` |
| `ENRICH` | Backfill missing product images | `true` |
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather | Secret |
| `TELEGRAM_ADMIN_CHAT_IDS` | Comma-separated admin Telegram chat IDs | Secret |
| `API_BASE_URL` | Public or local base URL for API references | `http://localhost:4000` |

### Frontend (`dashboard/.env.local`)
| Variable | Description | Default / Example |
|---|---|---|
| `API_BASE_URL` | Base URL of the backend API | `http://localhost:4000` |
| `NEXT_PUBLIC_TELEGRAM_BOT` | Telegram bot username (without `@`) | `Frido_WebScraper_Bot` |

### Telegram Bot (`telegram-bot/.env`)
| Variable | Description | Default / Example |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather | Secret |
| `API_BASE_URL` | Base URL of the backend API | `http://localhost:4000` |
| `ADMIN_TOKEN` | Admin token matching backend configuration | Secret |
| `TELEGRAM_ADMIN_CHAT_IDS` | Comma-separated admin Telegram chat IDs | Secret |

---

## Running Locally

You can run the dashboard independently (it defaults to the live deployed API) or start the full local stack.

### 1. Running the Full Stack

**Terminal 1 — Backend API:**
```bash
cd backend
npm start
```
*The backend automatically initializes and seeds the SQLite database with catalog baseline records on first run.*

**Terminal 2 — Frontend Dashboard:**
```bash
cd dashboard
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Terminal 3 — Telegram Bot (Optional):**
```bash
cd telegram-bot
npm start
```

---

## Frontend

The dashboard is built with Next.js 14 (App Router) and Tailwind CSS.

### Available Scripts (`dashboard/`)
- `npm run dev`: Starts local development server on port 3000 with hot reloading.
- `npm run build`: Generates optimized production build and checks TypeScript types.
- `npm run start`: Starts production server.
- `npm run lint`: Runs Next.js ESLint checks.

---

## Backend

The backend is an Express server utilizing native Node.js SQLite (`node:sqlite`) for zero-dependency persistence.

### Available Scripts (`backend/`)
- `npm start`: Starts the API server on port 4000.
- `npm run dev`: Starts the API server with `--watch` mode.
- `npm run scrape`: Executes a full scraping cycle (chunked runs, deduplication, image enrichment, health check).
- `npm run scrape-packs`: Discovers and records multi-pack pricing variants.
- `npm run refresh-images`: Re-syncs product catalog photography.
- `npm run seed-categories`: Discovers all active collection endpoints.
- `npm run demo-break`: Simulates extraction anomaly to verify automated self-healing.
- `npm run test-alerts`: Triggers test notification across registered Telegram subscribers.
- `npm run import-heals`: Imports CLI heal artifacts into database audit timeline.

---

## Scraper

The scraper uses **Bright Data Scraper Studio** collectors to extract client-side rendered Shopify catalog items.

### Authenticating with Bright Data
Authenticate your local CLI session without exposing credentials in code:
```bash
npx -p @brightdata/cli bdata login
```

### Manual Trigger & Inspection
```bash
# Run products collector
npx -p @brightdata/cli bdata scraper run -c <COLLECTOR_ID> --urls https://store.myfrido.com/collections/tt-pillows

# Trigger self-healing prompt
npx -p @brightdata/cli bdata scraper heal -c <COLLECTOR_ID> --prompt "Fix price extraction to capture discounted selling price and MRP"

# Approve and persist healed template
npx -p @brightdata/cli bdata scraper approve <HEAL_ID> --auto-save
```

---

## Telegram Bot

The bot allows shoppers to search products, browse deal tiers, and set up instant price drop alerts.

### Testing Bot Outputs Locally
Test all bot message templates, markdown escaping, and keyboard layouts without a Telegram token:
```bash
cd telegram-bot
npm run preview
```

### Bot User Commands
- `/deals`: Interactive inline keyboard categorized by discount percentage tiers.
- `/latest`: Top 20 products with largest monetary savings.
- `/categories`: Summary of category product counts and lowest starting prices.
- `/watch <product>`: Subscribes to any price movement on the specified item.
- `/watch <product> below <price>`: Sets a custom target price threshold.
- `/watchlist`: Lists all active products monitored by the user.
- `/unwatch <product>`: Removes product from active alerts.
- `/subscribe` / `/unsubscribe`: Storewide broadcast alert toggle.
- `/status`: Live health and update status of the collector.

---

## Build and Testing

### Validate Frontend Build & TypeScript Types
```bash
cd dashboard
npm run build
```

### Validate Telegram Bot Formats
```bash
cd telegram-bot
npm run preview
```

### Verify Backend Endpoints
```bash
# With backend running:
curl http://localhost:4000/api/status
curl http://localhost:4000/api/data
```
