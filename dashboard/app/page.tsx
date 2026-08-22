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
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatsRow from '@/components/StatsRow';
import ProductGrid from '@/components/ProductGrid';
import HealTimeline from '@/components/HealTimeline';
import TelegramCard from '@/components/TelegramCard';
import PriceHistoryModal from '@/components/PriceHistoryModal';
import { ViewId } from '@/components/Tabs';
import DealRadar from '@/components/DealRadar';
import WatchlistView from '@/components/WatchlistView';
import HealthView from '@/components/HealthView';
import PipelineView from '@/components/PipelineView';
import CategoryInsights from '@/components/CategoryInsights';
import CompareView from '@/components/CompareView';
import ChangesView from '@/components/ChangesView';
import { IconCheck, IconAlertTriangle } from '@/components/Icons';

export default function Page() {
  const [view, setView] = useState<ViewId>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'error' } | null>(
    null
  );
  const [lastRunId, setLastRunId] = useState<number | null>(null);

  /**
   * Cheap, frequently-polled state: run status and the watchlist.
   */
  const loadLight = useCallback(async () => {
    try {
      const [s, w, r] = await Promise.all([getStatus(), getWatchlist(), getRuns()]);
      setStatus(s);
      setWatches(w.watches);
      setRuns(r.runs);
      return s;
    } catch {
      setToast({ message: 'Could not reach the tracker API. Retrying shortly…', type: 'error' });
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

  useEffect(() => {
    const id = status?.last_run?.id ?? null;
    if (id === null || id === lastRunId) return;
    setLastRunId(id);
    if (lastRunId !== null) loadHeavy();
  }, [status, lastRunId, loadHeavy]);

  useEffect(() => {
    const busy =
      status?.scraping || status?.health === 'healing' || status?.health === 'running';
    const every = busy ? 4000 : 15000;
    const t = setInterval(loadLight, every);
    return () => clearInterval(t);
  }, [status, loadLight]);

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
    setToast({
      message: 'Scrape started — extracting live store data & photos.',
      type: 'info',
    });
    try {
      await triggerRefresh();
      await loadLight();
    } catch {
      setToast({ message: 'Could not start the scrape run.', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }

  const dealCount = products.filter(
    (p) => p.best_pack || ['lowest', 'near_lowest', 'below_average'].includes(p.deal?.verdict ?? '')
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/60 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        active={view}
        onChange={setView}
        counts={{ products: products.length, deals: dealCount, watchlist: watches.length }}
        status={status}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header Bar */}
        <Header
          view={view}
          status={status}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <div className="space-y-6">
            {view === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StatsRow products={products} />
                <PipelineView status={status} />
                <ChangesView changes={changes} products={products} onSelect={setSelected} />
                <CategoryInsights products={products} />

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
              <div className="animate-in fade-in duration-200">
                <ProductGrid
                  products={products}
                  loading={loading}
                  series={series}
                  onSelect={setSelected}
                />
              </div>
            )}

            {view === 'deals' && (
              <div className="animate-in fade-in duration-200">
                <DealRadar products={products} series={series} onSelect={setSelected} />
              </div>
            )}

            {view === 'compare' && (
              <div className="animate-in fade-in duration-200">
                <CompareView products={products} series={series} onSelect={setSelected} />
              </div>
            )}

            {view === 'watchlist' && (
              <div className="animate-in fade-in duration-200">
                <WatchlistView
                  watches={watches}
                  products={products}
                  series={series}
                  onSelect={setSelected}
                />
              </div>
            )}

            {view === 'health' && (
              <div className="animate-in fade-in duration-200">
                <HealthView status={status} heals={heals} runs={runs} />
              </div>
            )}

            {/* Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-200/80 pt-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Frido Web Scraper</span>
                <span>·</span>
                <span>© {new Date().getFullYear()} Impact Makers</span>
              </div>
              <p>
                Powered by Bright Data Scraper Studio Collector & Self-Healing AI
              </p>
            </footer>
          </div>
        </main>
      </div>

      {/* Price History & Multi-pack Modal */}
      <PriceHistoryModal product={selected} onClose={() => setSelected(null)} />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-2.5 text-xs font-medium text-slate-800 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
        >
          {toast.type === 'error' ? (
            <IconAlertTriangle className="text-rose-500 shrink-0" size={16} />
          ) : (
            <IconCheck className="text-emerald-500 shrink-0" size={16} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
