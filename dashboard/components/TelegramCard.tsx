'use client';

import Card from './Card';

/**
 * The bot's full command list, in plain language.
 *
 * Worth keeping complete rather than a teaser: this is the only place someone
 * on the web can find out what the bot does before opening Telegram.
 */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Browse',
    items: [
      ['/deals', 'Filter by how much is off — tap a range'],
      ['/latest', 'Top 20 products, biggest savings first'],
      ['/categories', 'What each category has, and its cheapest item'],
    ],
  },
  {
    title: 'Get alerts',
    items: [
      ['/watch cozy pillow', 'Tell me whenever this price changes'],
      ['/watch cozy pillow below 600', 'Only tell me when it drops under ₹600'],
      ['/watchlist', 'Everything I follow, and how close to my price'],
      ['/unwatch cozy pillow', 'Stop following it'],
      ['/subscribe', 'Alerts for the whole store, not one product'],
    ],
  },
  {
    title: 'Check',
    items: [['/status', 'Is the tracker working, and when did it last update']],
  },
];

export default function TelegramCard({ username }: { username?: string }) {
  const handle = (
    username ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT ??
    'Frido_WebScraper_Bot'
  ).replace(/^@/, '');

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Get this on Telegram</h2>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Same prices as this page, plus alerts when something you want gets cheaper.
      </p>

      <div className="mt-4 space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="text-[11px] uppercase tracking-wider text-[--text-faint]">{g.title}</h3>
            <ul className="mt-1.5 space-y-1.5">
              {g.items.map(([cmd, desc]) => (
                <li key={cmd} className="text-[13px]">
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                    {cmd}
                  </code>
                  <span className="ml-2 text-[--text-muted]">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <a
        href={`https://t.me/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 block rounded-lg border border-[--border] py-2 text-center text-[13px] font-medium transition hover:border-neutral-400 hover:bg-neutral-50"
      >
        Open @{handle}
      </a>
    </Card>
  );
}
