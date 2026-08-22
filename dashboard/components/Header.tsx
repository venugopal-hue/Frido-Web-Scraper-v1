'use client';

import React from 'react';
import { Health, Status, timeAgo } from '@/lib/api';
import { ViewId } from './Tabs';
import { IconMenu, IconDownload, IconRefresh } from './Icons';

const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Analytics Overview',
    subtitle: 'Real-time catalogue pricing & discount distribution',
  },
  products: {
    title: 'Product Catalogue',
    subtitle: 'Browse, filter and inspect all tracked inventory',
  },
  deals: {
    title: 'Deals & Price Radar',
    subtitle: 'Curated deep discounts, multi-pack savings & historical drops',
  },
  compare: {
    title: 'Product Matrix Comparison',
    subtitle: 'Direct side-by-side spec, pricing, and unit-cost comparison',
  },
  watchlist: {
    title: 'Telegram Alert Watchlist',
    subtitle: 'User-subscribed products & target price monitoring',
  },
  health: {
    title: 'Collector Engine Health',
    subtitle: 'Audit logs, self-healing events & run reliability history',
  },
};

const HEALTH_CONFIG: Record<
  Health,
  { label: string; dot: string; bg: string; text: string }
> = {
  healthy: {
    label: 'Live',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200/60',
    text: 'text-emerald-700',
  },
  running: {
    label: 'Scraping',
    dot: 'bg-blue-500 animate-ping',
    bg: 'bg-blue-50 border-blue-200/60',
    text: 'text-blue-700',
  },
  healing: {
    label: 'Auto-Healing',
    dot: 'bg-amber-500 animate-pulse',
    bg: 'bg-amber-50 border-amber-200/60',
    text: 'text-amber-700',
  },
  awaiting_approval: {
    label: 'Approval Needed',
    dot: 'bg-orange-500',
    bg: 'bg-orange-50 border-orange-200/60',
    text: 'text-orange-700',
  },
  broken: {
    label: 'Offline',
    dot: 'bg-rose-500',
    bg: 'bg-rose-50 border-rose-200/60',
    text: 'text-rose-700',
  },
  stale: {
    label: 'Outdated',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 border-amber-200/60',
    text: 'text-amber-700',
  },
  unknown: {
    label: 'Connecting',
    dot: 'bg-slate-300',
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-500',
  },
};

export default function Header({
  view,
  status,
  onRefresh,
  refreshing,
  onOpenMobile,
}: {
  view: ViewId;
  status: Status | null;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenMobile: () => void;
}) {
  const meta = VIEW_TITLES[view] ?? VIEW_TITLES.overview;
  const healthState = status ? HEALTH_CONFIG[status.health] ?? HEALTH_CONFIG.unknown : HEALTH_CONFIG.unknown;
  const busy = refreshing || (status?.scraping ?? false);

  const p = status?.progress;
  const progressLabel = !p
    ? null
    : p.phase === 'scraping' && p.of
      ? `Batch ${p.chunk}/${p.of}`
      : p.phase === 'images'
        ? `Photos (${p.count})`
        : p.phase === 'healing'
          ? 'Repairing...'
          : 'Initializing';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-8">
      {/* Left side: Mobile menu toggle + Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
          aria-label="Open navigation menu"
        >
          <IconMenu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
              {meta.title}
            </h1>
          </div>
          <p className="hidden text-xs text-slate-500 sm:block truncate">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: Live status pill + Action Buttons */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Status indicator pill */}
        <div
          className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium md:flex ${healthState.bg}`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${healthState.dot}`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                status?.health === 'healthy' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
          </span>

          <span className={healthState.text}>
            {progressLabel ? `${healthState.label}: ${progressLabel}` : healthState.label}
          </span>

          <span className="text-slate-300">·</span>

          <span className="text-slate-600 tabular-nums">
            {status?.last_run?.item_count ?? 0} items
          </span>

          <span className="text-slate-300">·</span>

          <span className="text-slate-500">
            {timeAgo(status?.last_run?.finished_at ?? status?.last_run?.started_at ?? null)}
          </span>
        </div>

        {/* Export CSV button */}
        <a
          href="/api/export.csv"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          title="Download full catalogue CSV"
        >
          <IconDownload size={14} className="text-slate-500" />
          <span className="hidden sm:inline">Export</span>
        </a>

        {/* Trigger Scrape Run button */}
        <button
          onClick={onRefresh}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition ${
            busy
              ? 'cursor-not-allowed bg-indigo-400'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
          }`}
        >
          <IconRefresh
            size={14}
            className={busy ? 'animate-spin' : ''}
          />
          <span>{busy ? 'Running…' : 'Run Scraper'}</span>
        </button>
      </div>
    </header>
  );
}
