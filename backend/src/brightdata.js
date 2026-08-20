/**
 * Thin wrapper around the Bright Data `bdata` CLI.
 *
 * Every call here shells out to the real CLI — nothing is mocked. The commands
 * used are exactly the ones the hackathon requires:
 *   bdata scraper run   <collector_id> <url>
 *   bdata scraper heal  <collector_id> <prompt>
 *   bdata scraper approve <collector_id>
 */
import { spawn } from 'node:child_process';

const CLI = process.env.BDATA_CLI ?? 'npx';
const CLI_PREFIX = process.env.BDATA_CLI
  ? [] // a direct `bdata` binary on PATH
  : ['-p', '@brightdata/cli', 'bdata'];

export const COLLECTOR_ID = process.env.COLLECTOR_ID ?? '';
export const CATEGORIES_COLLECTOR_ID = process.env.CATEGORIES_COLLECTOR_ID ?? '';

/** Run the CLI and return { code, stdout, stderr }. Never throws on non-zero. */
function exec(args, { timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(CLI, [...CLI_PREFIX, ...args], {
      shell: process.platform === 'win32',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      stderr += `\n[wrapper] timed out after ${timeoutMs}ms`;
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(err) });
    });
  });
}

/**
 * The CLI prints human-readable progress lines before the JSON payload, so we
 * can't just JSON.parse the whole of stdout — we find the first balanced JSON
 * value instead.
 */
