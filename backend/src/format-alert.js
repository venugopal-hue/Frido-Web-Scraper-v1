/**
 * Canonical formatter for broadcast alerts.
 *
 * The backend is what actually sends these (notify.js), so the format lives
 * here rather than in the bot. `telegram-bot/preview.js` imports this same
 * module so the preview cannot drift from what subscribers really receive.
 *
 * Deliberately dependency-free: it is imported across package boundaries.
 */

const inr = (n) =>
  n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;

const esc = (s) => String(s ?? '').replace(/([_*[\]`])/g, '\\$1');

export function formatDiff(diff) {
  const lines = ['🔔 *Frido tracker update*'];

  for (const c of diff.priceChanges.slice(0, 10)) {
    lines.push(
      `${c.direction === 'drop' ? '📉' : '📈'} ${esc(c.product_name)}: ${inr(c.from)} → ${inr(c.to)}`
    );
  }
  for (const p of diff.newItems.slice(0, 5)) {
    lines.push(`🆕 ${esc(p.product_name)}${p.current_price ? ` — ${inr(p.current_price)}` : ''}`);
  }
  for (const p of diff.backInStock.slice(0, 5)) {
    lines.push(`✅ Back in stock: ${esc(p.product_name)}`);
  }
  for (const p of diff.wentOutOfStock.slice(0, 5)) {
    lines.push(`⛔ Sold out: ${esc(p.product_name)}`);
  }

  return lines.join('\n');
}

export const HEAL_ALERT =
  '🩹 *Scraper self-healed*\n' +
  'Extraction broke, `bdata scraper heal` was applied automatically, and the re-run succeeded.';
