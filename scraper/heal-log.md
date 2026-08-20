# Self-Healing Log

Every entry is a real `bdata scraper heal` invocation against the live
collector. Raw CLI output for each is committed alongside this file.

**Collector ID:** `c_mt11rkfr1irkjzsb9`
**Name:** `frido-products`
**Console:** https://brightdata.com/cp/scrapers/c_mt11rkfr1irkjzsb9
**CLI version:** `@brightdata/cli` 0.3.5

---

## Summary

| # | Target of the heal | Approved | Saved | Changed the output |
|---|---|---|---|---|
| 1 | Populate missing `image_url` | ✅ | ❌ | ❌ |
| 2 | `image_url` via lazy-loaded `data-src`/`srcset` | ✅ | ❌ | ❌ |
| 3 | `discount_percent` as a number | ✅ | ❌ | ❌ |
| 4 | `discount_percent` as a number, **with `--auto-save`** | ✅ | ✅ | ✅ **48/49** |

Heals 1–3 looked like a platform failure. They were not. **Approving a heal and
saving the healed template are two different operations**, and the first three
only did the former.

---

## The trap: approve ≠ save

`bdata scraper heal` stops at an approval gate and returns:

```json
{ "status": "awaiting_approval",
  "next_step": "bdata scraper approve c_mt11rkfr1irkjzsb9" }
```

Running exactly that `next_step` command returns `status: "done"`. Everything
reads like success. But the next `bdata scraper run` returns byte-identical
output, because the healed template was never persisted.

The signal is in `completed_steps`:

```
approve alone      … step_advance → user_approval
approve --auto-save … step_advance → user_approval → save_new_template
```

**`save_new_template` is the only step that means the fix reached the
collector.** Without it, every status field still reads success while nothing
has changed. Both `heal` and `approve` accept `--auto-save`; the `next_step`
hint the CLI prints does not include it.

### How this was diagnosed

Heals 1 and 2 targeted `image_url` and had no effect. The natural assumption was
that the fix was too hard — the images are lazy-loaded, so the URL genuinely is
not in the DOM the run sees.

Heal 3 was designed to eliminate that: `"63% OFF"` → `63` is a pure output
transform requiring no page inspection at all. It converged in 34 poll attempts
against 99 and 144 for the image heals, its preview returned a real number — and
the production run was still 0/49 numeric.

That ruled out difficulty. Also ruled out: a missing approval (every approve
returned `done`), propagation delay (re-checked much later, unchanged), and
version pinning (`--version=dev` returned identical output; note that
`--version dev` without the `=` is swallowed by the CLI's global `-v/--version`
flag and simply prints `0.3.5`).

What went unquestioned for too long was whether `approve` alone was sufficient,
because the CLI's own `next_step` said it was. Reading `--help` in full is what
surfaced `--auto-save`.

---

## Heal #4 — the one that landed

**Raw output:** [`heal-4-autosave.json`](heal-4-autosave.json)

```bash
bdata scraper heal c_mt11rkfr1irkjzsb9 \
  "The discount_percent field is being returned as a string like \"63% OFF\". \
   Change it to return a plain integer instead: 63, 37. If no discount is shown, \
   return null. Do not change any other field." \
  --auto-approve --auto-save
```

Completed steps:

```
planner → control_preview_runner → step_advance → control_preview_runner →
code_fixer → step_preview_runner → request_fulfillment_validator →
step_advance → user_approval → save_new_template
```

Verification run across two collections
([`sample-after-heal4.json`](sample-after-heal4.json)):

| | Before | After |
|---|---|---|
| Numeric `discount_percent` | 0 / 49 | **48 / 49** |
| Sample values | `"37% OFF"`, `"26% OFF"` | `44`, `37`, `26`, `55`, `50` |

The single non-numeric row is a product with no discount shown, returned as
`null` — exactly what the prompt asked for.

**The fix was described in plain English.** No selector, no XPath, no knowledge
of Frido's DOM. The AI located the field, rewrote the extraction, validated it
against the live page, and stopped to ask before shipping.

---

## Heals #1 and #2 — still unresolved, and worth keeping

**Raw output:** [`heal-1.json`](heal-1.json) · [`heal-2.json`](heal-2.json)

Both targeted `image_url`, which came back `null` for 12 of 13 products. Neither
was saved, so neither ever had a chance to work.

They are left in the log rather than re-run, because the image problem turned
out not to be a healing problem at all. Frido's grid lazy-loads its images:
`src` stays a placeholder until a card scrolls into view, and the production run
does not scroll. The URL is genuinely absent from the DOM the scraper sees, so
no prompt could have recovered it.

That was solved outside the collector, by reading `images[0]` from Shopify's own
`/products/{handle}.json` — see [`enrich.js`](../backend/src/enrich.js). Image
coverage went from 8% to 100%.

**Self-healing repairs a scraper whose selectors have drifted. It cannot
conjure data that was never on the page.** Knowing which of the two you are
looking at is the difference between a fix and three wasted heals.

---

## Automated healing in the pipeline

[`pipeline.js`](../backend/src/pipeline.js) does not wait for a run to return
zero rows. [`anomaly.js`](../backend/src/anomaly.js) compares each run against
the last good one and treats degradation as breakage — a coverage regression, a
40%+ row-count collapse, prices that stop parsing, discounts that contradict
their own prices. Any critical anomaly generates a heal prompt describing the
specific symptom.

Two safeguards, both learned here:

- **`saved` is checked, not `status`.** A heal is only recorded as `healed` when
  `completed_steps` contains `save_new_template`; otherwise it is recorded as
  failed with the reason, however successful the status field looks.
- **Unattended runs do not auto-approve.** The scheduler leaves the approval
  gate in place and surfaces `awaiting_approval` on the dashboard. A scraper
  that rewrites itself at 3am with nobody watching is not obviously desirable.
