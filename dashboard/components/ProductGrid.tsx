'use client';

import { useMemo, useState } from 'react';
import { Product, isOutOfStock } from '@/lib/api';
import Card from './Card';
import ProductCard from './ProductCard';
import { IconSearch, IconClose } from './Icons';

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

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-[340px] rounded-xl border border-slate-200/60" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Control Bar: Search, Sort, Filter Toggle & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by title or keyword…"
              aria-label="Search products"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <IconClose size={13} />
              </button>
            )}
          </div>

          {/* Sorting Select */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort products"
            className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          >
            <option value="discount">Biggest discount</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name: A to Z</option>
          </select>

          {/* In stock only toggle */}
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>In stock only</span>
          </label>
        </div>

        {/* Counter */}
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800 tabular-nums">{visible.length}</span>
          {visible.length !== products.length && ` of ${products.length}`} items
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map(({ name, n }) => {
          const active = name === category;
          return (
            <button
              key={name}
              onClick={() => setCategory(name)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{name}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Product Grid or Empty State */}
      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <IconSearch size={22} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">No matching products</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            We could not find any products matching your current search or filter criteria. Try
            resetting the category or searching for another term.
          </p>
          <button
            onClick={() => {
              setQuery('');
              setCategory('All');
              setInStockOnly(false);
            }}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
          >
            Reset all filters
          </button>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              series={series}
              index={i}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
