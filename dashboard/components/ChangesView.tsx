'use client';

import { Changes, Product, inr, timeAgo } from '@/lib/api';
import Card from './Card';

/**
 * What moved between the two most recent runs.
 *
 * The pipeline computes this on every run to decide what to push to Telegram,
 * but the result was previously discarded — the web side never showed it. This
 * is the same diff, rendered.
 */
export default function ChangesView({
  changes,
  products,
  onSelect,
}: {
  changes: Changes | null;
  products: Product[];
  onSelect: (p: Product) => void;
}) {
  const byUrl = new Map(products.map((p) => [p.product_url ?? '', p]));
  const open = (url?: string | null) => {
    const p = url ? byUrl.get(url) : null;
    if (p) onSelect(p);
  };

  if (!changes?.diff) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[14px] font-medium">Nothing to compare yet</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[--text-muted]">
          {changes?.reason ?? 'Two completed runs are needed before changes can be shown.'}
        </p>
      </Card>
    );
  }

  const { diff, from, to } = changes;
  const total =
    diff.priceChanges.length +
    diff.newItems.length +
    diff.backInStock.length +
    diff.wentOutOfStock.length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">What changed</h2>
        <span className="text-[12px] text-[--text-faint]">
          run #{from?.id} → #{to?.id} · {timeAgo(to?.finished_at ?? null)}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Compared against the previous completed run. This is exactly what the Telegram alerts are
        built from.
      </p>

      {total === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[--border] p-6 text-center">
          <p className="text-[13px] text-[--text-muted]">No changes between these two runs</p>
          <p className="mt-1 text-[12px] text-[--text-faint]">
            Every price, stock state and product was identical. Alerts stay silent when nothing
            moved rather than inventing something to report.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <Group
            title="Price changes"
            tone="text-[--text]"
            items={diff.priceChanges.map((c) => ({
              key: c.product_url,
              name: c.product_name,
              detail: (
                <>
                  <span className={c.direction === 'drop' ? 'text-emerald-700' : 'text-rose-600'}>
                    {c.direction === 'drop' ? '↓' : '↑'} {inr(c.from)} → {inr(c.to)}
                  </span>
                </>
              ),
              url: c.product_url,
            }))}
            onOpen={open}
          />
          <Group
            title="Back in stock"
            tone="text-emerald-700"
            items={diff.backInStock.map((p) => ({
              key: p.product_url ?? p.product_name,
              name: p.product_name,
              detail: inr(p.current_price),
              url: p.product_url,
            }))}
            onOpen={open}
          />
          <Group
            title="Just sold out"
            tone="text-rose-600"
            items={diff.wentOutOfStock.map((p) => ({
              key: p.product_url ?? p.product_name,
              name: p.product_name,
              detail: inr(p.current_price),
              url: p.product_url,
            }))}
            onOpen={open}
          />
          <Group
            title="New products"
            tone="text-[--text]"
            items={diff.newItems.map((p) => ({
              key: p.product_url ?? p.product_name,
              name: p.product_name,
              detail: inr(p.current_price),
              url: p.product_url,
            }))}
            onOpen={open}
          />
          {diff.removed.length > 0 && (
            <p className="text-[12px] text-[--text-faint]">
              {diff.removed.length} product{diff.removed.length === 1 ? '' : 's'} no longer listed.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Group({
  title,
  tone,
  items,
  onOpen,
}: {
  title: string;
  tone: string;
  items: { key: string; name: string; detail: React.ReactNode; url?: string | null }[];
  onOpen: (url?: string | null) => void;
}) {
  if (!items.length) return null;

  return (
    <div>
      <h3 className={`text-[13px] font-medium ${tone}`}>
        {title} <span className="text-[--text-faint]">({items.length})</span>
      </h3>
      <ul className="mt-1.5 divide-y divide-[--border] rounded-lg border border-[--border]">
        {items.slice(0, 10).map((i) => (
          <li key={i.key}>
            <button
              onClick={() => onOpen(i.url)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition hover:bg-neutral-50"
            >
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="shrink-0 tabular-nums">{i.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
