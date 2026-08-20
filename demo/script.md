# Demo Video — shot list

Target length: **3 minutes**. Each shot maps to a judged criterion.

Before recording:

```bash
cd backend && npm start            # :4000
cd dashboard && npm run dev        # :3000
cd telegram-bot && npm start
```

Check no `.env` file, API key or bot token is visible in any terminal pane.

---

### 1 · The problem (0:00–0:25) — *Impact*

Frido's store on screen. Point at the discount badges.

> "Frido runs permanent discount campaigns — 51% average discount across the
> catalogue, and nearly a third of products already sold out. Prices move
> constantly and there's no price history, no restock alert, nothing."

Then the catch, in a terminal:

```bash
bdata scrape https://store.myfrido.com/collections/tt-pillows --format markdown | grep -c "₹"
# 1
```

> "One rupee sign on the whole page — and it's a promo banner. The grid is
> client-side rendered. A plain fetch gets you nothing, and any selector you
> hand-write against a Shopify theme is one deploy away from breaking."

### 2 · Building the scraper (0:25–0:50) — *Use of Scraper Studio*

Show the create command and its Collector ID:

```bash
bdata scraper create "https://store.myfrido.com/collections/tt-pillows" \
  "For each product card extract product_name, current_price, original_price, \
   discount_percent, availability, product_url, image_url..." \
  --name frido-products
# → c_mt11rkfr1irkjzsb9
```

> "Plain English in, working scraper out — nine AI build steps, no selectors."

Then a live run returning real rows:

```bash
bdata scraper run c_mt11rkfr1irkjzsb9 \
  --urls "...tt-pillows,...tt-cushions-all-products" --pretty
# 49 products
```

### 3 · The dashboard (0:50–1:20) — *Presentation / UI*

`localhost:3000`. Clean light UI — the product photos are the colour on the
page, which is the point: they are shown exactly as the store serves them.

- Status bar: **Live**, Collector ID, 146 products
- Stats row: products, average discount, total MRP savings, out of stock
- Tap the **Pillows** chip, then sort by **Biggest discount**
- Point out a **📦 pack price** card — "the tile says ₹349, but four of them
  cost ₹174.80 each. The store never shows you that in a list view."
- Click a card → price history modal, with lowest/highest seen

### 4 · Self-healing — the centrepiece (1:20–2:20) — *Reliability*

**This is the most important shot. Do not rush it.**

Show the defect first — the field coming back as a string:

```bash
cat scraper/sample-after-heal3.json | grep -o '"discount_percent":"[^"]*"' | head -3
# "discount_percent":"63% OFF"
```

> "A string where the dashboard needs a number. I never opened the scraper's
> code — I just described what looked wrong."

```bash
bdata scraper heal c_mt11rkfr1irkjzsb9 "discount_percent is returned as a string like '63% OFF'. Return a plain integer instead. If no discount is shown, return null." --auto-approve --auto-save
```

Land on the completed steps, and point at the last one:

```
… request_fulfillment_validator → step_advance → user_approval → save_new_template
```

Then the verification run:

```bash
bdata scraper run c_mt11rkfr1irkjzsb9 --urls "...tt-pillows,...tt-cushions-all-products" --pretty
# discount_percent: 44, 37, 26, 55, 50
# NUMERIC: 48 / 49
```

> "Zero of forty-nine before. Forty-eight of forty-nine after — the one
> exception is a product with no discount, returned as null, which is what I
> asked for."

**Then the part worth more than the success — the trap (30 seconds):**

Open `scraper/heal-log.md`.

> "Three earlier heals did nothing, and it took a while to work out why.
> Approving a heal and *saving* it are two different operations. The CLI hands
> you a `next_step` field that says run `bdata scraper approve <id>` — you run
> exactly that, it returns `status: done`, and the fix is never persisted. The
> next run quietly executes the old code.
>
> The tell is one step in the log. A heal that landed ends with
> `save_new_template`. One that didn't ends at `user_approval`. Everything else
> — status, exit code, the preview — looks identical.
>
> So the pipeline checks for that step, not the status field."

Show the guard in `backend/src/brightdata.js`:

```js
saved: steps.includes('save_new_template'),
```

> "A heal only counts as healed when the template was actually saved."

Cut to the dashboard timeline showing the before/after field coverage per heal.

### 5 · Telegram (2:20–2:45) — *Creativity / completeness*

On a phone, or Telegram Desktop:

- `/latest` → formatted prices
- `/status` → tracker state, last run, last heal event
- `/heal images are coming back null` → admin-only, real CLI call from chat
- Watch the dashboard status flip to **Repairing** in the same shot

> "Same database, same API. The bot does no scraping of its own — the two
> surfaces can't drift apart."

### 6 · Code (2:45–3:00) — *Technical excellence*

Scroll `backend/src/pipeline.js`, pause on the failure branch:

> "An empty extraction is treated as a broken scraper, not an empty catalogue.
> That's what triggers the heal, automatically, at 3am, without me."

Then `backend/src/scheduler.js`.

> "Runs every hour on its own. It fixes itself while you sleep."

---

## Recording notes

- Terminal at 16pt+ — CLI output must be legible on a phone
- `clear` between commands
- The `heal` call takes 5–10 minutes: **record it live, then cut the middle of
  the poll log**. Never cut the start or the result.
- Never show `.env`, the API key, or the bot token
- Keep the three failed heals in the story. A working heal is table stakes;
  knowing *why* three of them silently did nothing, and having the pipeline
  guard against it, is the part that shows you actually ran this thing
