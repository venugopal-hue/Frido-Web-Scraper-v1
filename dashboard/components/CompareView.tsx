'use client';

import { useMemo, useState } from 'react';
import { Product, inr, isOutOfStock } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';

const MAX = 3;

/**
 * Side-by-side comparison of products from the same catalogue.
 *
 * The source design compared one product across several retailers; only one
 * store is scraped here, so this compares products against each other instead
 * — which is the question that actually applies when every item is Frido's.
 *
 * Best value per row is highlighted rather than scored, because a single
 * "winner" would have to weight price against discount against stock, and any
 * such weighting would be invented.
 */
export default function CompareView({
  products,
  series = {},
  onSelect,
}: {
  products: Product[];
  series?: Record<string, number[]>;
  onSelect: (p: Product) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');

  const chosen = useMemo(
    () => picked.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p),
    [picked, products]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.product_name.toLowerCase().includes(q) && !picked.includes(p.id))
      .slice(0, 6);
  }, [query, products, picked]);

  const add = (id: number) => {
    if (picked.length >= MAX) return;
    setPicked([...picked, id]);
    setQuery('');
  };

  // Best-in-row markers. Undefined when nothing qualifies.
  const lowestPrice = Math.min(...chosen.map((p) => p.current_price ?? Infinity));
  const biggestDiscount = Math.max(...chosen.map((p) => p.discount_percent ?? 0));
  const bestUnit = Math.min(
    ...chosen.map((p) => p.best_pack?.price_per_unit ?? p.current_price ?? Infinity)
  );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Compare products</h2>
        <p className="mt-1 text-[13px] text-[--text-muted]">
          Pick up to {MAX} items to line up their prices, discounts and pack options.
        </p>

        <div className="relative mt-4 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={picked.length >= MAX ? `Remove one to add another` : 'Search a product…'}
            disabled={picked.length >= MAX}
            className="w-full rounded-lg border border-[--border] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-[--text-faint]"
          />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[--border] bg-white shadow-lg">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-neutral-50"
                  >
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-7 w-7 rounded object-contain" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{p.product_name}</span>
                    <span className="shrink-0 tabular-nums text-[--text-faint]">
                      {inr(p.current_price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {chosen.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chosen.map((p) => (
              <button
                key={p.id}
                onClick={() => setPicked(picked.filter((id) => id !== p.id))}
                className="inline-flex items-center gap-1.5 rounded-full border border-[--border] bg-white px-3 py-1 text-[12px] transition hover:border-rose-300 hover:text-rose-600"
              >
                <span className="max-w-[220px] truncate">{p.product_name}</span>
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {chosen.length < 2 ? (
        <Card className="p-10 text-center">
          <p className="text-[15px] font-medium">Pick at least two products</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[--text-muted]">
            Search above to add them. Useful for deciding between two cushions, or checking whether
            the pricier pillow is actually better value per unit.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-5">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr>
                <th className="w-32" />
                {chosen.map((p) => (
                  <th key={p.id} className="p-2 text-left align-bottom">
                    <button onClick={() => onSelect(p)} className="group block text-left">
                      {p.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt=""
                          className="mb-2 h-20 w-20 rounded border border-[--border] bg-white object-contain"
                        />
                      )}
                      <span className="block max-w-[180px] text-[13px] font-medium leading-snug group-hover:underline">
                        {p.product_name}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border]">
              <Row label="Category" cells={chosen.map((p) => p.category ?? '—')} />
              <Row
                label="Price"
                cells={chosen.map((p) => inr(p.current_price))}
                best={chosen.map((p) => (p.current_price ?? Infinity) === lowestPrice)}
              />
              <Row label="MRP" cells={chosen.map((p) => inr(p.original_price))} />
              <Row
                label="Discount"
                cells={chosen.map((p) =>
                  p.discount_percent ? `${Math.round(p.discount_percent)}%` : '—'
                )}
                best={chosen.map(
                  (p) => biggestDiscount > 0 && (p.discount_percent ?? 0) === biggestDiscount
                )}
              />
              <Row
                label="Best per unit"
                cells={chosen.map((p) =>
                  p.best_pack
                    ? `${inr(p.best_pack.price_per_unit)} · ${p.best_pack.label}`
                    : inr(p.current_price)
                )}
                best={chosen.map(
                  (p) => (p.best_pack?.price_per_unit ?? p.current_price ?? Infinity) === bestUnit
                )}
              />
              <Row
                label="Stock"
                cells={chosen.map((p) => (isOutOfStock(p.availability) ? 'Sold out' : 'In stock'))}
                tone={chosen.map((p) => (isOutOfStock(p.availability) ? 'bad' : 'good'))}
              />
              <Row
                label="Price history"
                cells={chosen.map((p) => {
                  const s = p.product_url ? series[p.product_url] : undefined;
                  return s ? <Sparkline values={s} /> : 'no movement yet';
                })}
              />
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  cells,
  best,
  tone,
}: {
  label: string;
  cells: React.ReactNode[];
  best?: boolean[];
  tone?: ('good' | 'bad')[];
}) {
  return (
    <tr>
      <td className="py-2.5 pr-3 text-[12px] text-[--text-faint]">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={[
            'p-2 tabular-nums',
            best?.[i] ? 'font-semibold text-emerald-700' : '',
            tone?.[i] === 'bad' ? 'text-rose-600' : '',
          ].join(' ')}
        >
          {c}
          {best?.[i] && <span className="ml-1.5 text-[10px] font-normal uppercase">best</span>}
        </td>
      ))}
    </tr>
  );
}
