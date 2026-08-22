'use client';

import React from 'react';
import {
  IconOverview,
  IconProducts,
  IconDeals,
  IconCompare,
  IconWatchlist,
  IconHealth,
} from './Icons';

export type ViewId = 'overview' | 'products' | 'deals' | 'compare' | 'watchlist' | 'health';

const TABS: {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeKey?: 'products' | 'deals' | 'watchlist';
}[] = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'products', label: 'Products', icon: IconProducts, badgeKey: 'products' },
  { id: 'deals', label: 'Deals', icon: IconDeals, badgeKey: 'deals' },
  { id: 'compare', label: 'Compare', icon: IconCompare },
  { id: 'watchlist', label: 'Watchlist', icon: IconWatchlist, badgeKey: 'watchlist' },
  { id: 'health', label: 'Health', icon: IconHealth },
];

export default function Tabs({
  active,
  onChange,
  counts = {},
}: {
  active: ViewId;
  onChange: (v: ViewId) => void;
  counts?: Partial<Record<ViewId, number>>;
}) {
  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xs"
      aria-label="Dashboard views"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        const Icon = t.icon;
        const n = t.badgeKey ? counts[t.badgeKey] : undefined;

        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              isActive
                ? 'bg-indigo-50 text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon
              className={isActive ? 'text-indigo-600' : 'text-slate-400'}
              size={15}
            />
            <span>{t.label}</span>
            {typeof n === 'number' && n > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
