'use client';

import { useMemo, useState } from 'react';
import { Product, inr, isOutOfStock, DEAL_LABELS } from '@/lib/api';
import Card from './Card';

type Sort = 'discount' | 'price-asc' | 'price-desc' | 'name';

export default function ProductGrid({
  products,
  loading,
  onSelect,
}: {
  products: Product[];
  loading: boolean;
  onSelect: (p: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<Sort>('discount');
  const [inStockOnly, setInStockOnly] = useState(false);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category ?? 'Uncategorised'))).sort()],
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (category !== 'All' && (p.category ?? 'Uncategorised') !== category) return false;
      if (inStockOnly && isOutOfStock(p.availability)) return false;
      if (q && !p.product_name.toLowerCase().includes(q)) return false;
      return true;
    });

    const sorters: Record<Sort, (a: Product, b: Product) => number> = {
      discount: (a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0),
      'price-asc': (a, b) => (a.current_price ?? Infinity) - (b.current_price ?? Infinity),
      'price-desc': (a, b) => (b.current_price ?? -Infinity) - (a.current_price ?? -Infinity),
      name: (a, b) => a.product_name.localeCompare(b.product_name),
    };
    return [...filtered].sort(sorters[sort]);
  }, [products, query, category, sort, inStockOnly]);

  const inputClass =
    'rounded-lg border border-[--border] bg-white px-3 py-2 text-[13px] outline-none ' +
    'transition focus:border-neutral-400';

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-[320px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          className={`${inputClass} min-w-[200px] flex-1`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort products"
          className={inputClass}
        >
          <option value="discount">Biggest discount</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-[--text-muted]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-neutral-900"
          />
          In stock only
        </label>
        <span className="text-[13px] text-[--text-faint]">{visible.length} shown</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = c === category;
          const n =
            c === 'All'
              ? products.length
              : products.filter((p) => (p.category ?? 'Uncategorised') === c).length;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className={[
                'rounded-full border px-3 py-1 text-[12px] transition',
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-[--border] bg-white text-[--text-muted] hover:border-neutral-400',
              ].join(' ')}
            >
              {c}
              <span className={active ? 'ml-1.5 text-white/60' : 'ml-1.5 text-[--text-faint]'}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <Card className="p-12 text-center text-[13px] text-[--text-muted]">
          No products match these filters.
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const out = isOutOfStock(p.availability);
            return (
              <Card key={p.id} interactive className="flex flex-col overflow-hidden">
                <button
                  onClick={() => onSelect(p)}
                  className="flex flex-1 flex-col text-left"
                  title="View price history"
                >
                  {/* White surface, object-contain, no scaling on hover: the
                      product photo is shown exactly as the store serves it. */}
                  <div className="relative aspect-square w-full border-b border-[--border] bg-white">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.product_name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[12px] text-[--text-faint]">
                        No image
                      </div>
                    )}
                    {out && (
                      <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-rose-600 ring-1 ring-rose-200">
                        Sold out
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    {p.category && (
                      <span className="text-[11px] text-[--text-faint]">{p.category}</span>
                    )}
                    <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">
                      {p.product_name}
                    </h3>

                    <div className="mt-auto pt-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[17px] font-semibold tracking-tight">
                          {inr(p.current_price)}
                        </span>
                        {p.original_price && p.original_price !== p.current_price && (
                          <span className="text-[13px] text-[--text-faint] line-through">
                            {inr(p.original_price)}
                          </span>
                        )}
                        {p.discount_percent ? (
                          <span className="text-[12px] font-medium text-emerald-700">
                            {Math.round(p.discount_percent)}% off
                          </span>
                        ) : null}
                      </div>

                      {/* Price context beats the MRP badge: a 60% discount means
                          nothing if the item never sells for less. */}
                      {p.deal && p.deal.verdict !== 'unknown' && p.deal.verdict !== 'typical' && (
                        <p
                          className={`mt-1.5 text-[11px] font-medium ${
                            p.deal.verdict === 'above_average'
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {DEAL_LABELS[p.deal.verdict]}
                          {p.deal.verdict === 'above_average' &&
                            ` · ${p.deal.vs_avg_percent}% over usual`}
                        </p>
                      )}

                      {p.best_pack && (
                        <p className="mt-1.5 rounded border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-800">
                          📦 {p.best_pack.label}: {inr(p.best_pack.price_per_unit)}/unit —{' '}
                          <span className="font-semibold">
                            {p.best_pack.unit_saving_percent}% less
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {p.product_url && (
                  <a
                    href={p.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-t border-[--border] px-4 py-2.5 text-center text-[12px] text-[--text-muted] transition hover:bg-neutral-50 hover:text-[--text]"
                  >
                    View on store
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
