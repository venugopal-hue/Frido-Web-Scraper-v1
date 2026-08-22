import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_PATH = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(process.cwd(), '../data/scrapeverse.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL;`);

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  collection_url TEXT NOT NULL,
  image_url     TEXT,
  updated_at    TEXT NOT NULL
);

-- One row per invocation of the scraper, successful or not. This is what
-- powers the "last run" indicator and the health status on the dashboard.
CREATE TABLE IF NOT EXISTS runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  collector_id TEXT NOT NULL,
  target_url   TEXT,
  status       TEXT NOT NULL,           -- running | success | empty | failed
  item_count   INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  started_at   TEXT NOT NULL,
  finished_at  TEXT
);

-- Product snapshots. We keep every run's rows rather than upserting, so the
-- trend chart and the "what changed" diff have real history to read from.
CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  category        TEXT,
  product_name    TEXT NOT NULL,
  current_price   REAL,
  original_price  REAL,
  discount_percent REAL,
  availability    TEXT,
  rating          REAL,
  review_count    INTEGER,
  product_url     TEXT,
  image_url       TEXT,
  scraped_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_run ON products(run_id);
CREATE INDEX IF NOT EXISTS idx_products_url ON products(product_url);

-- The self-healing audit trail. Every break -> heal -> verify cycle lands
-- here and is rendered as the timeline on the dashboard.
CREATE TABLE IF NOT EXISTS heal_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  collector_id  TEXT NOT NULL,
  trigger       TEXT NOT NULL,          -- auto | manual
  prompt        TEXT NOT NULL,
  status        TEXT NOT NULL,          -- healing | awaiting_approval | healed | failed
  detail        TEXT,
  items_before  INTEGER,
  items_after   INTEGER,
  -- JSON snapshots of field coverage either side of the heal, so the dashboard
  -- can show whether it actually changed anything rather than taking the
  -- reported status at face value.
  coverage_before TEXT,
  coverage_after  TEXT,
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  chat_id    TEXT PRIMARY KEY,
  username   TEXT,
  created_at TEXT NOT NULL
);

-- Multi-pack pricing, scraped from product pages by a second collector.
-- Keyed by product_url rather than product id so it survives across runs.
CREATE TABLE IF NOT EXISTS packs (
  product_url    TEXT NOT NULL,
  pack_label     TEXT NOT NULL,
  unit_count     INTEGER,
  price_per_unit REAL,
  total_price    REAL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (product_url, pack_label)
);

-- Per-chat product watches for targeted Telegram alerts.
CREATE TABLE IF NOT EXISTS watches (
  chat_id     TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_name TEXT,
  -- Optional: only alert once the price reaches or drops below this.
  target_price REAL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (chat_id, product_url)
);
`);

// Auto-seed baseline dataset when database is empty (e.g. newly deployed on Render)
function autoSeed() {
  try {
    const rowCount = db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n ?? 0;
    if (rowCount > 0) return;

    const seedPath = resolve(dirname(fileURLToPath(import.meta.url)), 'seed-data.json');
    if (!existsSync(seedPath)) return;

    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    db.exec('BEGIN');

    if (seed.categories?.length) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO categories (slug, name, collection_url, image_url, updated_at) VALUES (?, ?, ?, ?, ?)`);
      for (const c of seed.categories) stmt.run(c.slug, c.name, c.collection_url, c.image_url, c.updated_at);
    }
    if (seed.runs?.length) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO runs (id, collector_id, target_url, status, item_count, error, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const r of seed.runs) stmt.run(r.id, r.collector_id, r.target_url, r.status, r.item_count, r.error, r.started_at, r.finished_at);
    }
    if (seed.products?.length) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO products (id, run_id, category, product_name, current_price, original_price, discount_percent, availability, rating, review_count, product_url, image_url, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of seed.products) stmt.run(p.id, p.run_id, p.category, p.product_name, p.current_price, p.original_price, p.discount_percent, p.availability, p.rating, p.review_count, p.product_url, p.image_url, p.scraped_at);
    }
    if (seed.heal_events?.length) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO heal_events (id, collector_id, trigger, prompt, status, detail, items_before, items_after, coverage_before, coverage_after, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const h of seed.heal_events) stmt.run(h.id, h.collector_id, h.trigger, h.prompt, h.status, h.detail, h.items_before, h.items_after, h.coverage_before, h.coverage_after, h.created_at, h.resolved_at);
    }
    if (seed.packs?.length) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO packs (product_url, pack_label, unit_count, price_per_unit, total_price, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const pk of seed.packs) stmt.run(pk.product_url, pk.pack_label, pk.unit_count, pk.price_per_unit, pk.total_price, pk.updated_at);
    }

    db.exec('COMMIT');
    console.log(`[db] auto-seeded baseline data: ${seed.products?.length || 0} products, ${seed.categories?.length || 0} categories, ${seed.runs?.length || 0} runs`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[db] auto-seed error:', err);
  }
}

