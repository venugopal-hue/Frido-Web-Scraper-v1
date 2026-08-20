/**
 * Backfill fields the collection-grid scraper cannot see.
 *
 * Frido's grid lazy-loads product images, so `image_url` comes back null for
 * most rows and no amount of healing fixes it — the production run never
 * scrolls the cards into view. Shopify exposes `/products/{handle}.json` per
 * product, which carries the full image list, so we fill the gap from there.
 */
import { fetchProductJson } from './brightdata.js';

/** Run `worker` over `items` with a bounded number in flight at once. */
async function pooled(items, limit, worker) {
  const queue = [...items.entries()];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await worker(next[1], next[0]);
    }
  });
  await Promise.all(runners);
}

/**
 * Fill missing image_url (and product_type as a category fallback) in place.
 *
 * @param {object[]} products  Normalised products; mutated.
 * @param {object}   opts
 * @param {number}   opts.concurrency  Parallel Web Unlocker requests.
 * @param {function} opts.onEvent      Progress callback.
 */
export async function enrichProducts(
  products,
  {
    concurrency = Number(process.env.ENRICH_CONCURRENCY) || 5,
    /**
     * 'missing' — only products with no image. One request per new product,
     *   which on a repeat run is usually zero. This is the right default for a
     *   frequent schedule: product photos essentially never change, and
     *   re-fetching all of them hourly is thousands of pointless requests.
     * 'all' — re-point every product at the store's current images[0].
     *   Use `npm run refresh-images` for that instead.
     */
    mode = process.env.ENRICH_MODE ?? 'missing',
    onEvent = () => {},
  } = {}
) {
  const missing = products.filter(
    (p) => p.product_url && (mode === 'all' || !p.image_url)
  );
  if (!missing.length) return { attempted: 0, filled: 0 };

  onEvent({ type: 'enrich_started', count: missing.length, mode });

  let filled = 0;
  let failed = 0;

  await pooled(missing, concurrency, async (p) => {
    try {
      const product = await fetchProductJson(p.product_url);
      if (!product) {
        failed++;
        return;
      }

      const src = product.images?.[0]?.src ?? product.image?.src ?? null;
      if (src) {
        p.image_url = src.startsWith('//') ? `https:${src}` : src;
        filled++;
      }

      // The grid omits price for a few cards; the variant price is authoritative.
      if (p.current_price === null && product.variants?.[0]?.price) {
        const n = parseFloat(product.variants[0].price);
        if (Number.isFinite(n)) p.current_price = n;
      }
    } catch {
      failed++;
    }
  });

  onEvent({ type: 'enrich_finished', filled, failed, attempted: missing.length });
  return { attempted: missing.length, filled, failed };
}
