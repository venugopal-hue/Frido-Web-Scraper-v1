'use client';

import { Product, inr, isOutOfStock } from '@/lib/api';
import Card from './Card';
import {
  IconProducts,
  IconTag,
  IconTrendingDown,
  IconAlertTriangle,
} from './Icons';

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
    {
      label: 'Tracked Inventory',
      value: String(tracked),
      hint: `${categories} active categories`,
      icon: IconProducts,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      badge: 'Catalog',
      badgeColor: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Average Discount',
      value: `${avgDiscount}%`,
      hint: 'across all items',
      icon: IconTag,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      badge: 'Savings',
      badgeColor: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Catalogue Savings',
      value: inr(saved),
      hint: 'total discount vs MRP',
      icon: IconTrendingDown,
      iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
      badge: 'Value',
      badgeColor: 'bg-sky-50 text-sky-700',
    },
    {
      label: 'Out of Stock',
      value: String(outOfStock),
      hint: tracked ? `${Math.round((outOfStock / tracked) * 100)}% of catalogue` : '—',
      icon: IconAlertTriangle,
      iconBg: outOfStock > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100',
      badge: outOfStock > 0 ? 'Stock Alert' : 'Healthy',
      badgeColor: outOfStock > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card
            key={s.label}
            className="group relative overflow-hidden p-5 transition-all hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${s.iconBg}`}
              >
                <Icon size={18} />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badgeColor}`}
              >
                {s.badge}
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-slate-500">{s.label}</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {s.value}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{s.hint}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
