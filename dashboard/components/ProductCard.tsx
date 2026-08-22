'use client';

import { motion } from 'framer-motion';
import { Product, inr, isOutOfStock, DEAL_LABELS } from '@/lib/api';
import Card from './Card';
import Sparkline from './Sparkline';
import { IconChart, IconExternalLink, IconPackage } from './Icons';

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.025, ease: 'easeOut' }}
      className="flex h-full"
    >
      <Card
        hoverable
        className="group flex w-full flex-col overflow-hidden border-slate-200/80 bg-white"
      >
        <button
          onClick={() => onSelect(p)}
          className="flex flex-1 flex-col text-left focus:outline-hidden"
          title="Click to view price history and pack pricing"
        >
          {/* Image Container with White Background */}
          <div className="relative aspect-4/3 w-full overflow-hidden border-b border-slate-100 bg-white p-4">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.product_name}
                loading="lazy"
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No image available
              </div>
            )}

            {/* Discount Badge */}
            {p.discount_percent && p.discount_percent >= 20 ? (
              <span className="absolute right-2.5 top-2.5 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                -{Math.round(p.discount_percent)}%
              </span>
            ) : null}

            {/* Stock Status Badge */}
            {out && (
              <span className="absolute left-2.5 top-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-rose-600 shadow-xs ring-1 ring-rose-200">
                Sold out
              </span>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-1 flex-col p-4">
            {/* Category */}
            {p.category && (
              <span className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">
                {p.category}
              </span>
            )}

            {/* Name */}
            <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800 group-hover:text-indigo-600 transition-colors">
              {p.product_name}
            </h3>

            {/* Pricing Section */}
            <div className="mt-auto pt-3">
              <div className="flex items-baseline justify-between gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                    {inr(p.current_price)}
                  </span>
                  {p.original_price && p.original_price !== p.current_price && (
                    <span className="text-xs text-slate-400 line-through tabular-nums">
                      {inr(p.original_price)}
                    </span>
                  )}
                </div>

                {spark && (
                  <div className="shrink-0">
                    <Sparkline values={spark} />
                  </div>
                )}
              </div>

              {/* Deal Verdict Callout */}
              {p.deal && p.deal.verdict !== 'unknown' && p.deal.verdict !== 'typical' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      p.deal.verdict === 'above_average'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        p.deal.verdict === 'above_average' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />
                    {DEAL_LABELS[p.deal.verdict]}
                    {p.deal.verdict === 'above_average' && ` (${p.deal.vs_avg_percent}% over usual)`}
                  </span>
                </div>
              )}

              {/* Best Multi-pack Deal Callout */}
              {p.best_pack && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/70 p-2 text-[11px] text-indigo-900">
                  <IconPackage className="text-indigo-600 shrink-0" size={14} />
                  <span className="truncate">
                    <strong className="font-semibold">{p.best_pack.label}:</strong> {inr(p.best_pack.price_per_unit)}/ea ·{' '}
                    <span className="font-semibold text-indigo-700">Save {p.best_pack.unit_saving_percent}%</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Card Actions Footer */}
        <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/50 text-xs">
          <button
            onClick={() => onSelect(p)}
            className="flex items-center justify-center gap-1.5 border-r border-slate-100 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
          >
            <IconChart size={13} className="text-slate-400" />
            <span>Price history</span>
          </button>
          <a
            href={p.product_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
          >
            <span>Store</span>
            <IconExternalLink size={12} className="text-slate-400" />
          </a>
        </div>
      </Card>
    </motion.div>
  );
}
