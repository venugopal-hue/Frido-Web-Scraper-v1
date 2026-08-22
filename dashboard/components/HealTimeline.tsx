'use client';

import { useState } from 'react';
import { HealEvent, timeAgo, parseCoverage } from '@/lib/api';
import Card from './Card';
import { IconSparkles, IconShieldCheck } from './Icons';

const STYLES: Record<HealEvent['status'], { dot: string; label: string; text: string; bg: string }> = {
  healed: {
    dot: 'bg-emerald-500',
    label: 'Healed',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200/60',
  },
  healing: {
    dot: 'bg-amber-500',
    label: 'Healing',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200/60',
  },
  awaiting_approval: {
    dot: 'bg-orange-500',
    label: 'Needs Approval',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200/60',
  },
  failed: {
    dot: 'bg-rose-500',
    label: 'Failed',
    text: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200/60',
  },
};

function CoverageDiff({ event }: { event: HealEvent }) {
  const before = parseCoverage(event.coverage_before);
  const after = parseCoverage(event.coverage_after);
  if (!before) return null;

  const fields = Object.keys(before).filter((k) => k !== 'total');
  const changed = after ? fields.filter((f) => before[f] !== after[f]) : [];

  return (
    <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/50">
        <span className="text-[11px] font-semibold text-slate-700">
          Field Coverage Fill-Rates {after ? '(Before → After)' : '(Initial)'}
        </span>
        {after && (
          <span className="text-[10px] text-slate-400 font-medium">
            {changed.length} field{changed.length === 1 ? '' : 's'} altered
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {fields.map((f) => {
          const b = before[f];
          const a = after?.[f];
          const moved = a !== undefined && a !== b;
          return (
            <span
              key={f}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] ${
                moved
                  ? 'border border-emerald-200 bg-emerald-50 font-bold text-emerald-800'
                  : 'border border-slate-200/60 bg-white text-slate-600'
              }`}
            >
              <span className="text-slate-500 font-medium">{f}:</span>
              <span>{b}%</span>
              {moved && <span className="text-emerald-700">→ {a}%</span>}
            </span>
          );
        })}
      </div>
      {after && changed.length === 0 && (
        <p className="mt-2 text-[11px] text-rose-600">
          Zero field coverage changes recorded — heal did not modify output schema.
        </p>
      )}
    </div>
  );
}

const COMPACT_COUNT = 3;

export default function HealTimeline({ events }: { events: HealEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, COMPACT_COUNT);

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconSparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              Self-Healing Audit Trail
            </h2>
            <p className="text-xs text-slate-500">
              Automated DOM repair and schema adaptation events executed via Bright Data Scraper Studio.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {events.length} Heal Events
        </span>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="my-4 rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <IconShieldCheck className="mx-auto text-emerald-500" size={24} />
          <p className="mt-2 text-xs font-semibold text-slate-700">All Selectors Healthy</p>
          <p className="mt-0.5 text-xs text-slate-400">
            No self-healing events have been required. The collector is running reliably on current DOM structures.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-4">
          {shown.map((e) => {
            const s = STYLES[e.status] ?? STYLES.failed;
            return (
              <li
                key={e.id}
                className="rounded-xl border border-slate-200/70 bg-slate-50/30 p-3.5 transition-all hover:bg-slate-50/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      <span>{s.label}</span>
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Trigger: {e.trigger}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    {e.items_after !== null && e.items_before !== null && (
                      <span className="text-slate-600 tabular-nums">
                        {e.items_before} → {e.items_after} rows
                      </span>
                    )}
                    <span>·</span>
                    <span>{timeAgo(e.created_at)}</span>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-800 break-words font-medium">
                  {e.detail ?? e.prompt}
                </p>

                {expanded && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-xs leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-900 block mb-1">
                        Repair Prompt Dispatched to AI:
                      </span>
                      {e.prompt}
                    </div>
                    <CoverageDiff event={e} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {events.length > COMPACT_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-2 text-center text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
        >
          {expanded ? 'Collapse to recent events' : `View all ${events.length} heal events & coverage diffs`}
        </button>
      )}
    </Card>
  );
}
