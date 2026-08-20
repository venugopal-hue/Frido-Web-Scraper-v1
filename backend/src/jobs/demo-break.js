/**
 * Live break demo — proves the detect → heal → re-run loop end to end.
 *
 * Points the collector at a URL that has no product grid on it (the category
 * index page). Extraction legitimately returns zero rows, which is exactly what
 * a site redesign looks like from the pipeline's point of view, so the auto-heal
 * path fires for real: heal is called, the attempt is recorded, and the
 * dashboard status moves healthy → healing.
 *
 * This is a *simulated break*, and it is labelled as one everywhere it is
 * recorded. The scraper is not sabotaged and no output is faked — the only
 * thing arranged is which URL it is pointed at.
 *
 * Usage: node src/jobs/demo-break.js
 */
import 'dotenv/config';
import { runCycle } from '../pipeline.js';
import { CATEGORIES_PAGE } from '../targets.js';

console.log('[demo] pointing the collector at a page with no product grid:');
console.log(`[demo]   ${CATEGORIES_PAGE}`);
console.log('[demo] expect: zero rows → auto-heal fires → recorded in the timeline\n');

const result = await runCycle({
  urls: [CATEGORIES_PAGE],
  autoHeal: true,
  enrich: false, // nothing to enrich when extraction is empty
  healPrompt:
    'SIMULATED BREAK (demo): the collector returned zero products. The product grid is ' +
    'rendered client-side on Shopify collection pages. Re-locate each product card and ' +
    're-extract product_name, current_price, original_price, discount_percent, ' +
    'availability, product_url and image_url.',
  onEvent: (e) => console.log(`[demo] ${e.type}`, e.count ?? e.summary ?? ''),
});

console.log('');
if (result.healAwaitingApproval) {
  console.log('[demo] ✓ break detected, heal generated, awaiting approval');
  console.log('[demo]   approve from the dashboard or:');
  console.log(`[demo]   bdata scraper approve ${process.env.COLLECTOR_ID}`);
} else if (result.healed) {
  console.log('[demo] ✓ break detected, heal applied, re-run succeeded');
} else if (!result.ok) {
  console.log('[demo] ✓ break detected and a heal was attempted — see the timeline');
} else {
  console.log('[demo] unexpected: the page returned products');
}

console.log('[demo] dashboard: http://localhost:3000');
process.exit(0);
