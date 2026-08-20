/**
 * Message builders, kept separate from the bot wiring so they can be rendered
 * and checked against the live API without a Telegram token.
 *
 * Everything here is pure: API payload in, Markdown string out.
 */

export const inr = (n) =>
  n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;

/** Telegram's MarkdownV1 parser breaks on stray formatting characters, and
 *  real product names contain them. */
export const esc = (s) => String(s ?? '').replace(/([_*[\]`])/g, '\\$1');

/**
 * Text going *inside* a `code span` must NOT be backslash-escaped — Telegram
 * does not interpret formatting there, so a backslash renders literally and
 * corrupts the value. Only a backtick would break out, so drop those.
 */
export const escCode = (s) => String(s ?? '').replace(/`/g, '');

export const isOutOfStock = (availability) =>
  /out of stock|sold\s*out|unavailable/i.test(availability ?? '');

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');

export function buildStart() {
  return [
    '*Frido Price Tracker* 🛏️',
    '',
    'I track product prices and stock across the Frido store, powered by a',
    'Bright Data Scraper Studio collector that detects its own breakage and',
    'calls `bdata scraper heal` to repair itself.',
    '',
    '*Browse*',
    '/deals — filter by discount range',
    '/latest — current prices, best discounts first',
    '/categories — browse by category',
    '',
    '*Track*',
    '/watch <name> — follow one product',
    '/watchlist — what you are following',
    '/unwatch <name> — stop following',
    '/subscribe — alerts for the whole catalogue',
    '',
    '*Health*',
    '/status — scraper health and last heal event',
  ].join('\n');
}

/** Telegram rejects anything over 4096 chars, so long lists ship as several. */
const TELEGRAM_LIMIT = 3800;

/**
 * Split a header plus a list of lines into messages that each fit the limit.
 * Returns an array of message strings, page-numbered when there is more than one.
 */
function paginate(header, lines, footer = '') {
  const pages = [];
  let current = [];
  let length = header.length;

  for (const line of lines) {
    if (length + line.length + 1 > TELEGRAM_LIMIT && current.length) {
      pages.push(current);
      current = [];
      length = header.length;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length) pages.push(current);
  if (!pages.length) return [header + (footer ? `\n\n${footer}` : '')];

  return pages.map((body, i) => {
    const label = pages.length > 1 ? `${header} _(${i + 1}/${pages.length})_` : header;
    const tail = i === pages.length - 1 && footer ? `\n\n${footer}` : '';
    return `${label}\n\n${body.join('\n')}${tail}`;
  });
}

const LATEST_LIMIT = 20;

/**
 * A preview of the catalogue. Deliberately capped — but the cap is stated in
 * the header, so it can never read as though it were the whole catalogue.
 */
export function buildLatest({ products, run, count }) {
  if (!count) return ['No data yet — the first scrape has not completed.'];

  const top = [...products]
    .sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0))
    .slice(0, LATEST_LIMIT);

  const lines = top.map((p) => {
    const stock = isOutOfStock(p.availability) ? ' ⛔' : '';
    const off = p.discount_percent ? ` _(${Math.round(p.discount_percent)}% off)_` : '';
    return `• [${esc(p.product_name)}](${p.product_url}) — ${inr(p.current_price)}${off}${stock}${dealTag(p)}`;
  });

  const header =
    top.length < count
      ? `*Top ${top.length} of ${count} products* (run #${run.id})`
      : `*All ${count} products* (run #${run.id})`;

  return paginate(
    header,
    lines,
    `_Updated ${when(run.finished_at)}._ _Use_ \`/deals\` _for everything at 50%+ off._`
  );
}

/**
 * Discount bands, exclusive of each other — picking 50–69% does not include
 * the 70%+ items. Boundaries chosen against the real catalogue so no band
 * comes back empty or duplicates its neighbour.
 */
export const BANDS = [
  { id: 'all', label: 'All', min: 0, max: Infinity },
  { id: 'u25', label: 'Under 25%', min: 0, max: 25 },
  { id: 'b25', label: '25–39%', min: 25, max: 40 },
  { id: 'b40', label: '40–49%', min: 40, max: 50 },
  { id: 'b50', label: '50–69%', min: 50, max: 70 },
  { id: 'b70', label: '70%+', min: 70, max: Infinity },
];

export const DEFAULT_BAND = 'b50';

export const bandById = (id) => BANDS.find((b) => b.id === id) ?? BANDS[4];

/** Map a typed number (`/deals 65`) onto the band that contains it. */
export function bandForValue(n) {
  return BANDS.filter((b) => b.id !== 'all').find((b) => n >= b.min && n < b.max) ?? bandById('b70');
}

/** Short price-context tag, e.g. "🟢 lowest seen" — omitted without history. */
export function dealTag(p) {
  const v = p.deal?.verdict;
  if (!v || v === 'unknown') return '';
  if (v === 'lowest') return ' 🟢 _lowest seen_';
  if (v === 'near_lowest') return ' 🟢 _near lowest_';
  if (v === 'below_average') return ' 🟡 _below average_';
  if (v === 'above_average') return ' 🔴 _above average_';
  return '';
}

/** Per-unit pack saving, when a multi-pack beats the single-unit price. */
export function packTag(p) {
  const b = p.best_pack;
  if (!b) return '';
  return `\n  📦 ${esc(b.label)}: ${inr(b.price_per_unit)}/unit — *${b.unit_saving_percent}% less*`;
}

const dealLine = (p) =>
  `• [${esc(p.product_name)}](${p.product_url})\n  ${inr(p.current_price)} ~${inr(
    p.original_price
  )}~ — *${Math.round(p.discount_percent ?? 0)}% off*${dealTag(p)}${packTag(p)}`;

export function productsInBand(products, band) {
  return products
    .filter((p) => {
      const v = p.discount_percent ?? 0;
      return v >= band.min && v < band.max;
    })
    .sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0));
}

