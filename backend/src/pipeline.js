/**
 * The scrape -> detect -> heal -> re-run loop.
 *
 * This is the heart of the project: a run that comes back empty is treated as
 * a broken scraper, not as "no products". We call `bdata scraper heal`, then
 * re-run, and record the whole cycle in heal_events so the dashboard timeline
 * and the demo video have something real to show.
 */
import {
  startRun,
  finishRun,
  insertProducts,
  productsForRun,
  latestSuccessfulRun,
  recordHeal,
  updateHeal,
  setHealCoverageBefore,
  coverageOf,
} from './db.js';
import { runScraper, healScraper, normalizeProduct, COLLECTOR_ID } from './brightdata.js';
import { enrichProducts } from './enrich.js';
import { CORE_CATEGORY_NAMES } from './targets.js';
import { detectAnomalies, healPromptFor } from './anomaly.js';

const DEFAULT_HEAL_PROMPT =
  'The scraper returned zero products for this Shopify collection page. The product grid is ' +
  'rendered client-side after load. Re-locate each product card and re-extract product_name, ' +
  'current_price, original_price, discount_percent, availability, rating, review_count, ' +
  'product_url and image_url.';

/**
 * Run the collector over the URLs in small batches instead of one big one.
 *
 * A single `--urls` call with 31 collections came back with 147 rows total and
 * only one cross-collection duplicate — roughly 5 products per collection,
 * where a lone run of the pillows collection alone returns 13 and cushions 36.
 * The batch is being capped, so the URLs are chunked and the rows concatenated.
 */
async function runChunked({ collectorId, urls, onEvent = () => {} }) {
  const size = Number(process.env.SCRAPE_CHUNK_SIZE) || 4;
  const chunks = [];
  for (let i = 0; i < urls.length; i += size) chunks.push(urls.slice(i, i + size));

  const rows = [];
  const errors = [];
  let anyOk = false;

  for (const [i, chunk] of chunks.entries()) {
    const r = await runScraper({ collectorId, urls: chunk });
    if (r.ok) anyOk = true;
    else if (r.stderr) errors.push(r.stderr);
    rows.push(...r.rows);
    onEvent({ type: 'chunk_done', chunk: i + 1, of: chunks.length, rows: r.rows.length });
  }

  return { ok: anyOk && rows.length > 0, rows, stderr: errors.join('\n').slice(0, 500) };
}

/** Compare two product snapshots and return the changes worth alerting on. */
export function diffSnapshots(previous, current) {
  const prevByUrl = new Map(
    previous.filter((p) => p.product_url).map((p) => [p.product_url, p])
  );
  const currByUrl = new Map(
    current.filter((p) => p.product_url).map((p) => [p.product_url, p])
  );

  const priceChanges = [];
  const newItems = [];
  const backInStock = [];
  const wentOutOfStock = [];

  for (const [url, cur] of currByUrl) {
    const prev = prevByUrl.get(url);
    if (!prev) {
      newItems.push(cur);
      continue;
    }
    if (
      prev.current_price !== null &&
      cur.current_price !== null &&
      prev.current_price !== cur.current_price
    ) {
      priceChanges.push({
        product_name: cur.product_name,
        product_url: url,
        from: prev.current_price,
        to: cur.current_price,
        direction: cur.current_price < prev.current_price ? 'drop' : 'rise',
      });
    }
    const wasOut = /sold\s*out|out of stock|unavailable/i.test(prev.availability ?? '');
    const isOut = /sold\s*out|out of stock|unavailable/i.test(cur.availability ?? '');
    if (wasOut && !isOut) backInStock.push(cur);
    if (!wasOut && isOut) wentOutOfStock.push(cur);
  }

  const removed = [...prevByUrl.keys()].filter((u) => !currByUrl.has(u));

  return {
    priceChanges,
    newItems,
    backInStock,
    wentOutOfStock,
    removed,
    hasChanges:
      priceChanges.length > 0 ||
      newItems.length > 0 ||
      backInStock.length > 0 ||
      wentOutOfStock.length > 0,
  };
}

/**
 * Execute one full cycle.
 * @param {object} opts
 * @param {string[]} opts.urls        Collection URLs to scrape.
 * @param {boolean}  opts.autoHeal    Attempt a heal when extraction comes back empty.
 * @param {function} opts.onEvent     Progress callback (status strings for the UI).
 */
