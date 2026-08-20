/**
 * Scrape multi-pack pricing from product pages.
 *
 * Collection pages show only the single-unit price, so a product listed at
 * ₹699 may actually cost ₹574.80 per unit in a pack of four — a better deal
 * than the headline discount, and one the storefront never surfaces in a list
 * view. This fills that in from a second collector.
 *
 * Usage: node src/jobs/scrape-packs.js [limit]
 */
import 'dotenv/config';
import { latestSuccessfulRun, productsForRun, replacePacks, packCount } from '../db.js';
import { runScraper } from '../brightdata.js';

const COLLECTOR = process.env.PACKS_COLLECTOR_ID;
if (!COLLECTOR) {
  console.error('[packs] PACKS_COLLECTOR_ID is not set — see .env.example');
  process.exit(1);
}

const CHUNK = Number(process.env.SCRAPE_CHUNK_SIZE) || 4;
const limit = Number(process.argv[2]) || Infinity;

const run = latestSuccessfulRun();
if (!run) {
  console.error('[packs] no successful product run yet — run `npm run scrape` first');
  process.exit(1);
}

const urls = productsForRun(run.id)
  .map((p) => p.product_url)
  .filter(Boolean)
  .slice(0, limit);

console.log(`[packs] ${urls.length} product pages, ${CHUNK} per call`);

let withPacks = 0;
let withoutPacks = 0;

for (let i = 0; i < urls.length; i += CHUNK) {
  const chunk = urls.slice(i, i + CHUNK);
  const result = await runScraper({ collectorId: COLLECTOR, urls: chunk });

  for (const row of result.rows) {
    const url = row?.input?.url;
    if (!url) continue;

    // Only rows with more than one option are interesting: a lone "1 Pillow"
    // entry tells us nothing the collection page did not already say.
    const options = Array.isArray(row.pack_options) ? row.pack_options : [];
    const usable = options.filter((o) => o.pack_label && o.price_per_unit);

    if (usable.length > 1) {
      replacePacks(url, usable);
      withPacks++;
    } else {
      withoutPacks++;
    }
  }

  console.log(
    `[packs] ${Math.min(i + CHUNK, urls.length)}/${urls.length} — ${withPacks} with packs`
  );
}

console.log(
  `[packs] done — ${withPacks} products have multi-pack pricing, ${withoutPacks} do not. ` +
    `${packCount()} stored in total.`
);
