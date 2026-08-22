'use client';

import Card from './Card';
import { IconTelegram, IconExternalLink } from './Icons';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Browse Catalogue',
    items: [
      ['/deals', 'Filter products by percentage off & range'],
      ['/latest', 'Top 20 products ordered by biggest savings'],
      ['/categories', 'Summary of category counts & floor prices'],
    ],
  },
  {
    title: 'Instant Price Alerts',
    items: [
      ['/watch comfy pillow', 'Alert on any price change for this item'],
      ['/watch comfy pillow below 600', 'Alert only when price drops below ₹600'],
      ['/watchlist', 'View all tracked items & target progress'],
      ['/unwatch comfy pillow', 'Remove item from active alert list'],
      ['/subscribe', 'Receive broadcast alerts for storewide drops'],
    ],
  },
  {
    title: 'Diagnostics',
    items: [['/status', 'Check live scraper health & last update time']],
  },
];

export default function TelegramCard({ username }: { username?: string }) {
  const handle = (
    username ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT ??
    'Frido_WebScraper_Bot'
  ).replace(/^@/, '');

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
          <IconTelegram size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            Telegram Real-Time Bot
          </h2>
          <p className="text-xs text-slate-500">
            Subscribe for immediate push notifications whenever tracked prices drop.
          </p>
        </div>
      </div>

      {/* Commands Reference List */}
      <div className="mt-4 space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {g.title}
            </h3>
            <ul className="mt-2 space-y-2">
              {g.items.map(([cmd, desc]) => (
                <li
                  key={cmd}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs"
                >
                  <code className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-600 border border-slate-200 shadow-2xs">
                    {cmd}
                  </code>
                  <span className="text-slate-600 font-medium">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Launch Bot CTA Button */}
      <a
        href={`https://t.me/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-sky-600 active:bg-sky-700"
      >
        <IconTelegram size={16} />
        <span>Open @{handle} in Telegram</span>
        <IconExternalLink size={13} className="text-sky-100" />
      </a>
    </Card>
  );
}
