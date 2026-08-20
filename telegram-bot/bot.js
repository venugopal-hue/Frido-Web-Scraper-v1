/**
 * Telegram surface for the Frido tracker.
 *
 * The bot owns no scraping logic of its own — every command is a read against
 * the same backend API the dashboard uses, so the two surfaces can never drift.
 * Message text is built in format.js so it can be checked without a token.
 */
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

import {
  buildStart,
  buildLatest,
  buildDealsPage,
  buildCategories,
  buildStatus,
  bandCounts,
  bandForValue,
  bandById,
  BANDS,
  DEFAULT_BAND,
  buildWatchlist,
  findProducts,
  inr,
  esc,
} from './format.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const ADMIN_CHATS = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is missing — copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const isAdmin = (chatId) => ADMIN_CHATS.includes(String(chatId));

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

const send = (chatId, text, extra = {}) =>
  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...extra,
  });

/**
 * Send a builder's output, which may be one message or several pages.
 * Telegram rate-limits to roughly one message per second per chat, so pages
 * are spaced out rather than fired in a burst.
 */
async function sendAll(chatId, payload) {
  const pages = Array.isArray(payload) ? payload : [payload];
  for (const [i, page] of pages.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    await send(chatId, page);
  }
}

/**
 * Wrap a handler so an API failure becomes a readable chat message rather than
 * an unhandled rejection that silently drops the user's command.
 */
const handle = (fn) => async (msg, match) => {
  try {
    await fn(msg, match);
  } catch (err) {
    console.error(`[bot] ${msg.text?.split(' ')[0]} failed:`, err.message);
    await send(msg.chat.id, `⚠️ Could not reach the tracker API.\n\`${esc(err.message)}\``);
  }
};

/* ---------------- public commands ---------------- */

bot.onText(/^\/start/, handle((msg) => send(msg.chat.id, buildStart())));

bot.onText(
  /^\/latest/,
  handle(async (msg) => sendAll(msg.chat.id, buildLatest(await api('/api/data'))))
);

/**
 * Build the inline keyboard: one row of band buttons (counts baked into the
 * labels), then page navigation when the band spans more than one page.
 *
 * callback_data is capped at 64 bytes by Telegram, so it carries only the band
 * id and page number.
 */
function dealsKeyboard(counts, activeBand, page, totalPages) {
  const bandButtons = BANDS.map((b) => ({
    text: `${b.id === activeBand ? '• ' : ''}${b.label} (${counts[b.id] ?? 0})`,
    callback_data: `deals:${b.id}:0`,
  }));

  // Three per row keeps the labels readable on a phone.
  const rows = [];
  for (let i = 0; i < bandButtons.length; i += 3) rows.push(bandButtons.slice(i, i + 3));

  if (totalPages > 1) {
    const nav = [];
    if (page > 0)
      nav.push({ text: '‹ Prev', callback_data: `deals:${activeBand}:${page - 1}` });
    nav.push({ text: `${page + 1}/${totalPages}`, callback_data: 'deals:noop:0' });
    if (page < totalPages - 1)
      nav.push({ text: 'Next ›', callback_data: `deals:${activeBand}:${page + 1}` });
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

// `/deals` opens the band picker; `/deals 65` jumps straight to that band.
bot.onText(
  /^\/deals(?:\s+(\d{1,3}))?/,
  handle(async (msg, match) => {
    const data = await api('/api/data');
    const bandId = match?.[1] ? bandForValue(Number(match[1])).id : DEFAULT_BAND;
    const view = buildDealsPage(data, bandId, 0);

    await send(msg.chat.id, view.text, {
      reply_markup: dealsKeyboard(bandCounts(data.products), bandId, view.page, view.totalPages),
    });
  })
);

/** Band and page taps edit the existing message rather than sending a new one. */
bot.on('callback_query', async (q) => {
  const [prefix, bandId, pageRaw] = String(q.data ?? '').split(':');

  // Disambiguation buttons from /watch carry a product id.
  if (prefix === 'watch') {
    try {
      const { products } = await api('/api/data');
      const p = products.find((x) => String(x.id) === bandId);
      if (!p) throw new Error('product no longer in the catalogue');

      const r = await api('/api/watches', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: q.message.chat.id,
          product_url: p.product_url,
          product_name: p.product_name,
        }),
      });
      await bot.editMessageText(
        `👁 Watching *${esc(p.product_name)}* at ${inr(p.current_price)}.\n` +
          `You now watch ${r.count} product${r.count === 1 ? '' : 's'}.`,
        {
          chat_id: q.message.chat.id,
          message_id: q.message.message_id,
          parse_mode: 'Markdown',
        }
      );
    } catch (err) {
      console.error('[bot] watch callback failed:', err.message);
    }
    return bot.answerCallbackQuery(q.id).catch(() => {});
  }

  if (prefix !== 'deals') return;

  if (bandId === 'noop') {
    return bot.answerCallbackQuery(q.id).catch(() => {});
  }

  try {
    const data = await api('/api/data');
    const view = buildDealsPage(data, bandId, Number(pageRaw) || 0);

    await bot.editMessageText(view.text, {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: dealsKeyboard(bandCounts(data.products), bandId, view.page, view.totalPages),
    });
    await bot.answerCallbackQuery(q.id, { text: `${bandById(bandId).label} — ${view.count} items` });
  } catch (err) {
    // Telegram errors when an edit produces identical content; that is benign.
    if (!/message is not modified/i.test(err.message)) {
      console.error('[bot] callback failed:', err.message);
    }
    await bot.answerCallbackQuery(q.id).catch(() => {});
  }
});

