'use client';

import { Product, inr, isOutOfStock } from '@/lib/api';

/**
 * Four plain figures on a hairline-separated row. No cards, no colour — at this
 * size the numbers are the design.
 */
export default function StatsRow({ products }: { products: Product[] }) {
  const tracked = products.length;
  const categories = new Set(products.map((p) => p.category ?? 'Uncategorised')).size;
  const outOfStock = products.filter((p) => isOutOfStock(p.availability)).length;

  const discounts = products.map((p) => p.discount_percent ?? 0);
  const avgDiscount = discounts.length
    ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
    : 0;

  const saved = products.reduce(
    (sum, p) =>
      p.original_price && p.current_price ? sum + (p.original_price - p.current_price) : sum,
    0
  );

  const stats = [
    { label: 'Products', value: String(tracked), hint: `${categories} categories` },
    { label: 'Avg discount', value: `${avgDiscount}%`, hint: 'across catalogue' },
    { label: 'Total savings', value: inr(saved), hint: 'vs MRP' },
    {
      label: 'Out of stock',
      value: String(outOfStock),
      hint: tracked ? `${Math.round((outOfStock / tracked) * 100)}% of items` : '—',
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[--border] bg-[--border] sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-[--surface] px-5 py-4">
          <dt className="text-[12px] text-[--text-faint]">{s.label}</dt>
          <dd className="mt-1 text-[22px] font-semibold leading-none tracking-tight">{s.value}</dd>
          <dd className="mt-1.5 text-[12px] text-[--text-muted]">{s.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
