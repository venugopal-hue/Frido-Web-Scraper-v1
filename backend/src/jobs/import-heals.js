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
      'Preview showed image_url populated, but a 49-row run still returned 4/49 with images. Fix did not generalise.',
  },
  {
    file: 'heal-2.json',
    trigger: 'manual',
    status: 'failed',
    itemsBefore: 4,
    itemsAfter: 4,
    detail:
      'Targeted lazy-loading (data-src/srcset) explicitly. Preview again showed an image; real run unchanged at 4/49.',
  },
  {
    file: 'heal-3.json',
    trigger: 'manual',
    status: 'failed',
    detail:
      'Pure output transform, no DOM discovery — converged in 34 polls vs 99/144. Preview returned numeric 63. Real 49-row run: 0/49 numeric, still "37% OFF".',
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