autoSeed();

export const nowIso = () => new Date().toISOString();

/* ---------- runs ---------- */

export function startRun(collectorId, targetUrl) {
  const stmt = db.prepare(
    `INSERT INTO runs (collector_id, target_url, status, started_at) VALUES (?, ?, 'running', ?)`
  );
  const { lastInsertRowid } = stmt.run(collectorId, targetUrl, nowIso());
  return Number(lastInsertRowid);
}

export function finishRun(runId, { status, itemCount = 0, error = null }) {
  db.prepare(
    `UPDATE runs SET status = ?, item_count = ?, error = ?, finished_at = ? WHERE id = ?`
  ).run(status, itemCount, error, nowIso(), runId);
}

/** The last N successful runs, newest first — used to diff one against another. */
export function recentSuccessfulRuns(limit = 2) {
  return db
    .prepare(`SELECT * FROM runs WHERE status = 'success' ORDER BY id DESC LIMIT ?`)
    .all(limit);
}

export function latestSuccessfulRun() {
  return db
    .prepare(`SELECT * FROM runs WHERE status = 'success' ORDER BY id DESC LIMIT 1`)
    .get();
}

export function latestRun() {
  return db.prepare(`SELECT * FROM runs ORDER BY id DESC LIMIT 1`).get();
}

export function recentRuns(limit = 20) {
  return db.prepare(`SELECT * FROM runs ORDER BY id DESC LIMIT ?`).all(limit);
}

/**
 * A run only leaves 'running' when the process that started it finishes it, so
 * a crash or restart mid-scrape strands the row forever and makes /api/status
 * report a scrape that is not happening. Called on boot to clear those.
 */
/**
 * Is a scrape already in flight?
 *
 * The in-process `inFlight` guard only covers POST /api/refresh. The scheduler
 * calls the pipeline directly, and `npm run scrape` is a separate process
 * entirely, so neither could see the other — two runs overlapped, double-
 * spending credit and writing concurrently. The runs table is the one thing
 * all three share, so the lock lives here.
 *
 * A run older than the cutoff is treated as dead rather than blocking forever;
 * a full pass takes ~9 minutes, so 45 is comfortably beyond a slow one.
 */
export function activeRun({ staleAfterMinutes = 45 } = {}) {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();
  return db
    .prepare(`SELECT * FROM runs WHERE status = 'running' AND started_at >= ? ORDER BY id DESC LIMIT 1`)
    .get(cutoff);
}

export function reapStaleRuns() {
  const { changes } = db
    .prepare(
      `UPDATE runs SET status = 'failed', error = 'interrupted — process exited mid-run', finished_at = ?
        WHERE status = 'running'`
    )
    .run(nowIso());
  return Number(changes);
}

/** Same problem for heals left mid-flight. */
export function reapStaleHeals() {
  const { changes } = db
    .prepare(
      `UPDATE heal_events SET status = 'failed', detail = COALESCE(detail,'') || ' (interrupted)', resolved_at = ?
        WHERE status = 'healing'`
    )
    .run(nowIso());
  return Number(changes);
}

/* ---------- products ---------- */

