'use client';

import { Product, Watch, inr, isOutOfStock, timeAgo } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';

/**
 * Products someone is following via the Telegram bot.
 *
 * The watchlist lives in the bot (`/watch <name>`), so this view is read-only —
 * it shows what is being tracked and where those prices stand now.
 */
export default function WatchlistView({
  watches,
  products,
  series,
  onSelect,
}: {
  watches: Watch[];
  products: Product[];
  series: Record<string, number[]>;
  onSelect: (p: Product) => void;
}) {
  const byUrl = new Map(products.map((p) => [p.product_url ?? '', p]));

  if (!watches.length) {
    return (
      <Card className="p-10 text-center">
        <p className="text-[15px] font-medium">Nothing is being watched yet</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[--text-muted]">
          Send <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">/watch cozy pillow</code>{' '}
          to the Telegram bot to follow a product, or{' '}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
            /watch cozy pillow below 600
          </code>{' '}
          to hear about it only when it drops under your price.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Watched products</h2>
        <span className="text-[12px] text-[--text-faint]">{watches.length} tracked</span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Added from Telegram. If you set a price, nothing is sent until it actually drops that
        low.
      </p>

      <ul className="mt-4 divide-y divide-[--border]">
        {watches.map((w) => {
          const p = byUrl.get(w.product_url);
          const points = series[w.product_url];

          if (!p) {
            return (
              <li key={w.product_url} className="py-3 text-[13px]">
                <span className="font-medium">{w.product_name ?? w.product_url}</span>
                <span className="ml-2 text-[--text-faint]">no longer in the catalogue</span>
              </li>
            );
          }

          const out = isOutOfStock(p.availability);
          return (
            <li key={w.product_url}>
              <button
                onClick={() => onSelect(p)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-neutral-50"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded border border-[--border] bg-white object-contain"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.product_name}</span>
                  <span className="block text-[12px] text-[--text-faint]">
                    following since {timeAgo(w.since)}
                    {w.watchers > 1 && ` · ${w.watchers} people`}
                  </span>
                  {typeof w.target_price === 'number' && (
                    <span
                      className={`mt-0.5 inline-block text-[12px] ${
                        p.current_price !== null && p.current_price <= w.target_price
                          ? 'font-medium text-emerald-700'
                          : 'text-[--text-muted]'
                      }`}
                    >
                      {p.current_price !== null && p.current_price <= w.target_price
                        ? `🎯 Now under your ${inr(w.target_price)}`
                        : `🎯 Waiting for ${inr(w.target_price)}` +
                          (p.current_price !== null
                            ? ` · ${inr(p.current_price - w.target_price)} more to drop`
                            : '')}
                    </span>
                  )}
                </span>

                {points && <Sparkline values={points} />}

                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-semibold tabular-nums">
                    {inr(p.current_price)}
                  </span>
                  {out && <span className="block text-[11px] text-rose-600">Sold out</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
