import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import {
  latestProducts,
  recentRuns,
  latestRun,
  latestSuccessfulRun,
  recentSuccessfulRuns,
  activeRun,
  healEvents,
  activeHeal,
  allCategories,
  priceHistory,
  addSubscriber,
  removeSubscriber,
  allSubscribers,
  recordHeal,
  updateHeal,
  reapStaleRuns,
  reapStaleHeals,
  packsByUrl,
  productsForRun,
  addWatch,
  removeWatch,
  watchesForChat,
  allWatchedUrls,
  sparklineData,
} from './db.js';
import { runCycle, diffSnapshots } from './pipeline.js';
import { healScraper, approveHeal, COLLECTOR_ID } from './brightdata.js';
import { startScheduler } from './scheduler.js';
import { getProgress, trackProgress, clearProgress } from './progress.js';
import { withDealScores } from './deal-score.js';
import { targetUrls } from './targets.js';

const app = express();
app.use(cors());
app.use(express.json());

// Prevent Vercel edge/proxies from caching dynamic API responses
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const PORT = process.env.PORT ?? 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

// Guards the endpoints that spend Bright Data credits or mutate the scraper.
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next(); // open in local dev when no token is configured
  const provided = req.get('x-admin-token') ?? req.query.token;
  if (provided !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Only one scrape may be in flight at a time — the CLI bills per run and
// concurrent AI-Flow jobs hit a 429 cap.
let inFlight = null;

/* ---------------- read endpoints ---------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true, collector_id: COLLECTOR_ID }));

app.get('/api/data', (_req, res) => {
  const { run, products } = latestProducts();
  // Annotated with price context so both surfaces can say whether today's
  // price is actually good, not just what it is.
  const scored = withDealScores(products);
  const packs = packsByUrl();

  const enriched = scored.map((p) => {
    const options = p.product_url ? packs.get(p.product_url) : null;
    if (!options?.length) return p;

    // The cheapest per-unit option, which is often not the one on the tile.
    const best = options.reduce((a, b) =>
      (b.price_per_unit ?? Infinity) < (a.price_per_unit ?? Infinity) ? b : a
    );
    const unitSaving =
      p.current_price && best.price_per_unit
        ? Math.round(((p.current_price - best.price_per_unit) / p.current_price) * 100)
        : 0;

    return {
      ...p,
      packs: options,
      best_pack:
        unitSaving > 0
          ? {
              label: best.pack_label,
              unit_count: best.unit_count,
              price_per_unit: best.price_per_unit,
              total_price: best.total_price,
              unit_saving_percent: unitSaving,
            }
          : null,
    };
  });

  res.json({ run, count: enriched.length, products: enriched });
});

app.get('/api/categories', (_req, res) => res.json({ categories: allCategories() }));

/**
 * The latest snapshot as CSV.
 *
 * Values are quoted and internal quotes doubled — product names contain commas
 * and apostrophes, and an unescaped comma silently shifts every later column.
 */
app.get('/api/export.csv', (_req, res) => {
  const { run, products } = latestProducts();
  const packs = packsByUrl();

  const columns = [
    'product_name',
    'category',
    'current_price',
    'original_price',
    'discount_percent',
    'availability',
    'best_pack_label',
    'best_pack_price_per_unit',
    'product_url',
    'image_url',
    'scraped_at',
  ];

  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = products.map((p) => {
    const options = p.product_url ? packs.get(p.product_url) : null;
    const best = options?.length
      ? options.reduce((a, b) => ((b.price_per_unit ?? Infinity) < (a.price_per_unit ?? Infinity) ? b : a))
      : null;
    const cheaper = best && p.current_price && best.price_per_unit < p.current_price ? best : null;

    return [
      p.product_name,
      p.category,
      p.current_price,
      p.original_price,
      p.discount_percent,
      p.availability,
      cheaper?.pack_label ?? '',
      cheaper?.price_per_unit ?? '',
      p.product_url,
      p.image_url,
      p.scraped_at,
    ]
      .map(cell)
      .join(',');
  });

  const stamp = (run?.finished_at ?? new Date().toISOString()).slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="frido-prices-${stamp}.csv"`);
  // BOM so Excel opens the rupee sign and product names as UTF-8.
  res.send('﻿' + [columns.join(','), ...rows].join('\r\n'));
});

app.get('/api/runs', (req, res) =>
  res.json({ runs: recentRuns(Number(req.query.limit) || 20) })
);

app.get('/api/history', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query parameter is required' });
  res.json({ product_url: url, points: priceHistory(String(url)) });
});

app.get('/api/heals', (_req, res) => res.json({ events: healEvents() }));

/**
 * What changed between the last two successful runs.
 *
 * The pipeline already computes this on every run to decide what to send to
 * Telegram, but the result was thrown away afterwards — the dashboard had no
 * way to show it. Recomputing here keeps one definition of "changed".
 */
app.get('/api/changes', (_req, res) => {
  const [current, previous] = recentSuccessfulRuns(2);
  if (!current || !previous) {
    return res.json({
      diff: null,
      reason: 'needs two completed runs to compare',
      from: null,
      to: current ?? null,
    });
  }

  const diff = diffSnapshots(productsForRun(previous.id), productsForRun(current.id));
  res.json({ diff, from: previous, to: current });
});

/** Every watched product across all chats — what the dashboard shows. */
app.get('/api/watchlist', (_req, res) => res.json({ watches: allWatchedUrls() }));

/** Bulk price series, so the grid does not make one request per card. */
app.get('/api/sparklines', (_req, res) => res.json({ series: sparklineData() }));

/** Single call the dashboard status bar and the bot's /status both read. */
app.get('/api/status', (_req, res) => {
  const run = latestRun();
  const lastGood = latestSuccessfulRun();
  const heal = activeHeal();
  const events = healEvents(5);

  // A run interrupted by the machine sleeping is not a broken scraper. If the
  // last attempt failed but a recent run succeeded, the data is merely stale —
  // reporting "broken" there sends you hunting for a fault that does not exist.
  const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
  const lastGoodAt = lastGood?.finished_at ? Date.parse(lastGood.finished_at) : 0;
  const haveRecentData = lastGoodAt && Date.now() - lastGoodAt < STALE_AFTER_MS;
  const interrupted = /interrupted/i.test(run?.error ?? '');

  let health = 'unknown';
  if (heal) health = heal.status === 'awaiting_approval' ? 'awaiting_approval' : 'healing';
  else if (inFlight) health = 'running';
  else if (run?.status === 'success') health = 'healthy';
  else if (run && haveRecentData) health = interrupted ? 'healthy' : 'stale';
  else if (run) health = 'broken';

  res.json({
    health,
    collector_id: COLLECTOR_ID,
    // The figures people read should come from the last run that produced
    // data, not from a failed attempt that produced none.
    last_run: lastGood ?? run ?? null,
    last_attempt: run ?? null,
    scraping: Boolean(inFlight),
    progress: getProgress(),
    last_heal: events[0] ?? null,
    recent_heals: events,
    subscribers: allSubscribers().length,
  });
});

/* ---------------- write endpoints ---------------- */

app.post('/api/refresh', requireAdmin, async (req, res) => {
  // Two layers: this process's own promise, and the shared DB lock that also
  // catches the scheduler and the CLI.
  if (inFlight) return res.status(409).json({ error: 'a scrape is already running' });
  const busy = activeRun();
  if (busy) {
    return res
      .status(409)
      .json({ error: `run #${busy.id} is already in progress`, run_id: busy.id });
  }

  const urls = Array.isArray(req.body?.urls) && req.body.urls.length
    ? req.body.urls
    : targetUrls();
  const autoHeal = req.body?.autoHeal !== false;

  inFlight = runCycle({ urls, autoHeal, onEvent: trackProgress })
    .catch((err) => ({ ok: false, error: String(err) }))
    .finally(() => {
      inFlight = null;
      clearProgress();
    });

  if (req.body?.wait === false) {
    return res.status(202).json({ accepted: true, urls });
  }
  const result = await inFlight;
  res.json(result);
});

