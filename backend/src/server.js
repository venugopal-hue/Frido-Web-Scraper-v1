import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import {
  latestProducts,
  recentRuns,
  latestRun,
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
  addWatch,
  removeWatch,
  watchesForChat,
} from './db.js';
import { runCycle } from './pipeline.js';
import { healScraper, approveHeal, COLLECTOR_ID } from './brightdata.js';
import { startScheduler } from './scheduler.js';
import { withDealScores } from './deal-score.js';
import { targetUrls } from './targets.js';

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/api/runs', (req, res) =>
  res.json({ runs: recentRuns(Number(req.query.limit) || 20) })
);

app.get('/api/history', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query parameter is required' });
  res.json({ product_url: url, points: priceHistory(String(url)) });
});

app.get('/api/heals', (_req, res) => res.json({ events: healEvents() }));

/** Single call the dashboard status bar and the bot's /status both read. */
app.get('/api/status', (_req, res) => {
  const run = latestRun();
  const heal = activeHeal();
  const events = healEvents(5);

  let health = 'unknown';
  if (heal) health = heal.status === 'awaiting_approval' ? 'awaiting_approval' : 'healing';
  else if (inFlight) health = 'running';
  else if (run?.status === 'success') health = 'healthy';
  else if (run) health = 'broken';

  res.json({
    health,
    collector_id: COLLECTOR_ID,
    last_run: run ?? null,
    scraping: Boolean(inFlight),
    last_heal: events[0] ?? null,
    recent_heals: events,
    subscribers: allSubscribers().length,
  });
});

/* ---------------- write endpoints ---------------- */

app.post('/api/refresh', requireAdmin, async (req, res) => {
  if (inFlight) return res.status(409).json({ error: 'a scrape is already running' });

  const urls = Array.isArray(req.body?.urls) && req.body.urls.length
    ? req.body.urls
    : targetUrls();
  const autoHeal = req.body?.autoHeal !== false;

  inFlight = runCycle({ urls, autoHeal })
    .catch((err) => ({ ok: false, error: String(err) }))
    .finally(() => {
      inFlight = null;
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
  const result = await approveHeal({ reject: Boolean(req.body?.reject) });
  const pending = activeHeal();
  if (pending) {
    updateHeal(pending.id, {
      status: req.body?.reject ? 'failed' : 'healed',
      detail: result.output || result.stderr,
    });
  }
  res.json(result);
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
  const { chat_id, product_url, product_name } = req.body ?? {};
  if (!chat_id || !product_url) {
    return res.status(400).json({ error: 'chat_id and product_url are required' });
  }
  addWatch(chat_id, product_url, product_name);
  res.json({ watching: true, count: watchesForChat(chat_id).length });
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
