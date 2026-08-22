'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { Product, getHistory, inr } from '@/lib/api';
import { IconClose, IconChart, IconPackage, IconExternalLink } from './Icons';

type Point = { current_price: number; scraped_at: string };

export default function PriceHistoryModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    if (!product?.product_url) return;
    setPoints(null);
    getHistory(product.product_url)
      .then((r) => setPoints(r.points))
      .catch(() => setPoints([]));
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!product) return null;

  const data = (points ?? []).map((p) => ({
    price: p.current_price,
    at: new Date(p.scraped_at).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }),
  }));

  const prices = data.map((d) => d.price).filter((n) => typeof n === 'number');
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const flat = low !== null && low === high;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Price history for ${product.product_name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt=""
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-2xs"
              />
            )}
            <div>
              {product.category && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {product.category}
                </span>
              )}
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {product.product_name}
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {inr(product.current_price)}
                </span>
                {product.original_price && product.original_price !== product.current_price && (
                  <span className="text-xs text-slate-400 line-through tabular-nums">
                    {inr(product.original_price)}
                  </span>
                )}
                {product.discount_percent && (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                    {Math.round(product.discount_percent)}% off
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {product.product_url && (
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Store</span>
                <IconExternalLink size={12} />
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>

        {/* Quick Stats Metric Chips */}
        {low !== null && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
              <span className="text-[11px] font-medium text-slate-500">Lowest Seen</span>
              <div className="mt-0.5 text-sm font-bold text-emerald-700 tabular-nums">
                {inr(low)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
              <span className="text-[11px] font-medium text-slate-500">Highest Seen</span>
              <div className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                {inr(high)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
              <span className="text-[11px] font-medium text-slate-500">Recorded Scrapes</span>
              <div className="mt-0.5 text-sm font-bold text-indigo-600 tabular-nums">
                {data.length}
              </div>
            </div>
          </div>
        )}

        {/* Recharts Price Graph */}
        <div className="mt-4 h-64 w-full">
          {points === null ? (
            <div className="skeleton h-full rounded-xl" />
          ) : data.length < 2 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 text-center">
              <IconChart className="text-slate-300" size={24} />
              <p className="text-xs font-semibold text-slate-700">Initial Price Baseline Recorded</p>
              <p className="text-[11px] text-slate-400">
                A new historical data point is recorded on every collector scrape run.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -4 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="at"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={flat ? [(low as number) * 0.9, (high as number) * 1.1] : ['auto', 'auto']}
                  tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  }}
                  formatter={(v: number) => [inr(v), 'Price']}
                />
                <Line
                  type="stepAfter"
                  dataKey="price"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#4f46e5', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#4f46e5', stroke: '#c7d2fe', strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Multi-Pack Options Breakdown */}
        {product.packs && product.packs.length > 1 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <IconPackage size={14} className="text-indigo-600" />
              <span>Multi-Pack Pricing & Unit Savings</span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/40">
              {[...product.packs]
                .sort((a, b) => (a.unit_count ?? 0) - (b.unit_count ?? 0))
                .map((o) => {
                  const best = product.best_pack && o.pack_label === product.best_pack.label;
                  return (
                    <li
                      key={o.pack_label}
                      className={`flex items-center justify-between p-2.5 text-xs ${
                        best ? 'bg-emerald-50/80 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{o.pack_label}</span>
                        {best && (
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Best Value
                          </span>
                        )}
                      </div>

                      <div className="tabular-nums">
                        <span className="font-bold text-slate-900">{inr(o.price_per_unit)}</span>
                        <span className="text-slate-400 text-[11px]">/unit</span>
                        {o.total_price ? (
                          <span className="ml-2 text-slate-400 text-[11px]">
                            (Total {inr(o.total_price)})
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {flat && data.length >= 2 && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Price has remained steady at {inr(low)} across {data.length} recorded scrapes.
          </p>
        )}
      </div>
    </div>
  );
}
