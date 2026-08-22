'use client';

import { Progress, Status } from '@/lib/api';
import Card from './Card';
import { IconLayers, IconCheck, IconClock, IconSparkles } from './Icons';

type Stage = {
  id: string;
  label: string;
  detail: (p: Progress | null | undefined) => string;
};

const STAGES: Stage[] = [
  { id: 'starting', label: 'Initialize', detail: () => 'Trigger Bright Data' },
  {
    id: 'scraping',
    label: 'Scrape Store',
    detail: (p) => (p?.phase === 'scraping' && p.of ? `Batch ${p.chunk} of ${p.of}` : 'Extract products'),
  },
  { id: 'dedupe', label: 'Deduplicate', detail: () => 'Clean redundant SKUs' },
  {
    id: 'images',
    label: 'Asset Sync',
    detail: (p) => (p?.phase === 'images' ? `Sync ${p.count} photos` : 'Optimize images'),
  },
  { id: 'check', label: 'Health Check', detail: () => 'Validate field schema' },
  { id: 'store', label: 'Store & Diff', detail: () => 'Commit prices & alert' },
];

function activeIndex(p: Progress | null | undefined): number {
  if (!p) return -1;
  switch (p.phase) {
    case 'starting':
      return 0;
    case 'scraping':
      return 1;
    case 'images':
      return 3;
    case 'healing':
      return 4;
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
    <Card className="overflow-hidden border-slate-200/80 bg-white p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconLayers size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              Scraper Execution Pipeline
            </h2>
            <p className="text-xs text-slate-500">
              Live multi-stage ingestion workflow powered by Bright Data Scraper Studio.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            running
              ? healing
                ? 'bg-amber-100 text-amber-800'
                : 'bg-blue-100 text-blue-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              running
                ? healing
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-blue-500 animate-ping'
                : 'bg-slate-400'
            }`}
          />
          <span>{running ? (healing ? 'Auto-Repairing' : 'Running Cycle') : 'Scheduled Idle'}</span>
        </span>
      </div>

      {/* Pipeline Stepper */}
      <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => {
          const done = running && i < active;
          const current = running && i === active;

          return (
            <div
              key={s.id}
              className={`relative flex flex-col justify-between rounded-xl border p-3 transition-all ${
                current
                  ? healing
                    ? 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-100'
                    : 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100'
                  : done
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-200/70 bg-slate-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold text-slate-400">0{i + 1}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full">
                  {done ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <IconCheck size={10} />
                    </span>
                  ) : current ? (
                    <span
                      className={`h-3 w-3 rounded-full ${
                        healing ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600 animate-ping'
                      }`}
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                  )}
                </span>
              </div>

              <div className="mt-3">
                <span
                  className={`block truncate text-xs font-bold ${
                    current || done ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  {s.label}
                </span>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{s.detail(progress)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-Healing Warning Banner */}
      {healing && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <IconSparkles className="shrink-0 text-amber-600" size={16} />
          <div>
            <strong className="font-semibold">AI Self-Healing Triggered:</strong> Data anomaly or
            DOM degradation detected. Scraper Studio is executing schema repair prompt before
            committing updates.
          </div>
        </div>
      )}
    </Card>
  );
}
