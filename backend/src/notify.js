import { allSubscribers, watchersByUrl } from './db.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API = (method) => `https://api.telegram.org/bot${TOKEN}/${method}`;

/**
 * Push a message to every subscribed chat. Called by the scheduler when a
 * scrape produces a meaningful diff or when a self-heal fires.
 */
export async function notifySubscribers(text) {
  if (!TOKEN) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set — skipping broadcast');
    return { sent: 0 };
  }

  const chats = allSubscribers();
  let sent = 0;

  for (const chatId of chats) {
    try {
      const res = await fetch(API('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) sent++;
      else console.warn(`[notify] chat ${chatId} rejected:`, await res.text());
    } catch (err) {
      console.warn(`[notify] chat ${chatId} failed:`, String(err));
    }
  }

  console.log(`[notify] broadcast to ${sent}/${chats.length} chats`);
  return { sent, total: chats.length };
}

/** Send one message to one chat. */
async function sendTo(chatId, text) {
  if (!TOKEN) return false;
  try {
    const res = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const esc = (s) => String(s ?? '').replace(/([_*[\]`])/g, '\\$1');

/**
 * Alert only the chats watching a specific product.
 *
 * Distinct from the broadcast above: a subscriber gets catalogue-wide news,
 * whereas a watcher asked about one item and should hear about it even when
 * the change is too small to make the general digest.
 */
export async function notifyWatchers(diff) {
  if (!TOKEN) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set — skipping watch alerts');
    return { sent: 0 };
  }

  const watchers = watchersByUrl();
  if (!watchers.size) return { sent: 0 };

  // chat_id -> lines, so a chat watching three changed products gets one message.
  const perChat = new Map();
  const queue = (url, line) => {
    for (const chatId of watchers.get(url) ?? []) {
      if (!perChat.has(chatId)) perChat.set(chatId, []);
      perChat.get(chatId).push(line);
    }
  };

  for (const c of diff.priceChanges) {
    queue(
      c.product_url,
      `${c.direction === 'drop' ? '📉' : '📈'} *${esc(c.product_name)}*\n` +
        `${inr(c.from)} → ${inr(c.to)}`
    );
  }
  for (const p of diff.backInStock) {
    queue(p.product_url, `✅ *${esc(p.product_name)}* is back in stock`);
  }
  for (const p of diff.wentOutOfStock) {
    queue(p.product_url, `⛔ *${esc(p.product_name)}* just sold out`);
  }

  let sent = 0;
  for (const [chatId, lines] of perChat) {
    const ok = await sendTo(chatId, ['🔔 *Watchlist update*', '', ...lines].join('\n'));
    if (ok) sent++;
  }

  if (perChat.size) console.log(`[notify] watch alerts to ${sent}/${perChat.size} chats`);
  return { sent, total: perChat.size };
}
