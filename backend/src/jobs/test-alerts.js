/**
 * Prove the alert path works, end to end, without waiting for a real price
 * change.
 *
 * The diff -> format -> Telegram chain had never actually executed: prices had
 * not moved between any two runs, so every scheduled run found nothing to send.
 * An untested notification path is a bad thing to discover during a demo.
 *
 * Builds a synthetic diff from two real products, runs it through the same
 * formatter and sender the scheduler uses, and sends it to subscribers and
 * watchers. Messages are clearly marked as a test so nobody reads them as a
 * genuine price drop.
 *
 * Usage: node src/jobs/test-alerts.js
 */
import 'dotenv/config';
import { latestProducts, allSubscribers, watchersByUrl } from '../db.js';
import { notifySubscribers, notifyWatchers } from '../notify.js';
import { formatDiff } from '../format-alert.js';

const { products } = latestProducts();
if (products.length < 2) {
  console.error('[test-alerts] need at least two products — run `npm run scrape` first');
  process.exit(1);
}

const subs = allSubscribers();
const watchers = watchersByUrl();

console.log(`[test-alerts] ${subs.length} subscriber(s), ${watchers.size} watched product(s)`);

if (!subs.length && !watchers.size) {
  console.error('[test-alerts] nobody to notify — send /subscribe or /watch to the bot first');
  process.exit(1);
}

// Prefer a watched product so the per-product path is exercised too.
const watchedUrl = [...watchers.keys()][0];
const primary = products.find((p) => p.product_url === watchedUrl) ?? products[0];
const secondary = products.find((p) => p.id !== primary.id) ?? products[1];

const diff = {
  priceChanges: [
    {
      product_name: primary.product_name,
      product_url: primary.product_url,
      from: (primary.current_price ?? 1000) + 250,
      to: primary.current_price ?? 1000,
      direction: 'drop',
    },
  ],
  newItems: [],
  backInStock: [secondary],
  wentOutOfStock: [],
  hasChanges: true,
};

console.log(`[test-alerts] simulating a price drop on "${primary.product_name}"`);

const banner = '🧪 *TEST ALERT — no prices actually changed*\n\n';

const broadcast = await notifySubscribers(banner + formatDiff(diff));
console.log(`[test-alerts] broadcast: ${broadcast.sent}/${broadcast.total ?? 0} chat(s)`);

const watched = await notifyWatchers(diff);
console.log(`[test-alerts] watch alerts: ${watched.sent}/${watched.total ?? 0} chat(s)`);

const ok = broadcast.sent > 0 || watched.sent > 0;
console.log(
  ok
    ? '[test-alerts] ✓ delivered — the alert path works'
    : '[test-alerts] ✗ nothing delivered — check TELEGRAM_BOT_TOKEN in backend/.env'
);
process.exit(ok ? 0 : 1);
