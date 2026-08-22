'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  HealEvent,
  Product,
  Run,
  Status,
  Watch,
  getData,
  getHeals,
  getRuns,
  getSparklines,
  getStatus,
  getWatchlist,
  getChanges,
  Changes,
  triggerRefresh,
} from '@/lib/api';
import StatusBanner from '@/components/StatusBanner';
import StatsRow from '@/components/StatsRow';
import ProductGrid from '@/components/ProductGrid';
import HealTimeline from '@/components/HealTimeline';
import TelegramCard from '@/components/TelegramCard';
import PriceHistoryModal from '@/components/PriceHistoryModal';
import Tabs, { ViewId } from '@/components/Tabs';
import DealRadar from '@/components/DealRadar';
import WatchlistView from '@/components/WatchlistView';
import HealthView from '@/components/HealthView';
import PipelineView from '@/components/PipelineView';
import CategoryInsights from '@/components/CategoryInsights';
import CompareView from '@/components/CompareView';
import ChangesView from '@/components/ChangesView';

export default function Page() {
  const [view, setView] = useState<ViewId>('overview');

  const [status, setStatus] = useState<Status | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [heals, setHeals] = useState<HealEvent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [changes, setChanges] = useState<Changes | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<number | null>(null);

  /**
   * Cheap, frequently-polled state: run status and the watchlist.
   *
   * The watchlist is edited from Telegram, so the page has no way of knowing
   * it changed — an /unwatch used to sit there until a manual reload.
   */
  const loadLight = useCallback(async () => {
    try {
      // Runs belong here, not in the heavy loader: the heavy one only fires
      // when the run id changes, and `last_run` is the last *successful* run —
      // so an in-progress or failed run never triggered it and the activity
      // list sat stale until something succeeded.
      const [s, w, r] = await Promise.all([getStatus(), getWatchlist(), getRuns()]);
      setStatus(s);
      setWatches(w.watches);
      setRuns(r.runs);
      return s;
    } catch {
      setToast('Could not reach the tracker API. Retrying shortly…');
      return null;
    }
  }, []);

  /** The expensive half — only refetched when a run actually produced new data. */
  const loadHeavy = useCallback(async () => {
    try {
      const [d, h, sp, c] = await Promise.all([
        getData(),
        getHeals(),
        getSparklines(),
        getChanges(),
      ]);
      setProducts(d.products);
      setHeals(h.events);
      setSeries(sp.series);
      setChanges(c);
    } catch {
      /* loadLight surfaces the error; no need to toast twice */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLight();
    loadHeavy();
  }, [loadLight, loadHeavy]);

  // Refetch the catalogue only when the run id moves, rather than on every
  // poll — the products payload is far larger than the status one.
  useEffect(() => {
    const id = status?.last_run?.id ?? null;
    if (id === null || id === lastRunId) return;
    setLastRunId(id);
    if (lastRunId !== null) loadHeavy();
  }, [status, lastRunId, loadHeavy]);

  // Poll fast while a run is in flight, slowly otherwise. Without the idle
  // poll, anything changed elsewhere (a /watch from the bot, a scheduled run)
  // stayed invisible until a manual reload.
  useEffect(() => {
    const busy =
      status?.scraping || status?.health === 'healing' || status?.health === 'running';
    const every = busy ? 4000 : 15000;
    const t = setInterval(loadLight, every);
    return () => clearInterval(t);
  }, [status, loadLight]);

  // Coming back to the tab should show current data immediately.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLight();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadLight]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onRefresh() {
    setRefreshing(true);
    setToast('Scrape started — a full pass takes a few minutes.');
    try {
      await triggerRefresh();
      await loadLight();
    } catch {
      setToast('Could not start the scrape.');
    } finally {
      setRefreshing(false);
    }
  }

  const dealCount = products.filter(
    (p) => p.best_pack || ['lowest', 'near_lowest', 'below_average'].includes(p.deal?.verdict ?? '')
  ).length;

  return (
    <main className="mx-auto max-w-[1560px] px-4 py-8 md:px-8 md:py-10">
      <div className="space-y-6">
        <StatusBanner status={status} onRefresh={onRefresh} refreshing={refreshing} />

        <Tabs
          active={view}
          onChange={setView}
          counts={{ products: products.length, deals: dealCount, watchlist: watches.length }}
        />

        {view === 'overview' && (
          <div className="space-y-6">
            <StatsRow products={products} />
            <PipelineView status={status} />
            <ChangesView changes={changes} products={products} onSelect={setSelected} />
            <CategoryInsights products={products} />
            {/* min-w-0: grid items refuse to shrink below their content, so one
                long unbreakable string would otherwise widen the column. */}
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="min-w-0">
                <HealTimeline events={heals} />
              </div>
              <div className="min-w-0">
                <TelegramCard />
              </div>
            </div>
            <DealRadar products={products} series={series} onSelect={setSelected} />
          </div>
        )}

        {view === 'products' && (
          <ProductGrid
            products={products}
            loading={loading}
            series={series}
            onSelect={setSelected}
          />
        )}

        {view === 'deals' && <DealRadar products={products} series={series} onSelect={setSelected} />}

        {view === 'compare' && (
          <CompareView products={products} series={series} onSelect={setSelected} />
        )}

        {view === 'watchlist' && (
          <WatchlistView
            watches={watches}
            products={products}
            series={series}
            onSelect={setSelected}
          />
        )}

        {view === 'health' && <HealthView status={status} heals={heals} runs={runs} />}

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
