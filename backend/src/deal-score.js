/**
 * "Is this actually a good price?"
 *
 * The discount badge on the site compares against MRP, which barely moves and
 * is often aspirational. What matters is how today's price compares with what
 * this product has actually sold for recently — which is the one thing a
 * tracker with history can say and a storefront cannot.
 */
import { priceStatsByUrl } from './db.js';

/** Verdicts, best first. */
export const VERDICTS = {
  lowest: { label: 'Lowest seen', rank: 0 },
  near_lowest: { label: 'Near lowest', rank: 1 },
  below_average: { label: 'Below average', rank: 2 },
  typical: { label: 'Typical price', rank: 3 },
  above_average: { label: 'Above average', rank: 4 },
  unknown: { label: 'Not enough history', rank: 5 },
};

/**
 * Annotate products with price context.
 *
 * `observations` counts distinct runs, not rows, so a product appearing in
 * several collections within one run cannot inflate its own history.
 */
export function withDealScores(products, { days = 30 } = {}) {
  const stats = priceStatsByUrl(days);

  return products.map((p) => {
    const s = p.product_url ? stats.get(p.product_url) : null;
    const price = p.current_price;

    // Two observations is the minimum that can show movement at all.
    if (!s || price === null || s.observations < 2) {
      return { ...p, deal: { verdict: 'unknown', ...emptyStats(s, price) } };
    }

    const { low, high, avg, observations } = s;
    const range = high - low;

    // No observed movement means no basis for a claim. Saying "lowest seen"
    // when every recorded price is identical is the fake-urgency pattern price
    // trackers get rightly criticised for, so it stays 'unknown' until the
    // price has actually moved at least once.
    if (range === 0) {
      return {
        ...p,
        deal: {
          verdict: 'unknown',
          low,
          high,
          avg: Math.round(avg),
          observations,
          window_days: days,
          vs_avg_percent: 0,
          saving_vs_high: 0,
          reason: 'price unchanged across all recorded runs',
        },
      };
    }

    let verdict;
    if (price <= low) verdict = 'lowest';
    else if (price <= low + range * 0.1) verdict = 'near_lowest';
    else if (price < avg * 0.98) verdict = 'below_average';
    else if (price <= avg * 1.02) verdict = 'typical';
    else verdict = 'above_average';

    return {
      ...p,
      deal: {
        verdict,
        low,
        high,
        avg: Math.round(avg),
        observations,
        window_days: days,
        // Negative means cheaper than usual.
        vs_avg_percent: avg ? Math.round(((price - avg) / avg) * 100) : 0,
        saving_vs_high: high > price ? Math.round(high - price) : 0,
      },
    };
  });
}

function emptyStats(s, price) {
  return {
    low: s?.low ?? price,
    high: s?.high ?? price,
    avg: s?.avg ? Math.round(s.avg) : price,
    observations: s?.observations ?? 0,
    window_days: 0,
    vs_avg_percent: 0,
    saving_vs_high: 0,
  };
}
