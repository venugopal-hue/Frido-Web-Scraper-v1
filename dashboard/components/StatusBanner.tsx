'use client';

import { Health, Status, timeAgo } from '@/lib/api';
import { IconShieldCheck, IconDownload, IconRefresh } from './Icons';

const STATES: Record<Health, { label: string; dot: string; text: string; bg: string }> = {
  healthy: {
    label: 'Live & Operational',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200/60',
  },
  running: {
    label: 'Updating Inventory',
    dot: 'bg-blue-500 animate-ping',
    text: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200/60',
  },
  healing: {
    label: 'Repairing Selectors',
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200/60',
  },
  awaiting_approval: {
    label: 'Approval Required',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200/60',
  },
  broken: {
    label: 'Scraper Offline',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200/60',
  },
  stale: {
    label: 'Outdated Data',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200/60',
  },
  unknown: {
    label: 'Connecting...',
    dot: 'bg-slate-300',
    text: 'text-slate-500',
    bg: 'bg-slate-50 border-slate-200',
  },
};

export default function StatusBanner({
  status,
  onRefresh,
  refreshing,
}: {
  status: Status | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (!status) return <div className="skeleton h-20 rounded-2xl border border-slate-200/60" />;

  const state = STATES[status.health] ?? STATES.unknown;
  const busy = refreshing || status.scraping;

  const p = status.progress;
  const progressLabel = !p
    ? null
    : p.phase === 'scraping' && p.of
      ? `Batch ${p.chunk} of ${p.of}`
      : p.phase === 'images'
        ? `Fetching ${p.count} photos`
        : p.phase === 'healing'
          ? 'Repairing scraper DOM'
          : 'Initializing';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
          <IconShieldCheck size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">Frido Price Tracker</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${state.bg} ${state.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
              <span>{state.label}</span>
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {progressLabel && (
              <>
                <span className="font-semibold text-indigo-600">{progressLabel}</span>
                <span>·</span>
              </>
            )}
            <span>{status.last_run?.item_count ?? 0} tracked products</span>
            <span>·</span>
            <span>
              Updated {timeAgo(status.last_run?.finished_at ?? status.last_run?.started_at ?? null)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <dl className="hidden sm:flex items-center gap-6 pr-4 border-r border-slate-100 text-xs">
          <div>
            <dt className="text-slate-400 font-medium">Collector</dt>
            <dd className="font-mono font-semibold text-slate-700 mt-0.5 max-w-[100px] truncate">
              {status.collector_id || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Subscribers</dt>
            <dd className="font-semibold text-slate-700 mt-0.5">{status.subscribers}</dd>
          </div>
        </dl>

        <a
          href="/api/export.csv"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
        >
          <IconDownload size={14} />
          <span>Export CSV</span>
        </a>

        <button
          onClick={onRefresh}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition ${
            busy
              ? 'cursor-not-allowed bg-indigo-400'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
          }`}
        >
          <IconRefresh size={14} className={busy ? 'animate-spin' : ''} />
          <span>{busy ? 'Running…' : 'Run now'}</span>
        </button>
      </div>
    </div>
  );
}