app.post('/api/heal', requireAdmin, async (req, res) => {
  const prompt = req.body?.prompt;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const healId = recordHeal({
    collectorId: COLLECTOR_ID,
    trigger: 'manual',
    prompt,
    status: 'healing',
  });

  const heal = await healScraper({ prompt });
  const status = heal.awaitingApproval
    ? 'awaiting_approval'
    : heal.ok
      ? 'healed'
      : 'failed';

  // Store a readable summary, not the raw CLI JSON — the timeline renders this
  // as prose, and a serialised payload there is unreadable.
  const steps = heal.raw?.completed_steps;
  const detail = Array.isArray(steps)
    ? `Steps: ${steps.join(' → ')}`
    : (heal.stderr || heal.output || '').slice(0, 300);

  updateHeal(healId, { status, detail });

  res.json({ id: healId, status, awaitingApproval: heal.awaitingApproval, raw: heal.raw });
});

app.post('/api/heal/approve', requireAdmin, async (req, res) => {
  const reject = Boolean(req.body?.reject);
  const result = await approveHeal({ reject });
  const pending = activeHeal();

  if (pending) {
    updateHeal(pending.id, {
      // Approving is not the same as saving: only a completed
      // save_new_template step means the collector actually changed.
      status: reject ? 'failed' : result.saved ? 'healed' : 'failed',
      detail: reject
        ? 'Heal rejected'
        : result.saved
          ? `Approved and saved. Steps: ${result.steps.join(' → ')}`
          : 'Approved but NOT saved — the collector still runs the old code',
    });
  }

  res.json({ ...result, saved: result.saved });
});

