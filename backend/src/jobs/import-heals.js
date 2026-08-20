/**
 * Import heal events that were run directly against the CLI into the database,
 * so the dashboard timeline reflects the full history and not only the heals
 * that happened to go through the API.
 *
 * Reads scraper/heal-*.json (the real `bdata scraper heal` output) plus an
 * outcome note per heal, since whether a heal actually worked can only be
 * judged by re-running it — which is recorded in scraper/heal-log.md.
 *
 * Usage: node src/jobs/import-heals.js
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, recordHeal, updateHeal, healEvents } from '../db.js';

const SCRAPER_DIR = resolve(process.cwd(), '../scraper');

/**
 * Verified outcomes. `status` here is the *real* result after re-running the
 * healed collector, which is not always what the heal's own preview implied.
 */
const HEALS = [
  {
    file: 'heal-1.json',
    trigger: 'manual',
    status: 'failed',
    itemsBefore: 1,
    itemsAfter: 4,
    detail:
      'Approved without --auto-save — never persisted. Also the wrong tool: grid images are lazy-loaded, so the URL is absent from the DOM the run sees.',
  },
  {
    file: 'heal-2.json',
    trigger: 'manual',
    status: 'failed',
    itemsBefore: 4,
    itemsAfter: 4,
    detail:
      'Targeted lazy-loading explicitly. Also approved without --auto-save. Image coverage was ultimately fixed outside the collector via /products/{handle}.json.',
  },
  {
    file: 'heal-3.json',
    trigger: 'manual',
    status: 'failed',
    detail:
      'Approved without --auto-save, so the template was never persisted. Steps ended at user_approval; no save_new_template. Real run: 0/49 numeric.',
  },
  {
    file: 'heal-4-autosave.json',
    trigger: 'manual',
    status: 'healed',
    itemsBefore: 0,
    itemsAfter: 48,
    detail:
      'Same prompt as #3 but with --auto-approve --auto-save. Steps ended with save_new_template. Real 49-row run: 48/49 numeric (the 1 remaining is a product with no discount, correctly null).',
  },
];

// Idempotent: clear previously imported rows so re-running does not duplicate.
db.exec(`DELETE FROM heal_events WHERE trigger IN ('manual','auto')`);

let imported = 0;
for (const h of HEALS) {
  const path = resolve(SCRAPER_DIR, h.file);
  if (!existsSync(path)) {
    console.warn(`[import-heals] skipping ${h.file} — not found`);
    continue;
  }

  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const id = recordHeal({
    collectorId: payload.collector_id,
    trigger: h.trigger,
    prompt: payload.prompt || '(prompt not recorded in CLI output)',
    status: 'healing',
    detail: `Steps: ${(payload.completed_steps ?? []).join(' → ')}`,
    itemsBefore: h.itemsBefore ?? null,
  });
  updateHeal(id, { status: h.status, detail: h.detail, itemsAfter: h.itemsAfter ?? null });
  imported++;
  console.log(`[import-heals] ${h.file} → ${h.status}`);
}

console.log(`[import-heals] imported ${imported}; timeline now has ${healEvents().length} events`);