export function insertProducts(runId, items) {
  const stmt = db.prepare(`
    INSERT INTO products
      (run_id, category, product_name, current_price, original_price, discount_percent,
       availability, rating, review_count, product_url, image_url, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = nowIso();
  db.exec('BEGIN');
  try {
    for (const it of items) {
      stmt.run(
        runId,
        it.category ?? null,
        it.product_name,
        it.current_price ?? null,
        it.original_price ?? null,
        it.discount_percent ?? null,
        it.availability ?? null,
        it.rating ?? null,
        it.review_count ?? null,
        it.product_url ?? null,
        it.image_url ?? null,
        ts
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function updateProductImage(id, imageUrl) {
  db.prepare(`UPDATE products SET image_url = ? WHERE id = ?`).run(imageUrl, id);
}

export function productsForRun(runId) {
  return db
    .prepare(`SELECT * FROM products WHERE run_id = ? ORDER BY category, product_name`)
    .all(runId);
}

export function latestProducts() {
  const run = latestSuccessfulRun();
  return run ? { run, products: productsForRun(run.id) } : { run: null, products: [] };
}

/**
 * Low/high/average price per product across a trailing window, in one query.
 *
 * Used to answer "is this actually a good price?" rather than just "what does
 * it cost?" — a 60% discount is meaningless if the item sat at that price all
 * month.
 */
export function priceStatsByUrl(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT product_url,
              MIN(current_price) AS low,
              MAX(current_price) AS high,
              AVG(current_price) AS avg,
              COUNT(DISTINCT run_id) AS observations
         FROM products
        WHERE product_url IS NOT NULL
          AND current_price IS NOT NULL
          AND scraped_at >= ?
        GROUP BY product_url`
    )
    .all(since);

  return new Map(rows.map((r) => [r.product_url, r]));
}

/** Price points for one product over time, oldest first — feeds the trend chart. */
export function priceHistory(productUrl, limit = 60) {
  return db
    .prepare(
      `SELECT p.current_price, p.availability, p.scraped_at
         FROM products p
        WHERE p.product_url = ?
        ORDER BY p.id DESC
        LIMIT ?`
    )
    .all(productUrl, limit)
    .reverse();
}

/* ---------- heal events ---------- */

export function recordHeal({ collectorId, trigger, prompt, status, detail, itemsBefore }) {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO heal_events (collector_id, trigger, prompt, status, detail, items_before, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(collectorId, trigger, prompt, status, detail ?? null, itemsBefore ?? null, nowIso());
  return Number(lastInsertRowid);
}

export function updateHeal(id, { status, detail, itemsAfter, coverageAfter }) {
  db.prepare(
    `UPDATE heal_events
        SET status = ?,
            detail = COALESCE(?, detail),
            items_after = ?,
            coverage_after = COALESCE(?, coverage_after),
            resolved_at = ?
      WHERE id = ?`
  ).run(
    status,
    detail ?? null,
    itemsAfter ?? null,
    coverageAfter ? JSON.stringify(coverageAfter) : null,
    nowIso(),
    id
  );
}

export function setHealCoverageBefore(id, coverage) {
  db.prepare(`UPDATE heal_events SET coverage_before = ? WHERE id = ?`).run(
    JSON.stringify(coverage),
    id
  );
}

/**
 * Field-level fill rates for a set of products.
 * This is what makes a heal's effect measurable rather than merely reported.
 */
export function coverageOf(products) {
  const fields = ['product_name', 'current_price', 'original_price', 'discount_percent', 'availability', 'image_url', 'product_url'];
  const total = products.length;
  const out = { total };
  for (const f of fields) {
    const filled = products.filter((p) => p[f] !== null && p[f] !== undefined && p[f] !== '').length;
    out[f] = total ? Math.round((filled / total) * 100) : 0;
  }
  return out;
}

export function healEvents(limit = 25) {
  return db.prepare(`SELECT * FROM heal_events ORDER BY id DESC LIMIT ?`).all(limit);
}

export function activeHeal() {
  return db
    .prepare(
      `SELECT * FROM heal_events WHERE status IN ('healing','awaiting_approval') ORDER BY id DESC LIMIT 1`
    )
    .get();
}

/* ---------- categories ---------- */

export function upsertCategories(cats) {
  const stmt = db.prepare(`
    INSERT INTO categories (slug, name, collection_url, image_url, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      collection_url = excluded.collection_url,
      image_url = excluded.image_url,
      updated_at = excluded.updated_at
  `);
  const ts = nowIso();
  for (const c of cats) {
    stmt.run(c.slug, c.name, c.collection_url, c.image_url ?? null, ts);
  }
}

export function allCategories() {
  return db.prepare(`SELECT * FROM categories ORDER BY name`).all();
}

/* ---------- packs ---------- */

export function replacePacks(productUrl, options) {
  db.prepare(`DELETE FROM packs WHERE product_url = ?`).run(productUrl);
  const stmt = db.prepare(
    `INSERT INTO packs (product_url, pack_label, unit_count, price_per_unit, total_price, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_url, pack_label) DO UPDATE SET
       unit_count = excluded.unit_count,
       price_per_unit = excluded.price_per_unit,
       total_price = excluded.total_price,
       updated_at = excluded.updated_at`
  );
  const ts = nowIso();
  for (const o of options) {
    stmt.run(productUrl, o.pack_label, o.unit_count ?? null, o.price_per_unit ?? null, o.total_price ?? null, ts);
  }
}

/** All pack options grouped by product_url. */
export function packsByUrl() {
  const rows = db.prepare(`SELECT * FROM packs ORDER BY product_url, unit_count`).all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_url)) map.set(r.product_url, []);
    map.get(r.product_url).push(r);
  }
  return map;
}

