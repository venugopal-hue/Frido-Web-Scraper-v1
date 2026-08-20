/**
 * Seed the categories table from the site's category index.
 *
 * The category page at /pages/categories is server-rendered (unlike the product
 * grids), so the links can be read straight out of the Web Unlocker markdown
 * without needing a collector. Run: `npm run seed-categories`.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { upsertCategories, allCategories } from '../db.js';
import { CATEGORIES_PAGE, SITE, SEED_CATEGORIES } from '../targets.js';
import { categoryFromUrl } from '../brightdata.js';

function fetchMarkdown(url) {
  const res = spawnSync(
    'npx',
    ['-p', '@brightdata/cli', 'bdata', 'scrape', url, '--format', 'markdown'],
    { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 }
  );
  return res.stdout ?? '';
}

console.log(`[categories] reading ${CATEGORIES_PAGE}`);
const md = fetchMarkdown(CATEGORIES_PAGE);

// Markdown links of the form [ ... ](/collections/slug)
const found = new Map();
for (const m of md.matchAll(/\]\((\/collections\/([a-z0-9-]+))\)/gi)) {
  const [, path, slug] = m;
  if (found.has(slug)) continue;
  found.set(slug, {
    slug,
    name: categoryFromUrl(path) ?? slug,
    collection_url: `${SITE}${path}`,
    image_url: null,
  });
}

const cats = found.size ? [...found.values()] : SEED_CATEGORIES;
if (!found.size) {
  console.warn('[categories] no links parsed from the page — falling back to the seed list');
}

upsertCategories(cats);
console.log(`[categories] stored ${cats.length}; table now has ${allCategories().length}`);
for (const c of allCategories()) console.log(`  - ${c.name} → ${c.collection_url}`);
