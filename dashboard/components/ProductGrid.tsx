'use client';

import { useMemo, useState } from 'react';
import { Product, isOutOfStock } from '@/lib/api';
import Card from './Card';
import ProductCard from './ProductCard';

type Sort = 'discount' | 'price-asc' | 'price-desc' | 'name';

export default function ProductGrid({
  products,
  loading,
  series = {},
  onSelect,
}: {
  products: Product[];
  loading: boolean;
  /** Price series keyed by product_url — only products whose price moved. */
  series?: Record<string, number[]>;
  onSelect: (p: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<Sort>('discount');
  const [inStockOnly, setInStockOnly] = useState(false);

  /**
   * Chips ordered by how many products they hold, biggest first.
   * Alphabetical put one-item oddities ("Back Pain", "Frido Covers") ahead of
   * the categories people actually browse, and pushed Cushions (32) to the
   * second row.
   */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const c = p.category ?? 'Uncategorised';
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const ordered = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n]) => ({ name, n }));
    return [{ name: 'All', n: products.length }, ...ordered];
  }, [products]);

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
        <div className="relative w-full sm:w-[280px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--text-faint]"
            width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className={`${inputClass} w-full pl-9 pr-8`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-[--text-faint] hover:text-[--text]"
            >
              ×
            </button>
          )}
        </div>
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
        <span className="ml-auto text-[13px] text-[--text-muted]">
          <span className="font-medium text-[--text]">{visible.length}</span>
          {visible.length !== products.length && ` of ${products.length}`} products
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map(({ name, n }) => {
          const active = name === category;
          return (
            <button
              key={name}
              onClick={() => setCategory(name)}
              aria-pressed={active}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition',
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-[--border] bg-white text-[--text-muted] hover:border-neutral-400 hover:text-[--text]',
              ].join(' ')}
            >
              {name}
              <span
                className={[
                  'rounded-full px-1.5 text-[11px] tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-[--text-faint]',
                ].join(' ')}
              >
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
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} series={series} index={i} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}
