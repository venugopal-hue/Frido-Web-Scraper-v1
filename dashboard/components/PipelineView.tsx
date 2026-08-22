'use client';

import { Progress, Status } from '@/lib/api';
import Card from './Card';

type Stage = {
  id: string;
  label: string;
  detail: (p: Progress | null | undefined) => string;
};

/**
 * The real pipeline stages, in the order runCycle executes them.
 *
 * Each maps to an event the backend already emits, so this lights up from
 * actual progress rather than a timer — a fake progress bar would be worse
 * than none.
 */
const STAGES: Stage[] = [
  { id: 'starting', label: 'Start', detail: () => 'asking Bright Data' },
  {
    id: 'scraping',
    label: 'Scrape',
    detail: (p) => (p?.phase === 'scraping' && p.of ? `batch ${p.chunk} of ${p.of}` : 'read the store'),
  },
  { id: 'dedupe', label: 'Dedupe', detail: () => 'remove repeats' },
  {
    id: 'images',
    label: 'Images',
    detail: (p) => (p?.phase === 'images' ? `fetching ${p.count}` : 'fill in photos'),
  },
  { id: 'check', label: 'Check', detail: () => 'is the data sane?' },
  { id: 'store', label: 'Store', detail: () => 'save and compare' },
];

/** How far the run has got. -1 when idle. */
function activeIndex(p: Progress | null | undefined): number {
  if (!p) return -1;
  switch (p.phase) {
    case 'starting':
      return 0;
    case 'scraping':
      return 1;
    case 'images':
      return 3; // dedupe happens between scrape and enrich
    case 'healing':
      return 4; // degradation detected during the health check
    default:
      return -1;
  }
}

export default function PipelineView({ status }: { status: Status | null }) {
  const progress = status?.progress;
  const active = activeIndex(progress);
  const running = active >= 0;
  const healing = progress?.phase === 'healing';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">How an update runs</h2>
        <span className="text-[12px] text-[--text-faint]">
          {running ? 'running now' : 'next check on the hour'}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Each step lights up as it happens.
      </p>

      <ol className="mt-5 flex items-stretch gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const done = running && i < active;
          const current = running && i === active;

          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className={[
                  'min-w-[104px] flex-1 rounded-lg border px-3 py-2.5 transition',
                  current
                    ? healing
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-blue-300 bg-blue-50'
                    : done
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-[--border] bg-[--surface]',
                ].join(' ')}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={[
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      current
                        ? healing
                          ? 'bg-amber-500'
                          : 'animate-pulse bg-blue-500'
                        : done
                          ? 'bg-emerald-500'
                          : 'bg-neutral-300',
                    ].join(' ')}
                  />
                  <span
                    className={`truncate text-[12px] font-medium ${
                      current || done ? 'text-[--text]' : 'text-[--text-faint]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-[--text-faint]">{s.detail(progress)}</p>
              </div>

              {i < STAGES.length - 1 && (
                <span aria-hidden className="shrink-0 text-[--text-faint]">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {healing && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Something looked wrong — fixing the scraper before saving.
        </p>
      )}
    </Card>
  );
}
