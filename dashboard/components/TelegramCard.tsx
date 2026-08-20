'use client';

import Card from './Card';

const COMMANDS: [string, string][] = [
  ['/latest', 'Current prices, best discounts first'],
  ['/deals', 'Everything at 50% off or more'],
  ['/categories', 'Item counts and entry prices'],
  ['/subscribe', 'Alerts on price drops and restocks'],
  ['/status', 'Scraper health and last heal'],
];

export default function TelegramCard({ username }: { username?: string }) {
  const handle = (
    username ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT ??
    'Frido_WebScraper_Bot'
  ).replace(/^@/, '');

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">On Telegram</h2>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Reads the same API as this dashboard.
      </p>

      <ul className="mt-4 space-y-2">
        {COMMANDS.map(([cmd, desc]) => (
          <li key={cmd} className="flex items-baseline gap-3 text-[13px]">
            <code className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
              {cmd}
            </code>
            <span className="text-[--text-muted]">{desc}</span>
          </li>
        ))}
      </ul>

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
