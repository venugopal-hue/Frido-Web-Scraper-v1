'use client';

import React from 'react';
import { ViewId } from './Tabs';
import { Status } from '@/lib/api';
import {
  IconOverview,
  IconProducts,
  IconDeals,
  IconCompare,
  IconWatchlist,
  IconHealth,
  IconTelegram,
  IconShieldCheck,
  IconClose,
} from './Icons';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeKey?: 'products' | 'deals' | 'watchlist';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'products', label: 'Catalogue', icon: IconProducts, badgeKey: 'products' },
  { id: 'deals', label: 'Deals & Radar', icon: IconDeals, badgeKey: 'deals' },
  { id: 'compare', label: 'Compare Matrix', icon: IconCompare },
  { id: 'watchlist', label: 'Telegram Watchlist', icon: IconWatchlist, badgeKey: 'watchlist' },
  { id: 'health', label: 'System Health', icon: IconHealth },
];

export default function Sidebar({
  active,
  onChange,
  counts = {},
  status,
  mobileOpen,
  onCloseMobile,
}: {
  active: ViewId;
  onChange: (v: ViewId) => void;
  counts?: Partial<Record<ViewId, number>>;
  status: Status | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const botHandle = (
    process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? 'Frido_WebScraper_Bot'
  ).replace(/^@/, '');

  const isHealthy = status?.health === 'healthy';
  const isUpdating = status?.scraping || status?.health === 'running';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Top section: Brand & Navigation */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-200">
              <span className="text-base font-bold tracking-wider">F</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tracking-tight text-slate-900">Frido Tracker</span>
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[11px] font-medium text-slate-500">Live Price Intelligence</span>
            </div>
          </div>

          {/* Close mobile button */}
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1" aria-label="Sidebar navigation">
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            const count = item.badgeKey ? counts[item.badgeKey] : undefined;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onChange(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                    size={17}
                  />
                  <span>{item.label}</span>
                </div>

                {item.id === 'health' ? (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isUpdating
                        ? 'animate-pulse bg-blue-500'
                        : isHealthy
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                    }`}
                  />
                ) : typeof count === 'number' && count > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: Scraper Status Card & Telegram Shortcut */}
      <div className="space-y-3 pt-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <IconShieldCheck className="text-indigo-600" size={15} />
              <span className="font-semibold text-slate-800">Scraper Engine</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isHealthy
                  ? 'bg-emerald-100 text-emerald-700'
                  : isUpdating
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isHealthy ? 'bg-emerald-500' : isUpdating ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isUpdating ? 'Updating' : isHealthy ? 'Active' : 'Standby'}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Collector ID</span>
              <span className="font-mono text-slate-700 truncate max-w-[90px]" title={status?.collector_id ?? '—'}>
                {status?.collector_id ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Subscribers</span>
              <span className="font-semibold text-slate-700">{status?.subscribers ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Telegram bot button */}
        <a
          href={`https://t.me/${botHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <IconTelegram className="text-sky-500" size={15} />
          <span>Telegram Alerts</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-2xl transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
