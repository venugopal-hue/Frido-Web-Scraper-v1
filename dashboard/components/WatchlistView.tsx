'use client';

import { Product, Watch, inr, isOutOfStock, timeAgo } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';
import { IconWatchlist, IconTelegram, IconExternalLink } from './Icons';

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
      <Card className="flex flex-col items-center justify-center p-12 text-center border-slate-200/80 bg-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <IconWatchlist size={24} />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-800">
          No Active Price Watches
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
          Track products directly via the Telegram bot by sending{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-600">
            /watch &lt;product&gt;
          </code>{' '}
          or set a target drop threshold with{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-600">
            /watch &lt;product&gt; below 600
          </code>.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconWatchlist size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                Telegram User Watchlist
              </h2>
              <p className="text-xs text-slate-500">
                Products currently followed by subscribers with configured target price alerts.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {watches.length} Tracked Items
          </span>
        </div>
      </div>

      {/* List */}
      <ul className="divide-y divide-slate-100">
        {watches.map((w) => {
          const p = byUrl.get(w.product_url);
          const points = series[w.product_url];

          if (!p) {
            return (
              <li key={w.product_url} className="flex items-center justify-between p-4 text-xs">
                <span className="font-semibold text-slate-800">{w.product_name ?? w.product_url}</span>
                <span className="text-slate-400">Delisted from catalogue</span>
              </li>
            );
          }

          const out = isOutOfStock(p.availability);
          const targetHit =
            typeof w.target_price === 'number' &&
            p.current_price !== null &&
            p.current_price <= w.target_price;

          return (
            <li key={w.product_url}>
              <button
                onClick={() => onSelect(p)}
                className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50/70 focus:outline-hidden"
                title="Click to view full price history chart"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 shadow-2xs"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-900 hover:text-indigo-600">
                    {p.product_name}
                  </span>

                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>Followed {timeAgo(w.since)}</span>
                    {w.watchers > 1 && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-slate-600">{w.watchers} subscribers</span>
                      </>
                    )}
                  </div>

                  {typeof w.target_price === 'number' && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          targetHit
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        <span>{targetHit ? '🎯 Target Reached:' : '🎯 Target Threshold:'}</span>
                        <span>{inr(w.target_price)}</span>
                        {!targetHit && p.current_price !== null && (
                          <span className="text-slate-400 font-normal">
                            ({inr(p.current_price - w.target_price)} to drop)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {points && (
                  <div className="hidden sm:block shrink-0 px-2">
                    <Sparkline values={points} />
                  </div>
                )}

                <div className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-slate-900 tabular-nums">
                    {inr(p.current_price)}
                  </span>
                  {out ? (
                    <span className="mt-0.5 block text-[10px] font-semibold text-rose-600">
                      Sold out
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] font-semibold text-emerald-600">
                      In stock
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
