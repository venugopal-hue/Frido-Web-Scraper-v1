'use client';

import { motion } from 'framer-motion';
import { Product, inr, isOutOfStock, DEAL_LABELS } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';

/**
 * One product tile. Shared by the Products grid and the Deals view so the two
 * cannot drift apart — they previously rendered the same data two ways.
 *
 * `index` only drives the entry stagger.
 */
export default function ProductCard({
  product: p,
  series = {},
  index = 0,
  onSelect,
}: {
  product: Product;
  series?: Record<string, number[]>;
  index?: number;
  onSelect: (p: Product) => void;
}) {
  const out = isOutOfStock(p.availability);
  const spark = p.product_url ? series[p.product_url] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      /* Stagger only across the first screenful — running it over 146 cards
         would make the last one appear seconds late. */
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03, ease: 'easeOut' }}
      className="flex"
    >
      <Card interactive className="flex w-full flex-col overflow-hidden">
        <button
          onClick={() => onSelect(p)}
          className="flex flex-1 flex-col text-left"
          title="View price history"
        >
          {/* White surface, object-contain, no scaling: the product photo is
              shown exactly as the store serves it. */}
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

            {p.discount_percent && p.discount_percent >= 25 ? (
              <span className="absolute right-2 top-2 rounded-md bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                -{Math.round(p.discount_percent)}%
              </span>
            ) : null}

            {out && (
              <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-rose-600 ring-1 ring-rose-200">
                Sold out
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            {p.category && <span className="text-[11px] text-[--text-faint]">{p.category}</span>}
            <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">
              {p.product_name}
            </h3>

            <div className="mt-auto pt-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[17px] font-semibold tracking-tight">
                  {inr(p.current_price)}
                </span>
                {spark && (
                  <span className="ml-auto self-center">
                    <Sparkline values={spark} />
                  </span>
                )}
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

              {/* Price context beats the MRP badge: a 60% discount means nothing
                  if the item never sells for less. */}
              {p.deal && p.deal.verdict !== 'unknown' && p.deal.verdict !== 'typical' && (
                <p
                  className={`mt-1.5 text-[11px] font-medium ${
                    p.deal.verdict === 'above_average' ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {DEAL_LABELS[p.deal.verdict]}
                  {p.deal.verdict === 'above_average' && ` · ${p.deal.vs_avg_percent}% over usual`}
                </p>
              )}

              {p.best_pack && (
                <p className="mt-1.5 rounded border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-800">
                  📦 {p.best_pack.label}: {inr(p.best_pack.price_per_unit)}/unit —{' '}
                  <span className="font-semibold">{p.best_pack.unit_saving_percent}% less</span>
                </p>
              )}
            </div>
          </div>
        </button>

        {/* Two explicit actions. The card body is clickable too, but an
            invisible affordance is not an affordance. */}
        <div className="grid grid-cols-2 border-t border-[--border] text-[12px]">
          <button
            onClick={() => onSelect(p)}
            className="flex items-center justify-center gap-1.5 border-r border-[--border] py-2.5 text-[--text-muted] transition hover:bg-neutral-50 hover:text-[--text]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 17l5-6 4 3 5-7 4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Price history
          </button>
          <a
            href={p.product_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center py-2.5 text-[--text-muted] transition hover:bg-neutral-50 hover:text-[--text]"
          >
            View on store ↗
          </a>
        </div>
      </Card>
    </motion.div>
  );
}
