'use client';

import { Health, Status, timeAgo } from '@/lib/api';

const STATES: Record<Health, { label: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  running: { label: 'Scraping', dot: 'bg-blue-500', text: 'text-blue-700' },
  healing: { label: 'Healing', dot: 'bg-amber-500', text: 'text-amber-700' },
  awaiting_approval: { label: 'Awaiting approval', dot: 'bg-orange-500', text: 'text-orange-700' },
  broken: { label: 'Broken', dot: 'bg-rose-500', text: 'text-rose-700' },
  unknown: { label: 'No runs yet', dot: 'bg-neutral-300', text: 'text-neutral-500' },
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
  if (!status) return <div className="skeleton h-16 rounded-xl" />;

  const state = STATES[status.health] ?? STATES.unknown;
  const busy = refreshing || status.scraping;

  // A full scrape is 8 sequential chunk jobs and can take 20 minutes. Without
  // a phase label the bar just reads "Scraping" the whole time and looks hung.
  const p = status.progress;
  const progressLabel = !p
    ? null
    : p.phase === 'scraping' && p.of
      ? `batch ${p.chunk} of ${p.of}`
      : p.phase === 'images'
        ? `fetching ${p.count} images`
        : p.phase === 'healing'
          ? 'repairing scraper'
          : 'starting';

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-[--border] pb-6">
      <div className="mr-auto">
        <h1 className="text-[22px] font-semibold tracking-tight">Frido Price Tracker</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[--text-muted]">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
            <span className={state.text}>{state.label}</span>
          </span>
          {progressLabel && (
            <>
              <span className="text-[--text-faint]">·</span>
              <span className="text-[--text-muted]">{progressLabel}</span>
            </>
          )}
          <span className="text-[--text-faint]">·</span>
          <span>{status.last_run?.item_count ?? 0} products</span>
          <span className="text-[--text-faint]">·</span>
          <span>
            updated {timeAgo(status.last_run?.finished_at ?? status.last_run?.started_at ?? null)}
          </span>
        </p>
      </div>

      <dl className="flex gap-8 text-[13px]">
        <div>
          <dt className="text-[--text-faint]">Collector</dt>
          <dd className="mt-0.5 font-mono text-[12px]">{status.collector_id || '—'}</dd>
        </div>
        <div>
          <dt className="text-[--text-faint]">Subscribers</dt>
          <dd className="mt-0.5">{status.subscribers}</dd>
        </div>
      </dl>

      <button
        onClick={onRefresh}
        disabled={busy}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition
                   hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {busy ? 'Running…' : 'Run now'}
      </button>
    </header>
  );
}
