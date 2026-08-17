/**
 * Saubhagya — category registry (shared).
 *
 * Categories used to be hard-coded in three places (admin CANON_CATEGORIES,
 * categories.html SUBS, index.html tiles). They are now data-driven: one D1
 * `categories` table is the source of truth, exposed at GET /api/categories and
 * edited from the admin "Categories" manager. The homepage rail, the /categories
 * hub and the admin dropdowns all read it.
 *
 * `label` is what a product row stores in products.category (e.g. "Necklace"),
 * so it MUST match exactly. `slug` is the URL token (?cat=necklaces). Renaming a
 * category rewrites products.category for every product in it (see save-category).
 *
 * DEFAULT_CATEGORIES is the seed AND the fallback: if the table is missing or
 * empty (e.g. before the migration runs), loadCategories() returns these so the
 * shop never renders an empty category strip.
 */

export const DEFAULT_CATEGORIES = [
  { slug: 'necklaces',  label: 'Necklace',   banner: 'images/models/cat-necklace.webp', subtitle: 'Short, temple & crystal necklaces', bgpos: 'center 70%', position: 10 },
  { slug: 'earrings',   label: 'Earring',    banner: 'images/models/cat-earrings.webp', subtitle: 'Kundan chandbali & drops',            bgpos: '',           position: 20 },
  { slug: 'pendants',   label: 'Pendant',    banner: 'images/models/cat-pendant.webp',  subtitle: 'Lakshmi temple pendant mala',         bgpos: '',           position: 30 },
  { slug: 'bridal-set', label: 'Bridal Set', banner: 'images/models/cat-bridal.webp',   subtitle: 'Temple necklace & matching jhumkas',  bgpos: 'center 55%', position: 40 },
];

export function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * All categories, ordered. Falls back to DEFAULT_CATEGORIES on any error or when
 * the table is empty, so callers never have to special-case "not migrated yet".
 */
export async function loadCategories(env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT slug, label, banner, subtitle, bgpos, position FROM categories ORDER BY position ASC, label ASC'
    ).all();
    if (results && results.length) return results;
  } catch (e) { /* table missing → defaults */ }
  return DEFAULT_CATEGORIES;
}
