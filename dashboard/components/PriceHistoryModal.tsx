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
} from 'recharts';
import { Product, getHistory, inr } from '@/lib/api';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Price history for ${product.product_name}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold">{product.product_name}</h3>
            <p className="mt-1 text-[13px] text-[--text-muted]">
              {inr(product.current_price)}
              {product.original_price && product.original_price !== product.current_price && (
                <span className="ml-2 text-[--text-faint] line-through">
                  {inr(product.original_price)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-[--border] px-2.5 py-1 text-[13px] text-[--text-muted] transition hover:border-neutral-400"
          >
            Close
          </button>
        </div>

        {low !== null && (
          <div className="mt-4 flex gap-6 text-[13px]">
            <span>
              <span className="text-[--text-faint]">Lowest seen </span>
              <span className="font-medium">{inr(low)}</span>
            </span>
            <span>
              <span className="text-[--text-faint]">Highest seen </span>
              <span className="font-medium">{inr(high)}</span>
            </span>
            <span>
              <span className="text-[--text-faint]">Data points </span>
              <span className="font-medium">{data.length}</span>
            </span>
          </div>
        )}

        <div className="mt-5 h-60">
          {points === null ? (
            <div className="skeleton h-full rounded-lg" />
          ) : data.length < 2 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[--border] text-center">
              <p className="text-[13px] text-[--text-muted]">Not enough history yet</p>
              <p className="text-[12px] text-[--text-faint]">
                A price point is recorded on every scrape.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#eeeef2" vertical={false} />
                <XAxis
                  dataKey="at"
                  stroke="#9a9aa4"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9a9aa4"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  domain={flat ? [(low as number) * 0.9, (high as number) * 1.1] : ['auto', 'auto']}
                  tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e7e7ec',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [inr(v), 'Price']}
                />
                <Line
                  type="stepAfter"
                  dataKey="price"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#4f46e5' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pack options: the listed price is often not the cheapest per unit,
            and this is the only place the breakdown is visible. */}
        {product.packs && product.packs.length > 1 && (
          <div className="mt-5">
            <h4 className="text-[13px] font-semibold">Pack pricing</h4>
            <ul className="mt-2 divide-y divide-[--border] rounded-lg border border-[--border]">
              {[...product.packs]
                .sort((a, b) => (a.unit_count ?? 0) - (b.unit_count ?? 0))
                .map((o) => {
                  const best =
                    product.best_pack && o.pack_label === product.best_pack.label;
                  return (
                    <li
                      key={o.pack_label}
                      className={`flex items-center justify-between px-3 py-2 text-[13px] ${
                        best ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <span>
                        {o.pack_label}
                        {best && (
                          <span className="ml-2 text-[11px] font-medium text-emerald-700">
                            best per unit
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-medium">{inr(o.price_per_unit)}</span>
                        <span className="text-[--text-faint]">/unit</span>
                        {o.total_price ? (
                          <span className="ml-2 text-[--text-faint]">
                            total {inr(o.total_price)}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {flat && data.length >= 2 && (
          <p className="mt-3 text-[12px] text-[--text-faint]">
            Price has not moved across {data.length} recorded scrapes.
          </p>
        )}
      </div>
    </div>
  );
}
