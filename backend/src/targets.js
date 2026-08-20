import { allCategories } from './db.js';
import { categoryFromUrl } from './brightdata.js';

export const SITE = 'https://store.myfrido.com';
export const CATEGORIES_PAGE = `${SITE}/pages/categories`;

/**
 * Seed list, discovered from the category index at /pages/categories.
 * The categories scraper refreshes this into the DB; this constant only exists
 * so a fresh clone can scrape before the first category run.
 */
export const SEED_CATEGORIES = [
  { slug: 'tt-orthotics', name: 'Orthotics' },
  { slug: 'footwears', name: 'Footwear' },
  { slug: 'tt-chairs-all-products', name: 'Chairs' },
  { slug: 'mattress-topper-and-protectors', name: 'Mattress' },
  { slug: 'personal-care', name: 'Personal Care' },
  { slug: 'tt-pillows', name: 'Pillows' },
  { slug: 'tt-cushions-all-products', name: 'Cushions' },
  { slug: 'maternity-and-baby-care', name: 'Maternity & Baby Care' },
  { slug: 'tt-insoles-all-products', name: 'Insoles' },
  { slug: 'socks', name: 'Socks' },
  { slug: 'tt-barefoot-shoes', name: 'Barefoot' },
  { slug: 'desks', name: 'Workspace' },
].map((c) => ({ ...c, collection_url: `${SITE}/collections/${c.slug}` }));

/**
 * The category index also links use-case collections ("Neck Pain", "Shop By
 * Usecase", "Sleep Essentials") that re-list products already covered by the
 * product categories above. Scraping those would bill extra runs to collect
 * duplicates, so scrape targets are restricted to the real categories.
 */
/**
 * Every collection URL to scrape: the curated categories plus everything the
 * category-index scraper discovered.
 *
 * A union rather than an intersection on purpose — the index page does not
 * always surface every category (it omitted Chairs and Barefoot on one run),
 * and intersecting would silently drop them.
 *
 * Use-case collections ("Neck Pain", "Sleep Essentials") are deliberately kept:
 * they re-list products that also live in the product categories, but they
 * occasionally carry an item the main categories miss. The pipeline dedupes by
 * product_url, so the overlap costs a little run time and never duplicate rows.
 *
 * MAX_CATEGORIES caps the count for a cheap demo run; unset means scrape all.
 */
/**
 * The display names of the real product categories, derived from the same
 * slugs the scraper targets. Used to decide which label wins when a product
 * appears in several collections — "Pillows" beats "Hip Pain".
 */
// Derived through categoryFromUrl, not from c.name — products are labelled by
// that function, and it yields "Footwears"/"Desks" where the seed says
// "Footwear"/"Workspace". Comparing against c.name would never match.
export const CORE_CATEGORY_NAMES = new Set(
  SEED_CATEGORIES.map((c) => categoryFromUrl(c.collection_url)).filter(Boolean)
);

export function targetUrls() {
  const merged = new Map(SEED_CATEGORIES.map((c) => [c.slug, c]));
  for (const c of allCategories()) {
    if (!merged.has(c.slug)) merged.set(c.slug, c);
  }

  const list = [...merged.values()];
  const max = Number(process.env.MAX_CATEGORIES) || list.length;
  return list.slice(0, max).map((c) => c.collection_url);
}