export function packCount() {
  return db.prepare(`SELECT COUNT(DISTINCT product_url) AS n FROM packs`).get().n;
}

/* ---------- watches ---------- */

/**
 * Follow a product, optionally with a target price.
 *
 * Re-watching an existing product updates the target rather than doing
 * nothing, so `/watch x below 500` works as a way to change your mind.
 */
export function addWatch(chatId, productUrl, productName, targetPrice = null) {
  db.prepare(
    `INSERT INTO watches (chat_id, product_url, product_name, target_price, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id, product_url) DO UPDATE SET
       target_price = excluded.target_price,
       product_name = COALESCE(excluded.product_name, watches.product_name)`
  ).run(String(chatId), productUrl, productName ?? null, targetPrice, nowIso());
}

export function removeWatch(chatId, productUrl) {
  const { changes } = db
    .prepare(`DELETE FROM watches WHERE chat_id = ? AND product_url = ?`)
    .run(String(chatId), productUrl);
  return Number(changes);
}

export function watchesForChat(chatId) {
  return db.prepare(`SELECT * FROM watches WHERE chat_id = ? ORDER BY created_at`).all(String(chatId));
}

/** Every watched product, deduplicated across chats — the dashboard view. */
export function allWatchedUrls() {
  return db
    .prepare(
      `SELECT product_url,
              product_name,
              COUNT(*) AS watchers,
              MIN(created_at) AS since,
              -- The most ambitious target anyone set, for display.
              MIN(target_price) AS target_price
         FROM watches
        GROUP BY product_url
        ORDER BY since`
    )
    .all();
}

/**
 * Last N price points for every product that has more than one, in one query.
 *
 * Fetching these per-card would be one request per product; the grid renders
 * 140 at a time.
 */
export function sparklineData(limitPerProduct = 20) {
  const rows = db
    .prepare(
      `SELECT product_url, current_price, scraped_at
         FROM products
        WHERE product_url IS NOT NULL AND current_price IS NOT NULL
        ORDER BY product_url, id`
    )
    .all();

  const map = {};
  for (const r of rows) {
    (map[r.product_url] ??= []).push(r.current_price);
  }
  // Only series with actual movement are worth drawing.
  for (const [url, prices] of Object.entries(map)) {
    const trimmed = prices.slice(-limitPerProduct);
    if (trimmed.length < 2 || new Set(trimmed).size < 2) delete map[url];
    else map[url] = trimmed;
  }
  return map;
}

/**
 * Every watch, grouped by product_url — used when broadcasting a diff.
 * Each entry carries the chat's own target, since two people can watch the
 * same product at different prices.
 */
export function watchersByUrl() {
  const rows = db.prepare(`SELECT chat_id, product_url, target_price FROM watches`).all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_url)) map.set(r.product_url, []);
    map.get(r.product_url).push({ chatId: r.chat_id, target: r.target_price });
  }
  return map;
}

/* ---------- subscribers ---------- */

export function addSubscriber(chatId, username) {
  db.prepare(
    `INSERT INTO subscribers (chat_id, username, created_at) VALUES (?, ?, ?)
     ON CONFLICT(chat_id) DO NOTHING`
  ).run(String(chatId), username ?? null, nowIso());
}

export function removeSubscriber(chatId) {
  db.prepare(`DELETE FROM subscribers WHERE chat_id = ?`).run(String(chatId));
}

export function allSubscribers() {
  return db.prepare(`SELECT chat_id FROM subscribers`).all().map((r) => r.chat_id);
}