bot.onText(
  /^\/categories/,
  handle(async (msg) => send(msg.chat.id, buildCategories(await api('/api/data'))))
);

bot.onText(
  /^\/status/,
  handle(async (msg) => send(msg.chat.id, buildStatus(await api('/api/status'))))
);

bot.onText(
  /^\/subscribe/,
  handle(async (msg) => {
    await api('/api/subscribers', {
      method: 'POST',
      body: JSON.stringify({ chat_id: msg.chat.id, username: msg.from?.username }),
    });
    await send(
      msg.chat.id,
      '✅ Subscribed. You will get alerts on price drops, restocks and new products.'
    );
  })
);

bot.onText(
  /^\/unsubscribe/,
  handle(async (msg) => {
    await api(`/api/subscribers/${msg.chat.id}`, { method: 'DELETE' });
    await send(msg.chat.id, '👋 Unsubscribed.');
  })
);

/* ---------------- watchlist ---------------- */

bot.onText(
  /^\/watchlist/,
  handle(async (msg) => {
    const [{ watches }, data] = await Promise.all([
      api(`/api/watches/${msg.chat.id}`),
      api('/api/data'),
    ]);
    await sendAll(msg.chat.id, buildWatchlist(watches, data.products));
  })
);

// (?!list) so `/watchlist` does not also fire this handler.
bot.onText(
  /^\/watch(?!list)(?:\s+([\s\S]+))?/,
  handle(async (msg, match) => {
    const query = match?.[1]?.trim();
    if (!query) {
      return send(
        msg.chat.id,
        'Usage: `/watch <part of a product name>`\nExample: `/watch cozy pillow`'
      );
    }

    const { products } = await api('/api/data');
    const matches = findProducts(products, query);

    if (!matches.length) {
      return send(msg.chat.id, `No product matches _${esc(query)}_. Try fewer words.`);
    }

    // More than one candidate: let the user pick rather than guessing wrong.
    if (matches.length > 1 && matches[0].product_name.toLowerCase() !== query.toLowerCase()) {
      return send(msg.chat.id, `*Which one?*\n\nReply with a more specific name:`, {
        reply_markup: {
          inline_keyboard: matches.map((p) => [
            { text: p.product_name.slice(0, 60), callback_data: `watch:${p.id}` },
          ]),
        },
      });
    }

    const p = matches[0];
    const r = await api('/api/watches', {
      method: 'POST',
      body: JSON.stringify({
        chat_id: msg.chat.id,
        product_url: p.product_url,
        product_name: p.product_name,
      }),
    });
    await send(
      msg.chat.id,
      `👁 Watching *${esc(p.product_name)}* at ${inr(p.current_price)}.\n` +
        `You now watch ${r.count} product${r.count === 1 ? '' : 's'}.`
    );
  })
);

bot.onText(
  /^\/unwatch(?:\s+([\s\S]+))?/,
  handle(async (msg, match) => {
    const query = match?.[1]?.trim();
    if (!query) return send(msg.chat.id, 'Usage: `/unwatch <part of a product name>`');

    const { watches } = await api(`/api/watches/${msg.chat.id}`);
    const hit = watches.find((w) =>
      (w.product_name ?? '').toLowerCase().includes(query.toLowerCase())
    );
    if (!hit) return send(msg.chat.id, `Nothing on your watchlist matches _${esc(query)}_.`);

    await api(`/api/watches/${msg.chat.id}?url=${encodeURIComponent(hit.product_url)}`, {
      method: 'DELETE',
    });
    await send(msg.chat.id, `Removed *${esc(hit.product_name ?? hit.product_url)}*.`);
  })
);

/* ---------------- admin commands ---------------- */

// Real `bdata scraper heal` from chat — the live-demo trick.
bot.onText(
  /^\/heal(?:\s+([\s\S]+))?/,
  handle(async (msg, match) => {
    if (!isAdmin(msg.chat.id)) {
      return send(msg.chat.id, `🔒 Admin only. (Your chat ID is \`${msg.chat.id}\`.)`);
    }
    const prompt = match?.[1]?.trim();
    if (!prompt) return send(msg.chat.id, 'Usage: `/heal <describe what broke>`');

    await send(msg.chat.id, '🟡 Healing — calling `bdata scraper heal`. This takes a few minutes…');
    const r = await api('/api/heal', { method: 'POST', body: JSON.stringify({ prompt }) });

    await send(
      msg.chat.id,
      r.awaitingApproval
        ? '🟠 Heal generated and *awaiting approval*.\nApprove with `/approve` or from the dashboard.'
        : `🟢 Heal *${esc(r.status)}*.`
    );
  })
);

bot.onText(
  /^\/approve/,
  handle(async (msg) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '🔒 Admin only.');
    const r = await api('/api/heal/approve', { method: 'POST', body: JSON.stringify({}) });
    await send(msg.chat.id, r.ok ? '🟢 Heal approved and applied.' : '🔴 Approval failed.');
  })
);

bot.onText(
  /^\/refresh/,
  handle(async (msg) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '🔒 Admin only.');
    await send(msg.chat.id, '🔵 Scrape started…');
    const r = await api('/api/refresh', { method: 'POST', body: JSON.stringify({}) });
    await send(
      msg.chat.id,
      r.ok
        ? `✅ Done — ${r.products.length} products${r.healed ? ' _(self-healed mid-run)_' : ''}.`
        : '🔴 Run failed. Check /status.'
    );
  })
);

bot.on('polling_error', (err) => console.error('[bot] polling error:', err.message));

console.log(`[bot] running — API at ${API}`);
console.log(`[bot] admin chats: ${ADMIN_CHATS.length ? ADMIN_CHATS.join(', ') : '(none set)'}`);