/* ---------------- subscribers (used by the Telegram bot) ---------------- */

app.post('/api/subscribers', (req, res) => {
  const { chat_id, username } = req.body ?? {};
  if (!chat_id) return res.status(400).json({ error: 'chat_id is required' });
  addSubscriber(chat_id, username);
  res.json({ subscribed: true });
});

app.delete('/api/subscribers/:chatId', (req, res) => {
  removeSubscriber(req.params.chatId);
  res.json({ subscribed: false });
});

/* ---------------- watchlist ---------------- */

app.get('/api/watches/:chatId', (req, res) =>
  res.json({ watches: watchesForChat(req.params.chatId) })
);

app.post('/api/watches', (req, res) => {
  const { chat_id, product_url, product_name, target_price } = req.body ?? {};
  if (!chat_id || !product_url) {
    return res.status(400).json({ error: 'chat_id and product_url are required' });
  }

  const target =
    target_price === null || target_price === undefined || target_price === ''
      ? null
      : Number(target_price);
  if (target !== null && (!Number.isFinite(target) || target <= 0)) {
    return res.status(400).json({ error: 'target_price must be a positive number' });
  }

  addWatch(chat_id, product_url, product_name, target);
  res.json({ watching: true, target_price: target, count: watchesForChat(chat_id).length });
});

app.delete('/api/watches/:chatId', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url query parameter is required' });
  const removed = removeWatch(req.params.chatId, String(url));
  res.json({ removed });
});

app.listen(PORT, () => {
  // Nothing is in flight yet at boot, so anything still marked running or
  // healing is a leftover from a previous process that died mid-cycle.
  const runs = reapStaleRuns();
  const heals = reapStaleHeals();
  if (runs || heals) console.log(`[api] reaped ${runs} stale run(s), ${heals} stale heal(s)`);

  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] collector: ${COLLECTOR_ID || '(not configured — set COLLECTOR_ID)'}`);
  if (process.env.ENABLE_SCHEDULER === 'true') startScheduler();
});
