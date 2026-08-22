/**
 * Render every bot message against the live API without a Telegram token.
 *
 * Useful for checking wording, escaping and number formatting before the bot
 * is ever connected: `npm run preview`
 */
import 'dotenv/config';
import {
  buildStart,
  buildLatest,
  buildDealsPage,
  buildCategories,
  buildStatus,
  buildWatchlist,
  bandCounts,
  BANDS,
} from './format.js';
// Canonical alert formatter — imported from the backend so this preview shows
// exactly what subscribers receive, not a copy that can drift.
import { formatDiff } from '../backend/src/format-alert.js';

const API = (process.env.API_BASE_URL ?? 'https://frido-web-scraper-v1-1.onrender.com').replace(/\/$/, '');

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function show(title, body) {
  // Builders may return a single string or an array of paginated messages.
  const pages = Array.isArray(body) ? body : [body];
  pages.forEach((page, i) => {
    const label = pages.length > 1 ? `${title} [msg ${i + 1}/${pages.length}]` : title;
    console.log(`\n\x1b[36m┌─ ${label} ${'─'.repeat(Math.max(0, 58 - label.length))}\x1b[0m`);
    for (const line of page.split('\n')) console.log(`\x1b[36m│\x1b[0m ${line}`);
    console.log(`\x1b[36m└${'─'.repeat(60)} ${page.length} chars\x1b[0m`);
  });
}

try {
  const [data, status] = await Promise.all([get('/api/data'), get('/api/status')]);

  show('/start', buildStart());
  show('/latest', buildLatest(data));

  // One page per band, plus the button labels the keyboard will carry.
  const counts = bandCounts(data.products);
  console.log(
    `\n\x1b[36m── /deals keyboard ──\x1b[0m\n` +
      BANDS.map((b) => `[${b.label} (${counts[b.id]})]`).join('  ')
  );
  for (const b of BANDS) {
    const view = buildDealsPage(data, b.id, 0);
    show(`/deals → ${b.label} (page 1/${view.totalPages})`, view.text);
  }

  show('/categories', buildCategories(data));
  show('/status', buildStatus(status));

  // Watchlist with a synthetic entry so the layout can be reviewed.
  const first = data.products[0];
  show(
    '/watchlist',
    buildWatchlist(
      first ? [{ product_url: first.product_url, product_name: first.product_name }] : [],
      data.products
    )
  );

  // Synthetic diff so the alert format can be reviewed before one fires.
  const [a, b] = data.products;
  show(
    'alert (synthetic diff)',
    formatDiff({
      priceChanges: a
        ? [
            {
              product_name: a.product_name,
              from: (a.current_price ?? 0) + 300,
              to: a.current_price,
              direction: 'drop',
            },
          ]
        : [],
      newItems: b ? [b] : [],
      backInStock: [],
      wentOutOfStock: [],
    })
  );

  console.log('\n✓ All message formats rendered.\n');
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  console.error(`  Is the backend running at ${API}?\n`);
  process.exit(1);
}
