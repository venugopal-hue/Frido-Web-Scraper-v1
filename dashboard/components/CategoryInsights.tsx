'use client';

import { useMemo } from 'react';
import { Product, inr, isOutOfStock } from '@/lib/api';
import Card from './Card';

/**
 * Where the discounts actually concentrate.
 *
 * Sorted by average discount rather than product count — the question this
 * answers is "which aisle is worth walking down", not "which is biggest".
 * Categories with fewer than 3 products are dropped: a single 70%-off item
 * would otherwise top the table on a sample size of one.
 */
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
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Where the discounts are</h2>
        <span className="text-[12px] text-[--text-faint]">{rows.length} categories</span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">
        Average discount by category. Categories with fewer than {MIN_PRODUCTS} products are
        excluded — one heavily discounted item would otherwise top the list on its own.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="border-b border-[--border] text-left text-[12px] text-[--text-faint]">
              <th className="pb-2 font-normal">Category</th>
              <th className="pb-2 font-normal">Avg discount</th>
              <th className="pb-2 text-right font-normal">Items</th>
              <th className="pb-2 text-right font-normal">From</th>
              <th className="pb-2 text-right font-normal">Sold out</th>
              <th className="pb-2 text-right font-normal">Below MRP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--border]">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${(r.avgDiscount / max) * 100}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{r.avgDiscount}%</span>
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.count}</td>
                <td className="py-2.5 text-right tabular-nums">{inr(r.cheapest)}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {r.outOfStock > 0 ? (
                    <span className="text-rose-600">{r.outOfStock}</span>
                  ) : (
                    <span className="text-[--text-faint]">—</span>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums">{inr(r.saved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
