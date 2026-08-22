'use client';

import { useMemo, useState } from 'react';
import { Product, inr, isOutOfStock } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';
import { IconCompare, IconSearch, IconClose } from './Icons';

const MAX = 3;

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

  const lowestPrice = Math.min(...chosen.map((p) => p.current_price ?? Infinity));
  const biggestDiscount = Math.max(...chosen.map((p) => p.discount_percent ?? 0));
  const bestUnit = Math.min(
    ...chosen.map((p) => p.best_pack?.price_per_unit ?? p.current_price ?? Infinity)
  );

  return (
    <div className="space-y-6">
      {/* Search & Selection Card */}
      <Card className="p-5 border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconCompare size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                Product Matrix Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Select up to {MAX} items to compare specifications, price efficiency, and multi-pack savings.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {chosen.length} of {MAX} selected
          </span>
        </div>

        {/* Autocomplete Input */}
        <div className="relative mt-4 max-w-lg">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              picked.length >= MAX
                ? 'Maximum of 3 products reached — remove one to add another'
                : 'Search products to compare (e.g. "Gel Seat", "Orthopedic Pillow")…'
            }
            disabled={picked.length >= MAX}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />

          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-xs transition hover:bg-slate-50"
                  >
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-8 w-8 rounded-md border border-slate-100 object-contain p-0.5"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                      {p.product_name}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900 tabular-nums">
                      {inr(p.current_price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected Product Chips */}
        {chosen.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {chosen.map((p) => (
              <div
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-900"
              >
                <span className="max-w-[200px] truncate">{p.product_name}</span>
                <button
                  onClick={() => setPicked(picked.filter((id) => id !== p.id))}
                  className="rounded-full p-0.5 hover:bg-indigo-200 text-indigo-700"
                  aria-label={`Remove ${p.product_name}`}
                >
                  <IconClose size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Comparison Matrix Table or Empty State */}
      {chosen.length < 2 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-slate-200/80 bg-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <IconCompare size={22} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">
            Select 2 or 3 products to compare
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Search above to add items. Compare pricing, discount depth, stock status, and unit cost
            across different variations or competing products in the catalogue.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200/80 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75">
                  <th className="w-40 py-4 pl-5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Product Specification
                  </th>
                  {chosen.map((p) => (
                    <th key={p.id} className="p-4 text-left align-bottom">
                      <button
                        onClick={() => onSelect(p)}
                        className="group flex items-center gap-3 text-left focus:outline-hidden"
                      >
                        {p.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 shadow-xs transition group-hover:border-indigo-300"
                          />
                        )}
                        <span className="max-w-[180px] text-xs font-semibold leading-snug text-slate-900 group-hover:text-indigo-600">
                          {p.product_name}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <Row label="Category" cells={chosen.map((p) => p.category ?? '—')} />
                <Row
                  label="Selling Price"
                  cells={chosen.map((p) => inr(p.current_price))}
                  best={chosen.map((p) => (p.current_price ?? Infinity) === lowestPrice)}
                />
                <Row label="Original MRP" cells={chosen.map((p) => inr(p.original_price))} />
                <Row
                  label="Discount Depth"
                  cells={chosen.map((p) =>
                    p.discount_percent ? `${Math.round(p.discount_percent)}% off` : '—'
                  )}
                  best={chosen.map(
                    (p) => biggestDiscount > 0 && (p.discount_percent ?? 0) === biggestDiscount
                  )}
                />
                <Row
                  label="Best Unit Value"
                  cells={chosen.map((p) =>
                    p.best_pack
                      ? `${inr(p.best_pack.price_per_unit)}/ea (${p.best_pack.label})`
                      : inr(p.current_price)
                  )}
                  best={chosen.map(
                    (p) => (p.best_pack?.price_per_unit ?? p.current_price ?? Infinity) === bestUnit
                  )}
                />
                <Row
                  label="Stock Status"
                  cells={chosen.map((p) => (isOutOfStock(p.availability) ? 'Sold out' : 'In stock'))}
                  tone={chosen.map((p) => (isOutOfStock(p.availability) ? 'bad' : 'good'))}
                />
                <Row
                  label="Price Movement"
                  cells={chosen.map((p) => {
                    const s = p.product_url ? series[p.product_url] : undefined;
                    return s ? <Sparkline values={s} /> : <span className="text-slate-400">Stable</span>;
                  })}
                />
              </tbody>
            </table>
          </div>
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
    <tr className="transition-colors hover:bg-slate-50/50">
      <td className="py-3 pl-5 pr-4 font-semibold text-slate-500">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="p-4 tabular-nums">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${
                best?.[i]
                  ? 'font-bold text-emerald-700'
                  : tone?.[i] === 'bad'
                    ? 'font-medium text-rose-600'
                    : 'font-medium text-slate-800'
              }`}
            >
              {c}
            </span>
            {best?.[i] && (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Best
              </span>
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}