function extractJson(text) {
  const start = text.search(/[[{]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Pull the array of scraped rows out of whatever envelope the CLI returned. */
function toRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'results', 'items', 'rows', 'output', 'records']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  // Single object that looks like a row rather than an envelope.
  return payload.product_name ? [payload] : [];
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const str = (v) => (v === null || v === undefined ? null : String(v).trim() || null);

/** Pretty category name from a collection slug, e.g. tt-pillows -> Pillows. */
export function categoryFromUrl(url) {
  const slug = String(url ?? '').match(/\/collections\/([^/?#]+)/)?.[1];
  if (!slug) return null;
  return slug
    .replace(/^tt-/, '')
    .replace(/-all-products$/, '')
    .split('-')
    .map((w) => (w === 'and' ? '&' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Map a raw scraped row onto our schema. Field names coming back from an
 * AI-generated scraper drift between heals, so we accept a few aliases per
 * column rather than assuming one exact key.
 */
export function normalizeProduct(raw, fallbackCategory = null) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
    }
    return null;
  };

  const name = str(pick('product_name', 'name', 'title', 'product_title'));
  if (!name) return null;

  const availabilityRaw = str(pick('availability', 'stock', 'stock_status', 'in_stock'));
  let availability = availabilityRaw;
  if (typeof pick('in_stock') === 'boolean') {
    availability = pick('in_stock') ? 'In stock' : 'Sold out';
  }

  let url = str(pick('product_url', 'product_page_url', 'url', 'link', 'href'));
  if (url && url.startsWith('/')) url = `https://store.myfrido.com${url}`;

  // Rows carry the collection URL they came from under `input.url`; the AI
  // scraper only fills `category` sporadically, so derive it as a fallback.
  const sourceUrl = str(raw?.input?.url);

  return {
    product_name: name,
    current_price: num(pick('current_price', 'price', 'sale_price', 'selling_price')),
    original_price: num(pick('original_price', 'mrp', 'compare_at_price', 'list_price')),
    discount_percent: num(pick('discount_percent', 'discount', 'discount_percentage')),
    availability,
    rating: num(pick('rating', 'star_rating', 'average_rating')),
    review_count: num(pick('review_count', 'reviews', 'ratings_count', 'num_reviews')),
    product_url: url,
    image_url: str(pick('image_url', 'image', 'thumbnail', 'img')),
    category:
      categoryFromUrl(sourceUrl) ??
      str(pick('category', 'collection', 'collection_name')) ??
      fallbackCategory,
    source_url: sourceUrl,
  };
}

/** `bdata scraper run` against one or more URLs. */
export async function runScraper({ collectorId = COLLECTOR_ID, url, urls, timeoutMs } = {}) {
  if (!collectorId) throw new Error('COLLECTOR_ID is not set — see .env.example');

  const args = ['scraper', 'run', collectorId];
  if (urls?.length) args.push('--urls', urls.join(','));
  else if (url) args.push(url);
  args.push('--json');

  const { code, stdout, stderr } = await exec(args, timeoutMs ? { timeoutMs } : {});
  const payload = extractJson(stdout);
  const rows = toRows(payload);

  return {
    ok: code === 0 && rows.length > 0,
    exitCode: code,
    rows,
    raw: payload,
    stderr: stderr.trim(),
  };
}

/**
 * Fetch a product's Shopify JSON (`/products/{handle}.json`) via Web Unlocker.
 *
 * The collection-grid scraper misses `image_url` on most rows because the grid
 * lazy-loads its images. This endpoint returns them directly, so it is used to
 * backfill rather than relying on a heal that cannot see un-scrolled content.
 */
export async function fetchProductJson(productUrl) {
  if (!productUrl) return null;

  const url = `${productUrl.split('?')[0].replace(/\/$/, '')}.json`;
  const { code, stdout } = await exec(['scrape', url, '--format', 'json'], {
    timeoutMs: 90_000,
  });
  if (code !== 0) return null;

  const envelope = extractJson(stdout);
  if (!envelope || envelope.status_code !== 200) return null;

  let body = envelope.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body?.product ?? null;
}

/**
 * `bdata scraper heal` — the self-healing call.
 *
 * `--auto-save` is essential and easy to miss. Approving a heal is a separate
 * operation from *saving* the healed template: without it the job reports
 * `status: "done"` and `bdata scraper run` keeps executing the old code. The
 * completed_steps list is the tell — a heal that actually landed ends with
 * `save_new_template`, one that did not ends at `user_approval`.
 *
 * @param {boolean} autoApprove  Skip the human-in-the-loop gate. The scheduler
 *   leaves this false so an unattended run cannot rewrite the scraper without
 *   review; the manual endpoint can opt in.
 */
export async function healScraper({
  collectorId = COLLECTOR_ID,
  prompt,
  autoApprove = false,
  timeoutMs,
}) {
  if (!collectorId) throw new Error('COLLECTOR_ID is not set — see .env.example');

  const args = ['scraper', 'heal', collectorId, prompt];
  if (autoApprove) args.push('--auto-approve', '--auto-save');
  args.push('--json');

  const { code, stdout, stderr } = await exec(args, timeoutMs ? { timeoutMs } : {});
  const payload = extractJson(stdout);
  const status = str(payload?.status) ?? (code === 0 ? 'healed' : 'failed');
  const steps = payload?.completed_steps ?? [];

  return {
    ok: code === 0,
    exitCode: code,
    status,
    // Heals can come back pending a human approval; the caller surfaces this.
    awaitingApproval: /await|pending|approval/i.test(status),
    // The only reliable signal that the fix actually reached the collector.
    saved: steps.includes('save_new_template'),
    steps,
    raw: payload,
    output: stdout.trim(),
    stderr: stderr.trim(),
  };
}

/**
 * `bdata scraper approve` — confirm a heal that is awaiting approval.
 *
 * `--auto-save` is passed by default deliberately. Approving without it leaves
 * the healed template unsaved, so the run afterwards silently uses the old
 * code while every status field still reads "done".
 */
export async function approveHeal({ collectorId = COLLECTOR_ID, reject = false, save = true }) {
  const args = ['scraper', 'approve', collectorId];
  if (reject) args.push('--reject');
  else if (save) args.push('--auto-save');
  args.push('--json');

  const { code, stdout, stderr } = await exec(args, { timeoutMs: 10 * 60 * 1000 });
  const payload = extractJson(stdout);
  const steps = payload?.completed_steps ?? [];

  return {
    ok: code === 0,
    saved: steps.includes('save_new_template'),
    steps,
    raw: payload,
    output: stdout.trim(),
    stderr: stderr.trim(),
  };
}
