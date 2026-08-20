'use client';

import { HealEvent, timeAgo, parseCoverage } from '@/lib/api';
import Card from './Card';

const STYLES: Record<HealEvent['status'], { dot: string; label: string; text: string }> = {
  healed: { dot: 'bg-emerald-500', label: 'Healed', text: 'text-emerald-700' },
  healing: { dot: 'bg-amber-500', label: 'Healing', text: 'text-amber-700' },
  awaiting_approval: { dot: 'bg-orange-500', label: 'Awaiting approval', text: 'text-orange-700' },
  failed: { dot: 'bg-rose-500', label: 'Failed', text: 'text-rose-700' },
};

/**
 * Field fill-rates either side of a heal.
 *
 * This is the part that makes a heal auditable: the CLI can report success
 * while the collector's real output is unchanged, and only a before/after
 * measurement shows the difference between "reported healed" and "healed".
 */
function CoverageDiff({ event }: { event: HealEvent }) {
  const before = parseCoverage(event.coverage_before);
  const after = parseCoverage(event.coverage_after);
  if (!before) return null;

  const fields = Object.keys(before).filter((k) => k !== 'total');
  const changed = after ? fields.filter((f) => before[f] !== after[f]) : [];

  return (
    <div className="mt-2 rounded-lg border border-[--border] bg-neutral-50 p-2.5">
      <p className="text-[11px] font-medium text-[--text-muted]">
        Field coverage {after ? '(before → after)' : '(before heal)'}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {fields.map((f) => {
          const b = before[f];
          const a = after?.[f];
          const moved = a !== undefined && a !== b;
          return (
            <span key={f} className="font-mono">
              <span className="text-[--text-faint]">{f}</span>{' '}
              <span className={moved ? 'font-semibold text-emerald-700' : ''}>
                {b}%{a !== undefined && a !== b ? ` → ${a}%` : ''}
              </span>
            </span>
          );
        })}
      </div>
      {after && changed.length === 0 && (
        <p className="mt-1.5 text-[11px] text-rose-600">
          No field coverage changed — the heal did not alter the output.
        </p>
      )}
    </div>
  );
}

export default function HealTimeline({ events }: { events: HealEvent[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Self-healing timeline</h2>
        <span className="text-[12px] text-[--text-faint]">{events.length} events</span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Every <code className="font-mono text-[12px]">bdata scraper heal</code> run against this
        collector.
      </p>

      {events.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-[--border] p-6 text-center text-[13px] text-[--text-faint]">
          No heal events recorded yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-4">
          {events.map((e) => {
            const s = STYLES[e.status] ?? STYLES.failed;
            return (
              <li key={e.id} className="border-t border-[--border] pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span className={`font-medium ${s.text}`}>{s.label}</span>
                  <span className="text-[--text-faint]">·</span>
                  <span className="text-[--text-muted]">{e.trigger}</span>
                  <span className="text-[--text-faint]">·</span>
                  <span className="text-[--text-faint]">{timeAgo(e.created_at)}</span>
                  {e.items_after !== null && e.items_before !== null && (
                    <span className="text-[--text-muted]">
                      {e.items_before} → {e.items_after} rows
                    </span>
                  )}
                </div>

                {/* break-words: raw CLI output can arrive as one long token. */}
                <p className="mt-1.5 line-clamp-2 break-words text-[13px] leading-relaxed text-[--text-muted]">
                  {e.prompt}
                </p>

                <CoverageDiff event={e} />
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
