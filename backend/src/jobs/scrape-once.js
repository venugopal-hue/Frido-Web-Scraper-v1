/**
 * One-shot scrape from the command line: `npm run scrape`.
 *
 * Same code path the scheduler and POST /api/refresh use, so a manual run and
 * an automated one can never behave differently.
 */
import 'dotenv/config';
import { runCycle } from '../pipeline.js';
import { targetUrls } from '../targets.js';
import { notifySubscribers } from '../notify.js';
import { formatDiff } from '../format-alert.js';

const urls = process.argv.slice(2).length ? process.argv.slice(2) : targetUrls();

console.log(`[scrape] ${urls.length} collection(s):`);
urls.forEach((u) => console.log(`  - ${u}`));

const result = await runCycle({
  urls,
  autoHeal: process.env.AUTO_HEAL !== 'false',
  onEvent: (e) => console.log(`[scrape] ${e.type}`, e.count ?? ''),
});

if (!result.ok) {
  console.error('[scrape] run failed');
  if (result.healAwaitingApproval) {
    console.error('[scrape] a heal is awaiting approval — run:');
    console.error(`         bdata scraper approve ${process.env.COLLECTOR_ID}`);
  }
  process.exit(1);
}

console.log(`[scrape] ✓ ${result.products.length} products (run #${result.runId})`);
if (result.healed) console.log('[scrape] ✓ scraper self-healed mid-run');

if (result.diff?.hasChanges) {
  console.log('[scrape] changes detected:');
  console.log(formatDiff(result.diff));
  await notifySubscribers(formatDiff(result.diff));
}

process.exit(0);
