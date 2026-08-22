'use client';

import { Product, isOutOfStock } from '@/lib/api';
import Card from './Card';
import ProductCard from './ProductCard';

/**
 * The deals worth acting on, grouped by *why* they are a deal.
 *
 * A headline discount is measured against MRP, which barely moves. The two
 * groups above it — a cheaper per-unit pack, or a price below its own recent
 * average — are things the storefront cannot tell you, so they come first.
 *
 * Renders the same tiles as the Products view rather than a condensed list;
 * the same data shown two different ways just makes the page feel inconsistent.
 */
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
        title="Cheaper per unit in a multi-pack"
        hint="The listed price is the worst price for these — the store only reveals the pack price on the product page."
        empty="No multi-pack savings found. Run npm run scrape-packs to refresh."
        items={packWins}
        series={series}
        onSelect={onSelect}
      />

      <Section
        title="Below their usual price"
        hint="Measured against what each product has actually sold for recently, not against MRP."
        empty="No price movement recorded yet — this fills in once prices change between runs."
        items={belowUsual}
        series={series}
        onSelect={onSelect}
      />

      <Section
        title="Steepest discounts"
        hint="Against MRP, which is the number the store advertises."
        empty="Nothing at 50% or more right now."
        items={steepest}
        series={series}
        onSelect={onSelect}
        limit={12}
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
}: {
  title: string;
  hint: string;
  empty: string;
  items: Product[];
  series: Record<string, number[]>;
  onSelect: (p: Product) => void;
  limit?: number;
}) {
  const shown = items.slice(0, limit);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="text-[12px] text-[--text-faint]">
          {shown.length < items.length ? `${shown.length} of ${items.length}` : items.length}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-[--text-muted]">{hint}</p>

      {items.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-[13px] text-[--text-faint]">{empty}</Card>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p, i) => (
            <ProductCard key={p.id} product={p} series={series} index={i} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}
