'use client';

import { Product, isOutOfStock } from '@/lib/api';
import Card from './Card';
import ProductCard from './ProductCard';
import { IconPackage, IconTrendingDown, IconTag } from './Icons';

export default function DealRadar({
  products,
  series = {},
  onSelect,
}: {
  products: Product[];
  series?: Record<string, number[]>;
  onSelect: (p: Product) => void;
}) {
  const inStock = products.filter((p) => !isOutOfStock(p.availability));

  const packWins = inStock
    .filter((p) => p.best_pack)
    .sort(
      (a, b) => (b.best_pack!.unit_saving_percent ?? 0) - (a.best_pack!.unit_saving_percent ?? 0)
    );

  const belowUsual = inStock
    .filter((p) => p.deal && ['lowest', 'near_lowest', 'below_average'].includes(p.deal.verdict))
    .sort((a, b) => (a.deal!.vs_avg_percent ?? 0) - (b.deal!.vs_avg_percent ?? 0));

  const steepest = inStock
    .filter((p) => (p.discount_percent ?? 0) >= 50)
    .sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0));

  return (
    <div className="space-y-10">
      <Section
        title="Multi-Pack Unit Value Wins"
        hint="Items where multi-pack bundles significantly lower the per-unit price compared to buying singles."
        empty="No multi-pack variations discovered yet."
        items={packWins}
        series={series}
        onSelect={onSelect}
        icon={IconPackage}
        badgeColor="bg-indigo-50 text-indigo-700"
      />

      <Section
        title="Below Historical Average"
        hint="Prices currently trading below their long-term recorded moving average on Frido."
        empty="No historical price drops detected yet — this fills as price updates occur across runs."
        items={belowUsual}
        series={series}
        onSelect={onSelect}
        icon={IconTrendingDown}
        badgeColor="bg-emerald-50 text-emerald-700"
      />

      <Section
        title="Steepest Storefront Discounts"
        hint="Catalogue items with 50% or higher discount against official MRP."
        empty="No items currently at 50% or more discount."
        items={steepest}
        series={series}
        onSelect={onSelect}
        limit={12}
        icon={IconTag}
        badgeColor="bg-sky-50 text-sky-700"
      />
    </div>
  );
}

function Section({
  title,
  hint,
  empty,
  items,
  series,
  onSelect,
  limit = 8,
  icon: Icon,
  badgeColor,
}: {
  title: string;
  hint: string;
  empty: string;
  items: Product[];
  series: Record<string, number[]>;
  onSelect: (p: Product) => void;
  limit?: number;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeColor: string;
}) {
  const shown = items.slice(0, limit);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
            <p className="text-xs text-slate-500">{hint}</p>
          </div>
        </div>

        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}>
          {shown.length < items.length ? `${shown.length} of ${items.length}` : items.length} Deals
        </span>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-xs text-slate-400 border-dashed">
          {empty}
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p, i) => (
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
