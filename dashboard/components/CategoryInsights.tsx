'use client';

import { useMemo } from 'react';
import { Product, inr, isOutOfStock } from '@/lib/api';
import Card from './Card';
import { IconTag } from './Icons';

const MIN_PRODUCTS = 3;

export default function CategoryInsights({ products }: { products: Product[] }) {
  const rows = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const c = p.category ?? 'Uncategorised';
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(p);
    }

    return [...groups.entries()]
      .filter(([, items]) => items.length >= MIN_PRODUCTS)
      .map(([name, items]) => {
        const discounts = items.map((p) => p.discount_percent ?? 0);
        const prices = items.map((p) => p.current_price).filter((n): n is number => n !== null);
        const saved = items.reduce(
          (s, p) =>
            p.original_price && p.current_price ? s + (p.original_price - p.current_price) : s,
          0
        );
        return {
          name,
          count: items.length,
          avgDiscount: Math.round(discounts.reduce((a, b) => a + b, 0) / items.length),
          cheapest: prices.length ? Math.min(...prices) : null,
          outOfStock: items.filter((p) => isOutOfStock(p.availability)).length,
          saved,
        };
      })
      .sort((a, b) => b.avgDiscount - a.avgDiscount);
  }, [products]);

  if (!rows.length) return null;

  const max = Math.max(...rows.map((r) => r.avgDiscount), 1);

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white">
      {/* Header section */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconTag size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                Category Discount Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Average discount concentration across active categories with {MIN_PRODUCTS}+ items.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {rows.length} Categories
          </span>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-4">Category</th>
              <th className="py-3 px-4">Average Discount</th>
              <th className="py-3 px-4 text-right">Items</th>
              <th className="py-3 px-4 text-right">Starting At</th>
              <th className="py-3 px-4 text-right">Sold Out</th>
              <th className="py-3 pl-4 pr-5 text-right">Catalogue Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.name} className="transition-colors hover:bg-slate-50/60">
                <td className="py-3.5 pl-5 pr-4 font-semibold text-slate-800">
                  {r.name}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${(r.avgDiscount / max) * 100}%` }}
                      />
                    </div>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {r.avgDiscount}%
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right font-medium text-slate-600 tabular-nums">
                  {r.count}
                </td>
                <td className="py-3.5 px-4 text-right font-medium text-slate-800 tabular-nums">
                  {inr(r.cheapest)}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums">
                  {r.outOfStock > 0 ? (
                    <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                      {r.outOfStock} out
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">—</span>
                  )}
                </td>
                <td className="py-3.5 pl-4 pr-5 text-right font-semibold text-emerald-700 tabular-nums">
                  {inr(r.saved)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
