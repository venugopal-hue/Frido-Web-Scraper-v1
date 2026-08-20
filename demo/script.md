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

- Status bar: **Healthy**, Collector ID, 146 products
- Stats row: products, average discount, total MRP savings, out of stock
- Tap the **Pillows** chip, then sort by **Biggest discount**
- Point out a **📦 pack price** card — "the tile says ₹349, but four of them
  cost ₹174.80 each. The store never shows you that in a list view."
- Click a card → price history modal, with lowest/highest seen

### 4 · Self-healing — the centrepiece (1:20–2:20) — *Reliability*

**This is the most important shot. Do not rush it.**

⚠️ **Read this before recording.** Three heals were run against this collector.
All three generated a validated fix and were approved. **None changed the
scraper's output.** Do not script a "watch it fix itself" reveal — there isn't
one to show. What there *is*, and what is arguably worth more, is a rigorous
diagnosis. Play that.

Show the real defect:

```bash
cat scraper/sample-after-heal2.json | grep -o '"discount_percent":"[^"]*"' | head -3
# "discount_percent":"63% OFF"
```

> "A string where the dashboard needs a number. I never touched the scraper's
> code — I just described what looked wrong."

```bash
bdata scraper heal c_mt11rkfr1irkjzsb9 \
  "discount_percent is returned as a string like \"63% OFF\". Return a plain
   integer instead. Do not change any other field."
```

Let the step log run. Land on:

```
Heal ready — awaiting approval (collector c_mt11rkfr1irkjzsb9).
```

> "It didn't apply itself. It generated the fix, validated it against the live
> page, and stopped to ask. That human-in-the-loop step is the right default."

Show the preview returning a real number, then approve:

```bash
bdata scraper approve c_mt11rkfr1irkjzsb9   # → status: done
bdata scraper run c_mt11rkfr1irkjzsb9 ... --pretty
```

**Then the honest turn — the strongest 30 seconds in the video:**

> "And the output is unchanged. Still `"63% OFF"`. Zero of forty-nine rows
> numeric."

Open `scraper/heal-log.md` and walk the elimination:

> "So I ruled it out properly. Not the difficulty of the fix — this one needed
> no page inspection at all, just parsing a string, and it converged in 34 polls
> instead of 144. Not a missing approval — every approve returned `done`. Not
> propagation lag — I re-ran it much later, same output. Not version pinning —
> and I found a CLI bug on the way: `run --version dev` is swallowed by the
> global version flag, it prints 0.3.5 and exits. Using `--version=dev` runs,
> and returns identical output.
>
> The heal invocation is real and it works. The heal effect doesn't reach
> production output in CLI 0.3.5. That's a platform issue, not something my
> code can route around."

Then show the mitigation in `backend/src/brightdata.js`:

> "So the backend is written to not care. `normalizeProduct` accepts the string
> form and the numeric form of every field. Whenever the heal does land,
> nothing downstream changes."

Cut to the dashboard timeline showing all three events with their true statuses.

> "Two failed, one failed. That's what the timeline says, because that's what
> happened. A self-healing scraper that only ever succeeds in the demo isn't
> evidence of anything."

### 5 · Telegram (2:20–2:45) — *Creativity / completeness*

On a phone, or Telegram Desktop:

- `/latest` → formatted prices
- `/status` → health, last run, last heal event
- `/heal images are coming back null` → admin-only, real CLI call from chat
- Watch the dashboard status flip to **Healing** in the same shot

> "Same database, same API. The bot does no scraping of its own — the two
> surfaces can't drift apart."

### 6 · Code (2:45–3:00) — *Technical excellence*

Scroll `backend/src/pipeline.js`, pause on the failure branch:

> "An empty extraction is treated as a broken scraper, not an empty catalogue.
> That's what triggers the heal, automatically, at 3am, without me."

Then `.github/workflows/scrape-and-heal.yml`.

> "Every six hours. It fixes itself while you sleep."

---

## Recording notes

- Terminal at 16pt+ — CLI output must be legible on a phone
- `clear` between commands
- The `heal` call takes 5–10 minutes: **record it live, then cut the middle of
  the poll log**. Never cut the start or the result.
- Never show `.env`, the API key, or the bot token
- Filming the failed image heal alongside the successful one is a feature, not
  a liability — it is the difference between a demo and evidence
