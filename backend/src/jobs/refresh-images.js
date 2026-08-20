/**
 * Re-point every product in the latest run at the store's own first image.
 *
 * The collection grid supplies a lazy-load placeholder or a secondary shot for
 * some products, so image quality is inconsistent. This takes images[0] from
 * `/products/{handle}.json` for all of them — the same photo the store shows
 * first — without re-running the (much slower) scrape.
 *
 * Usage: node src/jobs/refresh-images.js
 */
import 'dotenv/config';
import { latestSuccessfulRun, productsForRun, updateProductImage } from '../db.js';
import { fetchProductJson } from '../brightdata.js';

const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY) || 5;

const run = latestSuccessfulRun();
if (!run) {
  console.error('[images] no successful run to refresh');
  process.exit(1);
}

const products = productsForRun(run.id).filter((p) => p.product_url);
console.log(`[images] run #${run.id}: refreshing ${products.length} products`);

let changed = 0;
let same = 0;
let failed = 0;
let done = 0;

const queue = [...products];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;

      try {
        const product = await fetchProductJson(p.product_url);
        const src = product?.images?.[0]?.src ?? product?.image?.src ?? null;

        if (!src) {
          failed++;
        } else {
          const url = src.startsWith('//') ? `https:${src}` : src;
          if (url === p.image_url) same++;
          else {
            updateProductImage(p.id, url);
            changed++;
          }
        }
      } catch {
        failed++;
      }

      if (++done % 25 === 0) console.log(`[images] ${done}/${products.length}`);
    }
  })
);

console.log(`[images] done — ${changed} updated, ${same} already correct, ${failed} failed`);
