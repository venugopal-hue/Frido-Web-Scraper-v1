'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  HealEvent,
  Product,
  Status,
  getData,
  getHeals,
  getStatus,
  triggerRefresh,
} from '@/lib/api';
import StatusBanner from '@/components/StatusBanner';
import StatsRow from '@/components/StatsRow';
import ProductGrid from '@/components/ProductGrid';
import HealTimeline from '@/components/HealTimeline';
import TelegramCard from '@/components/TelegramCard';
import PriceHistoryModal from '@/components/PriceHistoryModal';

export default function Page() {
  const [status, setStatus] = useState<Status | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [heals, setHeals] = useState<HealEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, d, h] = await Promise.all([getStatus(), getData(), getHeals()]);
      setStatus(s);
      setProducts(d.products);
      setHeals(h.events);
      return s;
    } catch {
      setToast('Could not reach the API — is the backend running on :4000?');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Continuously refresh in realtime (fast polling during scrapes, steady polling when idle)
  useEffect(() => {
    const busy = Boolean(
      status?.scraping || status?.health === 'healing' || status?.health === 'running'
    );
    const t = setInterval(load, busy ? 3000 : 12000);
    return () => clearInterval(t);
  }, [status, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onRefresh() {
    setRefreshing(true);
    setToast('Scrape started — this can take a minute.');
    try {
      await triggerRefresh();
      await load();
    } catch {
      setToast('Could not start the scrape.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1560px] px-4 py-8 md:px-8 md:py-10">
      {/* Deliberately not sticky: a floating panel over a scrolling grid was
          overlapping the cards beneath it. */}
      <div className="space-y-8">
        <StatusBanner status={status} onRefresh={onRefresh} refreshing={refreshing} />

        <StatsRow products={products} />

        {/* Self-healing is the whole point of the project, so it sits above the
            catalogue rather than under a few hundred product cards.
            min-w-0: grid items default to min-width:auto and refuse to shrink
            below their content, so one long unbreakable string (a heal's raw
            CLI output) would otherwise blow the column out of the page. */}
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <HealTimeline events={heals} />
          </div>
          <div className="min-w-0">
            <TelegramCard />
          </div>
        </div>

        <ProductGrid products={products} loading={loading} onSelect={setSelected} />

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[--border] pt-6 text-[12px] text-[--text-faint]">
          <span>© {new Date().getFullYear()} Impact Makers</span>
          <span>
            Built for everyday shoppers who hate overpaying · Powered by Bright Data Scraper Studio
          </span>
        </footer>
      </div>

      <PriceHistoryModal product={selected} onClose={() => setSelected(null)} />

      {toast && (
        <div
          role="status"
          className="card fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5 text-[13px] shadow-sm"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
