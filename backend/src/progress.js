/**
 * Live progress of the scrape currently in flight.
 *
 * A full pass is 8 sequential chunk jobs plus image backfill and can run for
 * 20 minutes. Bright Data reports each chunk done separately, so without a
 * phase label the dashboard reads "Scraping" the whole time and looks hung —
 * which is exactly how it looked in practice.
 *
 * Shared state rather than per-caller, because both the manual refresh
 * endpoint and the hourly scheduler need to report into the same place.
 */
let current = null;

export const getProgress = () => current;

export const clearProgress = () => {
  current = null;
};

/** Feed this to runCycle's onEvent. */
export function trackProgress(e) {
  switch (e.type) {
    case 'run_started':
      current = { phase: 'starting' };
      break;
    case 'chunk_done':
      current = { phase: 'scraping', chunk: e.chunk, of: e.of };
      break;
    case 'enrich_started':
      current = { phase: 'images', count: e.count };
      break;
    case 'heal_started':
    case 'degradation_heal_started':
      current = { phase: 'healing' };
      break;
    case 'run_succeeded':
    case 'run_failed':
      current = null;
      break;
  }
}
