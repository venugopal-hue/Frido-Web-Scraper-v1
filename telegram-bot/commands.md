# Telegram Bot — command reference

Paste the block below into [@BotFather](https://t.me/BotFather) via
`/setcommands` so the commands autocomplete in chat.

```
latest - Current prices, biggest discounts first
deals - Everything at 50% off or more
categories - Item counts and entry prices per category
subscribe - Get alerts on price drops and restocks
unsubscribe - Stop alerts
status - Scraper health and last heal event
```

`/heal` and `/refresh` are deliberately left out — they are admin-only and
should not autocomplete for the public.

## Public commands

| Command | Reads | Behaviour |
|---|---|---|
| `/start` | — | Welcome + what the bot tracks |
| `/latest` | `GET /api/data` | Top 10 by discount, with prices and stock state |
| `/deals` | `GET /api/data` | Only items at 50%+ off, with MRP struck through |
| `/categories` | `GET /api/data` | Per-category item count and entry price |
| `/subscribe` | `POST /api/subscribers` | Adds this chat to the alert list |
| `/unsubscribe` | `DELETE /api/subscribers/:id` | Removes it |
| `/status` | `GET /api/status` | Health, collector ID, last run, last heal |

## Admin commands

Gated on `TELEGRAM_ADMIN_CHAT_IDS`. Send `/heal` from a non-admin chat and the
bot replies with that chat's ID, which is the easiest way to find your own.

| Command | Calls | Behaviour |
|---|---|---|
| `/heal <what broke>` | `POST /api/heal` | Real `bdata scraper heal`. Reports back if the heal needs approval. |
| `/approve` | `POST /api/heal/approve` | Approves a heal sitting in `awaiting_approval`. |
| `/refresh` | `POST /api/refresh` | Triggers a scrape; auto-heals on empty extraction. |

## Checking message formats without a token

`preview.js` renders every command's output against the live API, so wording,
escaping and number formatting can be checked before the bot is connected:

```bash
npm run preview
```

It caught two real bugs: a backslash leaking into the Collector ID (Telegram
does not interpret formatting inside a `code span`, so escaping there renders
literally), and blank-line separators being stripped from `/status`.

`/heal` is the live-demo trick: run it from a phone and watch the dashboard
status flip to **Healing** in the same shot.

## Alerts

The scheduler diffs each run against the previous snapshot and pushes to every
subscribed chat when something meaningful changed:

| Trigger | Message |
|---|---|
| Price drop | `📉 Frido Travel Neck Pillow: ₹1,299 → ₹999` |
| Price rise | `📈 …` |
| New product | `🆕 Frido Crescent Adjustable Pillow — ₹1,499` |
| Back in stock | `✅ Back in stock: Frido Ortho Memory Foam Pillow` |
| Sold out | `⛔ Sold out: Frido Cervical Butterfly Pillow` |
| Self-heal fired | `🩹 Scraper self-healed` |

Diff logic lives in `diffSnapshots()` in
[`backend/src/pipeline.js`](../backend/src/pipeline.js) — it keys on
`product_url` rather than name, so a product rename does not read as a
delete plus an add.

The alert *text* is built by
[`backend/src/format-alert.js`](../backend/src/format-alert.js), not by the bot.
The backend is what broadcasts, so that is the single canonical copy; the bot's
preview imports the same module rather than keeping its own.

## Notes

- Product names are escaped before sending; Telegram's Markdown parser breaks
  on stray `_`, `*`, `[`, `]` and backticks, which real product names contain.
- The bot performs **no scraping of its own**. Every command is a read against
  the same API the dashboard uses, so the two surfaces cannot drift.
