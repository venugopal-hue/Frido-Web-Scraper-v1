# Self-Healing Log

Every entry is a real `bdata scraper heal` invocation against the live
collector. Raw CLI output for each is committed alongside this file.

**Collector ID:** `c_mt11rkfr1irkjzsb9`
**Name:** `frido-products`
**Console:** https://brightdata.com/cp/scrapers/c_mt11rkfr1irkjzsb9
**Target:** Frido store collection pages (`https://store.myfrido.com/collections/*`)
**CLI version:** `@brightdata/cli` 0.3.5

---

## Summary

| # | Target of the heal | Generated | Approved | Took effect in a real run |
|---|---|---|---|---|
| 1 | Populate missing `image_url` | ✅ | ✅ | ❌ |
| 2 | `image_url` via lazy-loaded `data-src`/`srcset` | ✅ | ✅ | ❌ |
| 3 | `discount_percent` as a number, not `"63% OFF"` | ✅ | ✅ | ❌ |

All three heals **generated a validated fix and were approved successfully**.
None of the three changed the output of a subsequent `bdata scraper run`.

That finding is the point of this document. See
[Diagnosis](#diagnosis-why-none-of-the-heals-took-effect) below.

---

## Heal #1 — missing product images

**Raw output:** [`heal-1.json`](heal-1.json) · [`heal-1-approve.json`](heal-1-approve.json)

### The break

The scraper produced by `bdata scraper create` extracted names, prices,
discounts and availability correctly but returned **`image_url: null` for 12 of
13 products**. Not a simulated break — a genuine defect, found by diffing the
first run against the schema the dashboard needed.

### The heal

```bash
bdata scraper heal c_mt11rkfr1irkjzsb9 \
  "Most product cards are returning image_url as null - only 1 of 13 products had an image. \
   Each product card in the collection grid contains a product photo (a cdn.shopify.com image). \
   Re-locate the primary product image inside every product card and populate image_url with \
   its absolute URL for every row. Keep all existing fields unchanged."
```

Eight steps ran — `planner`, `control_preview_runner`, `step_advance`,
`control_preview_runner`, `code_fixer`, `step_preview_runner`,
`request_fulfillment_validator`, `step_advance` — landing on:

```
Heal ready — awaiting approval (collector c_mt11rkfr1irkjzsb9).
```

The CLI did **not** apply the fix silently. It returned
`status: "awaiting_approval"` with a preview row and a proposed 2-step template,
keeping a human in the loop. The preview row showed `image_url` populated and
every other field unchanged — exactly what was asked for.

```bash
bdata scraper approve c_mt11rkfr1irkjzsb9   # → status: "done", step user_approval added
```

### The result

Re-ran the approved collector across two collections (49 rows):

| | Before | After |
|---|---|---|
| Rows with `image_url` | 1 / 13 (7.7%) | 4 / 49 (**8.2%**) |

**No improvement.** The preview had shown a fix that did not appear in
production output.

---

## Heal #2 — same field, targeting the suspected cause

**Raw output:** [`heal-2.json`](heal-2.json) · [`heal-2-approve.json`](heal-2-approve.json)

Hypothesis: Shopify lazy-loads grid images, so `src` is a placeholder until a
card scrolls into view and the real URL lives in `data-src`/`srcset`. The heal
prompt named that mechanism explicitly and asked for verification across more
than one card.

Result: `awaiting_approval` again, preview again showed a populated
`image_url`, approval returned `done`. Real run: **4 / 49 — unchanged.**

---

## Heal #3 — a fix with no DOM discovery in it

**Raw output:** [`heal-3.json`](heal-3.json) · [`heal-3-approve.json`](heal-3-approve.json)

To separate "the AI can't find the image node" from "heals aren't landing at
all", heal #3 targeted something that requires no page inspection whatsoever —
a pure output transform:

```bash
bdata scraper heal c_mt11rkfr1irkjzsb9 \
  "The discount_percent field is being returned as a string like \"63% OFF\". \
   Change it to return a plain integer number instead: 63, 37. ... \
   Do not change any other field."
```

This converged much faster — **34 poll attempts vs 99 and 144** for the image
heals, consistent with a far simpler change. The preview returned:

```json
"discount_percent": 63    // a number, not a string
```

Approved: `status: "done"`.

Real run across 49 rows:

```
discount_percent types: {"string": 48, "undefined": 1}
samples: "37% OFF", "26% OFF", "34% OFF", "44% OFF", "50% OFF"
numeric: 0 / 49 = 0%
```

**Zero effect.**

---

## Diagnosis: why none of the heals took effect

Three heals, three different targets, one identical outcome. Ruled out in turn:

**1. Not the difficulty of the fix.** Heal #3 required no DOM discovery at all —
just parsing `"63% OFF"` into `63`. It still had no effect.

**2. Not a missing approval step.** Every heal was approved and every approval
returned `status: "done"` with `user_approval` appended to `completed_steps`.

**3. Not propagation lag.** The default version was re-run well after heal #3's
approval, and still returned `"60% OFF"`, `"44% OFF"`, `"52% OFF"` and 1/13
images. See [`sample-recheck.json`](sample-recheck.json).

**4. Not a version-pinning mistake.** `bdata scraper run` documents a
`--version` flag ("e.g. `dev`"), suggesting heals might land on a draft version
that runs don't read. Two notes on this:

- `--version dev` is **swallowed by the CLI's own global `-v, --version` flag** —
  it prints `0.3.5` and exits without running the scraper. The `--version=dev`
  form is required to reach the subcommand. That is a CLI bug in 0.3.5.
- With `--version=dev` the run does execute (13 rows), but the output is
  identical to the default version: strings, 1/13 images. See
  [`sample-dev-version.json`](sample-dev-version.json).

**Conclusion:** in `@brightdata/cli` 0.3.5, the
`heal` → `approve` → `run` cycle completes with success statuses at every step,
but the approved fix is not reflected in the collector that `run` executes —
on either the default or `dev` version. The heal *invocation* is demonstrably
real and working; the heal *effect* does not reach production output.

This is a platform-side behaviour, not something the application code can work
around, and it is worth raising with Bright Data.

## What the application does about it

The backend is written so a heal changing the output shape cannot break it.
`normalizeProduct()` accepts both forms of every field it reads:

```
old string form  "63% OFF"  → 63
new numeric form  63        → 63
null form         null      → null
```

So whenever the heal *does* land, the pipeline keeps working with no code
change. Verified — see `normalizeProduct()` in
[`backend/src/brightdata.js`](../backend/src/brightdata.js).

## Automated healing in the pipeline

These three heals were invoked by hand. The same call is wired to fire without
a human in [`backend/src/pipeline.js`](../backend/src/pipeline.js): a run
returning zero rows is treated as a broken scraper rather than an empty
catalogue, which triggers `heal` → re-run → record, and pushes a Telegram alert
if the heal recovered the run. `awaiting_approval` responses are surfaced on the
dashboard rather than auto-approved, preserving the human-in-the-loop step that
the CLI itself enforces.
