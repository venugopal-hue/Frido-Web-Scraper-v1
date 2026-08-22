'use client';

import { HealEvent, Run, Status, timeAgo } from '@/lib/api';
import Card from './Card';
import HealTimeline from './HealTimeline';

const RUN_STYLES: Record<string, { dot: string; label: string; tone?: string }> = {
  success: { dot: 'bg-emerald-500', label: 'done' },
  running: { dot: 'animate-pulse bg-blue-500', label: 'checking now' },
  failed: { dot: 'bg-rose-500', label: 'failed', tone: 'text-rose-600' },
  empty: { dot: 'bg-amber-500', label: 'found nothing', tone: 'text-amber-700' },
  interrupted: { dot: 'bg-neutral-400', label: 'stopped early', tone: 'text-[--text-faint]' },
};

/**
 * A run killed by the machine sleeping or the server restarting is not a
 * scraper failure. Showing those in red made a healthy scraper look like it
 * fails half the time, and dragged the success rate down with it.
 */
const isInterrupted = (r: Run) => /interrupted/i.test(r.error ?? '');
const styleFor = (r: Run) =>
  isInterrupted(r) ? RUN_STYLES.interrupted : (RUN_STYLES[r.status] ?? RUN_STYLES.failed);

/** Duration in whole minutes/seconds — runs span 20 minutes, so ms is noise. */
function duration(run: Run) {
  if (!run.finished_at) return '—';
  const ms = Date.parse(run.finished_at) - Date.parse(run.started_at);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HealthView({
  status,
  heals,
  runs,
}: {
  status: Status | null;
  heals: HealEvent[];
  runs: Run[];
}) {
  // Interrupted runs are excluded from the denominator — they say nothing
  // about whether the scraper works.
  const attempted = runs.filter((r) => r.status !== 'running' && !isInterrupted(r));
  const succeeded = attempted.filter((r) => r.status === 'success').length;
  const rate = attempted.length ? Math.round((succeeded / attempted.length) * 100) : 0;
  const interrupted = runs.filter(isInterrupted).length;
  const repaired = heals.filter((h) => h.status === 'healed').length;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[--border] bg-[--border] sm:grid-cols-4">
        <Stat
          label="Updates that worked"
          value={attempted.length ? `${rate}%` : '—'}
          hint={
            interrupted
              ? `${succeeded} of ${attempted.length} · ${interrupted} cut short`
              : `${succeeded} of ${attempted.length}`
          }
        />
        <Stat
          label="Times it fixed itself"
          value={String(repaired)}
          hint={`${heals.length} attempts`}
        />
        <Stat
          label="Bright Data scraper"
          value={status?.collector_id ? 'Connected' : '—'}
          hint={status?.collector_id ?? ''}
          mono
        />
        <Stat
          label="People getting alerts"
          value={String(status?.subscribers ?? 0)}
          hint="Telegram"
        />
      </dl>

      <HealTimeline events={heals} />

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Update history</h2>
          <span className="text-[12px] text-[--text-faint]">last {runs.length} runs</span>
        </div>
        <p className="mt-1 text-[13px] text-[--text-muted]">
          Every time the tracker checked the store, and how it went.
        </p>

        {runs.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[--border] p-5 text-center text-[13px] text-[--text-faint]">
            No runs recorded yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[--border]">
            {runs.map((r) => {
              const s = styleFor(r);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="w-12 shrink-0 font-mono text-[12px] text-[--text-faint]">
                    #{r.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[--text]">
                      {r.status === 'running' ? 'scraping…' : `${r.item_count} products`}
                    </span>
                    <span className={s.tone ?? 'text-[--text-faint]'}> · {s.label}</span>
                    {r.error && !isInterrupted(r) && (
                      <span className="block truncate text-[12px] text-rose-600">{r.error}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-[--text-faint]">{duration(r)}</span>
                  <span className="w-20 shrink-0 text-right text-[12px] text-[--text-faint]">
                    {timeAgo(r.finished_at ?? r.started_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-[--surface] px-5 py-4">
      <dt className="text-[12px] text-[--text-faint]">{label}</dt>
      <dd className="mt-1 text-[20px] font-semibold leading-none tracking-tight">{value}</dd>
      {hint && (
        <dd className={`mt-1.5 truncate text-[11px] text-[--text-muted] ${mono ? 'font-mono' : ''}`}>
          {hint}
        </dd>
      )}
    </div>
  );
}
