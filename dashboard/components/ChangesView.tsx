'use client';

import React from 'react';
import { Changes, Product, inr, timeAgo } from '@/lib/api';
import Card from './Card';
import {
  IconTrendingDown,
  IconTrendingUp,
  IconPackage,
  IconAlertTriangle,
  IconExternalLink,
} from './Icons';

export default function ChangesView({
  changes,
  products,
  onSelect,
}: {
  changes: Changes | null;
  products: Product[];
  onSelect: (p: Product) => void;
}) {
  const byUrl = new Map(products.map((p) => [p.product_url ?? '', p]));
  const open = (url?: string | null) => {
    const p = url ? byUrl.get(url) : null;
    if (p) onSelect(p);
  };

  if (!changes?.diff) {
    return (
      <Card className="p-8 text-center border-slate-200/80 bg-white">
        <p className="text-sm font-semibold text-slate-800">No Run Diff Available</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          {changes?.reason ??
            'At least two completed scraper passes are required to compute run-over-run diffs.'}
        </p>
      </Card>
    );
  }

  const { diff, from, to } = changes;
  const total =
    diff.priceChanges.length +
    diff.newItems.length +
    diff.backInStock.length +
    diff.wentOutOfStock.length;

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              Run-over-Run Diff Radar
            </h2>
            <p className="text-xs text-slate-500">
              Inventory and price changes detected between the two most recent collector passes.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-600">
            #{from?.id ?? '—'} → #{to?.id ?? '—'} · {timeAgo(to?.finished_at ?? null)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {total === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <p className="text-xs font-semibold text-slate-700">Zero Inventory Drift</p>
            <p className="mt-1 text-xs text-slate-400">
              Every single price, SKU, and stock availability state was identical between runs #{from?.id} and #{to?.id}.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Price Changes */}
            {diff.priceChanges.length > 0 && (
              <Group
                title="Price Adjustments"
                count={diff.priceChanges.length}
                icon={IconTrendingDown}
                badgeColor="bg-indigo-50 text-indigo-700"
                items={diff.priceChanges.map((c) => ({
                  key: c.product_url,
                  name: c.product_name,
                  detail: (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        c.direction === 'drop' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {c.direction === 'drop' ? '↓' : '↑'} {inr(c.from)} → {inr(c.to)}
                    </span>
                  ),
                  url: c.product_url,
                }))}
                onOpen={open}
              />
            )}

            {/* Back in stock */}
            {diff.backInStock.length > 0 && (
              <Group
                title="Restocked / Back in Stock"
                count={diff.backInStock.length}
                icon={IconPackage}
                badgeColor="bg-emerald-50 text-emerald-700"
                items={diff.backInStock.map((p) => ({
                  key: p.product_url ?? p.product_name,
                  name: p.product_name,
                  detail: <span className="font-semibold text-slate-900">{inr(p.current_price)}</span>,
                  url: p.product_url,
                }))}
                onOpen={open}
              />
            )}

            {/* Just Sold Out */}
            {diff.wentOutOfStock.length > 0 && (
              <Group
                title="Newly Sold Out"
                count={diff.wentOutOfStock.length}
                icon={IconAlertTriangle}
                badgeColor="bg-rose-50 text-rose-700"
                items={diff.wentOutOfStock.map((p) => ({
                  key: p.product_url ?? p.product_name,
                  name: p.product_name,
                  detail: <span className="text-rose-600 font-medium">Out of stock</span>,
                  url: p.product_url,
                }))}
                onOpen={open}
              />
            )}

            {/* New Products */}
            {diff.newItems.length > 0 && (
              <Group
                title="New Additions to Catalogue"
                count={diff.newItems.length}
                icon={IconPackage}
                badgeColor="bg-sky-50 text-sky-700"
                items={diff.newItems.map((p) => ({
                  key: p.product_url ?? p.product_name,
                  name: p.product_name,
                  detail: <span className="font-semibold text-slate-900">{inr(p.current_price)}</span>,
                  url: p.product_url,
                }))}
                onOpen={open}
              />
            )}
          </div>
        )}

        {diff.removed.length > 0 && (
          <p className="mt-4 text-center text-xs text-slate-400">
            {diff.removed.length} item{diff.removed.length === 1 ? '' : 's'} unlisted or delisted from the store catalogue.
          </p>
        )}
      </div>
    </Card>
  );
}

function Group({
  title,
  count,
  icon: Icon,
  badgeColor,
  items,
  onOpen,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeColor: string;
  items: { key: string; name: string; detail: React.ReactNode; url?: string | null }[];
  onOpen: (url?: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5">
      <div className="flex items-center justify-between pb-2.5">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-slate-600" />
          <h3 className="text-xs font-bold text-slate-800">{title}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
          {count}
        </span>
      </div>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/60 bg-white">
        {items.slice(0, 8).map((i) => (
          <li key={i.key}>
            <button
              onClick={() => onOpen(i.url)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition hover:bg-slate-50 focus:outline-hidden"
              title="Click to view full price chart"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700 hover:text-indigo-600">
                {i.name}
              </span>
              <span className="shrink-0 tabular-nums">{i.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
