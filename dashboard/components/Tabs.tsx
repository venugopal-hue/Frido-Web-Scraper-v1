'use client';

export type ViewId = 'overview' | 'products' | 'deals' | 'compare' | 'watchlist' | 'health';

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'products', label: 'Products', icon: '▦' },
  { id: 'deals', label: 'Deals', icon: '◈' },
  { id: 'compare', label: 'Compare', icon: '⇄' },
  { id: 'watchlist', label: 'Watchlist', icon: '☆' },
  { id: 'health', label: 'Health', icon: '◉' },
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
      className="flex gap-1 overflow-x-auto border-b border-[--border]"
      aria-label="Dashboard sections"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        const n = counts[t.id];
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              // -1px bottom margin so the active underline sits on the border
              // rather than beneath it.
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] transition',
              isActive
                ? 'border-neutral-900 font-medium text-[--text]'
                : 'border-transparent text-[--text-muted] hover:border-[--border-strong] hover:text-[--text]',
            ].join(' ')}
          >
            <span aria-hidden className="text-[--text-faint]">
              {t.icon}
            </span>
            {t.label}
            {typeof n === 'number' && n > 0 && (
              <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] tabular-nums text-[--text-faint]">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
