export type DealVerdict =
  | 'lowest'
  | 'near_lowest'
  | 'below_average'
  | 'typical'
  | 'above_average'
  | 'unknown';

export type Deal = {
  verdict: DealVerdict;
  low: number;
  high: number;
  avg: number;
  observations: number;
  window_days: number;
  vs_avg_percent: number;
  saving_vs_high: number;
};

export type Pack = {
  pack_label: string;
  unit_count: number | null;
  price_per_unit: number | null;
  total_price: number | null;
};

export type BestPack = {
  label: string;
  unit_count: number | null;
  price_per_unit: number;
  total_price: number | null;
  unit_saving_percent: number;
};

export type Product = {
  id: number;
  run_id: number;
  category: string | null;
  product_name: string;
  current_price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  availability: string | null;
  rating: number | null;
  review_count: number | null;
  product_url: string | null;
  image_url: string | null;
  scraped_at: string;
  deal?: Deal;
  packs?: Pack[];
  best_pack?: BestPack | null;
};

export const DEAL_LABELS: Record<DealVerdict, string> = {
  lowest: 'Lowest seen',
  near_lowest: 'Near lowest',
  below_average: 'Below average',
  typical: 'Typical price',
  above_average: 'Above average',
  unknown: '',
};

export type Run = {
  id: number;
  collector_id: string;
  target_url: string | null;
  status: 'running' | 'success' | 'empty' | 'failed';
  item_count: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type Coverage = Record<string, number> & { total: number };

export type HealEvent = {
  id: number;
  collector_id: string;
  trigger: 'auto' | 'manual';
  prompt: string;
  status: 'healing' | 'awaiting_approval' | 'healed' | 'failed';
  detail: string | null;
  items_before: number | null;
  items_after: number | null;
  /** JSON strings — field fill-rates either side of the heal. */
  coverage_before: string | null;
  coverage_after: string | null;
  created_at: string;
  resolved_at: string | null;
};

export function parseCoverage(json: string | null): Coverage | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export type Health =
  | 'healthy'
  | 'healing'
  | 'awaiting_approval'
  | 'broken'
  | 'running'
  | 'unknown';

export type Status = {
  health: Health;
  collector_id: string;
  last_run: Run | null;
  scraping: boolean;
  last_heal: HealEvent | null;
  recent_heals: HealEvent[];
  subscribers: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const getData = () =>
  get<{ run: Run | null; count: number; products: Product[] }>('/api/data');

export const getStatus = () => get<Status>('/api/status');

export const getHeals = () => get<{ events: HealEvent[] }>('/api/heals');

export const getHistory = (url: string) =>
  get<{ product_url: string; points: { current_price: number; scraped_at: string }[] }>(
    `/api/history?url=${encodeURIComponent(url)}`
  );

export async function triggerRefresh() {
  const res = await fetch('/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wait: false }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;

export const isOutOfStock = (availability: string | null) =>
  /out of stock|sold\s*out|unavailable/i.test(availability ?? '');

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