export async function runCycle({
  urls,
  collectorId = COLLECTOR_ID,
  autoHeal = true,
  enrich = process.env.ENRICH !== 'false',
  healPrompt = DEFAULT_HEAL_PROMPT,
  onEvent = () => {},
} = {}) {
  const previous = latestSuccessfulRun();
  const previousProducts = previous ? productsForRun(previous.id) : [];

  const runId = startRun(collectorId, urls.join(','));
  onEvent({ type: 'run_started', runId });

  let result = await runChunked({ collectorId, urls, onEvent });
  let healed = false;

  if (!result.ok && autoHeal) {
    // Empty or failed extraction -> assume the page layout moved and heal.
    onEvent({ type: 'heal_started' });
    const healId = recordHeal({
      collectorId,
      trigger: 'auto',
      prompt: healPrompt,
      status: 'healing',
      detail: result.stderr || 'Extraction returned zero rows',
      itemsBefore: result.rows.length,
    });

    const heal = await healScraper({ collectorId, prompt: healPrompt });

    if (heal.awaitingApproval) {
      updateHeal(healId, {
        status: 'awaiting_approval',
        detail: 'Heal generated and waiting for approval — run POST /api/heal/approve',
      });
      onEvent({ type: 'heal_awaiting_approval' });
      finishRun(runId, {
        status: 'failed',
        error: 'Extraction empty; heal awaiting approval',
      });
      return { runId, ok: false, healAwaitingApproval: true, products: [], diff: null };
    }

    if (heal.ok) {
      onEvent({ type: 'heal_applied' });
      result = await runChunked({ collectorId, urls, onEvent });
      healed = true;
      updateHeal(healId, {
        status: result.ok && heal.saved ? 'healed' : 'failed',
        detail: !heal.saved
          ? 'Heal completed but the template was NOT saved (no save_new_template step) — the collector still runs the old code'
          : result.ok
            ? `Heal saved; re-run returned ${result.rows.length} rows`
            : 'Heal saved but re-run still returned zero rows',
        itemsAfter: result.rows.length,
      });
    } else {
      updateHeal(healId, {
        status: 'failed',
        detail: heal.stderr || 'heal command failed',
        itemsAfter: 0,
      });
      onEvent({ type: 'heal_failed' });
    }
  }

  if (!result.ok) {
    finishRun(runId, {
      status: result.rows.length === 0 ? 'empty' : 'failed',
      itemCount: result.rows.length,
      error: result.stderr || 'Extraction returned zero rows',
    });
    onEvent({ type: 'run_failed', runId });
    return { runId, ok: false, healed, products: [], diff: null };
  }

  // A product can be listed in several collections (a car cushion appears in
  // both Cushions and Workspace), so the same item comes back more than once
  // in a batch run. Keep the first sighting and record the extra categories
  // rather than storing duplicate rows.
  const byUrl = new Map();
  for (const raw of result.rows) {
    const p = normalizeProduct(raw);
    if (!p) continue;
    const key = p.product_url ?? p.product_name;
    const seen = byUrl.get(key);
    if (!seen) {
      byUrl.set(key, p);
      continue;
    }
    // A real product category beats a use-case collection: a pillow first seen
    // under "Hip Pain" should still be labelled "Pillows".
    if (
      p.category &&
      CORE_CATEGORY_NAMES.has(p.category) &&
      !CORE_CATEGORY_NAMES.has(seen.category ?? '')
    ) {
      seen.category = p.category;
    }
    // Prefer whichever sighting actually carried an image.
    if (!seen.image_url && p.image_url) seen.image_url = p.image_url;
  }
  const products = [...byUrl.values()];

  const duplicates = result.rows.length - products.length;
  if (duplicates > 0) onEvent({ type: 'deduplicated', count: duplicates });

  // Backfill images the lazy-loaded grid hid from the scraper.
  if (enrich) await enrichProducts(products, { onEvent });

  insertProducts(runId, products);
  finishRun(runId, { status: 'success', itemCount: products.length });

  // A run can succeed and still be degraded — fewer rows than last time, a
  // field that stopped populating, prices that no longer parse. Those are
  // healable symptoms even though nothing threw.
  const health = detectAnomalies(products, previousProducts);
  if (!health.healthy) {
    onEvent({ type: 'anomalies_detected', anomalies: health.anomalies });
  }

  if (health.shouldHeal && autoHeal) {
    const prompt = healPromptFor(health.critical);
    onEvent({ type: 'degradation_heal_started', summary: health.summary });

    const healId = recordHeal({
      collectorId,
      trigger: 'auto',
      prompt,
      status: 'healing',
      detail: `Degradation detected: ${health.summary}`.slice(0, 500),
      itemsBefore: products.length,
    });
    setHealCoverageBefore(healId, coverageOf(products));

    const heal = await healScraper({ collectorId, prompt });
    updateHeal(healId, {
      // A heal only counts as healed once save_new_template has run; without
      // it every status field still reads success while nothing changed.
      status: heal.awaitingApproval
        ? 'awaiting_approval'
        : heal.saved
          ? 'healed'
          : 'failed',
      detail: heal.awaitingApproval
        ? 'Heal generated from degradation signals — awaiting approval. Approve with --auto-save.'
        : heal.saved
          ? `Saved. Steps: ${heal.steps.join(' → ')}`
          : 'Heal completed but the template was NOT saved — collector still runs the old code',
      itemsAfter: null,
    });
  }

  const diff = previousProducts.length ? diffSnapshots(previousProducts, products) : null;
  onEvent({ type: 'run_succeeded', runId, count: products.length, healed });

  return { runId, ok: true, healed, products, diff, health };
}