/**
 * One page of a band, sized to fit a single Telegram message.
 *
 * Paging inside one message (rather than sending several) keeps the inline
 * keyboard attached to a single message that can be edited in place.
 */
export function buildDealsPage({ products }, bandId = DEFAULT_BAND, page = 0) {
  const band = bandById(bandId);
  const matches = productsInBand(products, band);

  if (!matches.length) {
    return {
      text: `*${band.label}*\n\nNo products in this range right now.`,
      page: 0,
      totalPages: 1,
      count: 0,
    };
  }

  const lines = matches.map(dealLine);
  const budget = 3400;
  const pages = [];
  let current = [];
  let length = 0;

  for (const line of lines) {
    if (length + line.length + 1 > budget && current.length) {
      pages.push(current);
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length) pages.push(current);

  const idx = Math.min(Math.max(page, 0), pages.length - 1);
  const shown = pages[idx];

  const header =
    band.id === 'all'
      ? `*All discounts* — ${matches.length} products`
      : `*${band.label} off* — ${matches.length} products`;
  const footer =
    pages.length > 1
      ? `_Page ${idx + 1} of ${pages.length} · showing ${shown.length} of ${matches.length}_`
      : '';

  return {
    text: `${header}\n\n${shown.join('\n')}${footer ? `\n\n${footer}` : ''}`,
    page: idx,
    totalPages: pages.length,
    count: matches.length,
  };
}

/** Counts per band, used to label the buttons. */
export function bandCounts(products) {
  return Object.fromEntries(BANDS.map((b) => [b.id, productsInBand(products, b).length]));
}

export function buildCategories({ products }) {
  const byCat = new Map();
  for (const p of products) {
    const c = p.category ?? 'Uncategorised';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(p);
  }
  if (!byCat.size) return 'No data yet.';

  const lines = ['*Categories tracked*', ''];
  for (const [cat, items] of [...byCat].sort((a, b) => a[0].localeCompare(b[0]))) {
    const prices = items.map((i) => i.current_price).filter((n) => typeof n === 'number');
    const cheapest = prices.length ? Math.min(...prices) : null;
    const out = items.filter((i) => isOutOfStock(i.availability)).length;
    lines.push(
      `• *${esc(cat)}* — ${items.length} items, from ${inr(cheapest)}${
        out ? ` _(${out} sold out)_` : ''
      }`
    );
  }
  return lines.join('\n');
}

export function buildStatus(s) {
  const icon = {
    healthy: '🟢',
    healing: '🟡',
    awaiting_approval: '🟠',
    broken: '🔴',
    running: '🔵',
  };

  const lines = [
    `${icon[s.health] ?? '⚪'} *Scraper status: ${esc(s.health.replace(/_/g, ' '))}*`,
    '',
    `Collector: \`${escCode(s.collector_id)}\``,
  ];

  if (s.last_run) {
    lines.push(
      `Last run: #${s.last_run.id} — ${esc(s.last_run.status)} (${s.last_run.item_count} items)`,
      `At: ${when(s.last_run.finished_at ?? s.last_run.started_at)}`
    );
  }

  if (s.last_heal) {
    const h = s.last_heal;
    lines.push(
      '',
      `🩹 Last heal: *${esc(h.status.replace(/_/g, ' '))}* (${esc(h.trigger)})`,
      // null (not '') so the blank-line separators above survive the filter.
      h.items_before !== null && h.items_after !== null
        ? `${h.items_before} → ${h.items_after} rows`
        : null,
      `_${when(h.created_at)}_`
    );
  }

  lines.push('', `Subscribers: ${s.subscribers}`);
  return lines.filter((l) => l !== null).join('\n');
}

// Alert formatting deliberately lives in backend/src/format-alert.js — the
// backend is what broadcasts them, and one copy cannot drift from the other.

/** The chat's watchlist, with current price and any movement context. */
export function buildWatchlist(watches, products) {
  if (!watches.length) {
    return [
      '*Your watchlist is empty.*\n\n' +
        'Add one with `/watch <part of a product name>` — ' +
        'you will get an alert when its price moves or it comes back in stock.',
    ];
  }

  const byUrl = new Map(products.map((p) => [p.product_url, p]));
  const lines = watches.map((w) => {
    const p = byUrl.get(w.product_url);
    if (!p) return `• ${esc(w.product_name ?? w.product_url)} — _no longer in the catalogue_`;
    const stock = isOutOfStock(p.availability) ? ' ⛔' : '';
    return `• [${esc(p.product_name)}](${p.product_url}) — ${inr(p.current_price)}${stock}${dealTag(p)}${packTag(p)}`;
  });

  return paginate(`*Watching ${watches.length} product${watches.length === 1 ? '' : 's'}*`, lines,
    '_Remove with_ `/unwatch <name>`_._');
}

/** Fuzzy product lookup for /watch — returns the best matches by name. */
export function findProducts(products, query, limit = 5) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = products.filter((p) => p.product_name.toLowerCase().includes(q));
  // Shortest name wins: it is the closest thing to an exact match.
  return matches.sort((a, b) => a.product_name.length - b.product_name.length).slice(0, limit);
}
