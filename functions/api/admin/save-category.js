/**
 * POST /api/admin/save-category  (owner only)
 *
 * Create OR edit a category. Body (JSON):
 *   label*     display name = products.category value, e.g. "Bracelet"
 *   slug       URL token (?cat=slug); auto-derived from label if omitted
 *   oldSlug    present when editing an existing category (enables rename/reslug)
 *   banner     R2 URL / repo path for the tile image (upload via upload-image first)
 *   subtitle   one-line tile caption
 *   bgpos      CSS background-position for framing (optional)
 *   position   sort order (lower = earlier)
 *
 * Renaming the LABEL rewrites products.category for every product in the old
 * category, so existing products follow the new name instead of orphaning. The
 * whole thing runs as one D1 batch (atomic).
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { loadCategories, slugify } from '../../_categories.js';

const ENSURE_TABLE =
  `CREATE TABLE IF NOT EXISTS categories (
     slug TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE, banner TEXT, subtitle TEXT,
     bgpos TEXT, position INTEGER DEFAULT 100,
     created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`;

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const label = String(b.label || '').trim();
  if (!label) return json({ error: 'Category name is required' }, 400);
  let slug = slugify(b.slug || label);
  if (!slug) return json({ error: 'Could not make a URL slug from that name' }, 400);
  const oldSlug = String(b.oldSlug || '').trim();
  const banner = String(b.banner || '').trim() || null;
  const subtitle = String(b.subtitle || '').trim() || null;
  const bgpos = String(b.bgpos || '').trim() || null;
  const position = (b.position !== undefined && b.position !== null && b.position !== '') ? parseInt(b.position, 10) : 100;

  try {
    await env.DB.prepare(ENSURE_TABLE).run();
    // First save ever? seed the four defaults so nothing is lost when the table
    // is created by this very call.
    const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM categories').first();
    if (!existing || !existing.n) {
      const seed = (await loadCategories(env)); // returns DEFAULT_CATEGORIES here
      const seedStmt = env.DB.prepare(
        `INSERT OR IGNORE INTO categories (slug,label,banner,subtitle,bgpos,position) VALUES (?,?,?,?,?,?)`
      );
      await env.DB.batch(seed.map(c => seedStmt.bind(c.slug, c.label, c.banner || null, c.subtitle || null, c.bgpos || null, c.position || 100)));
    }

    const batch = [];
    let renamedProducts = 0;
    if (oldSlug) {
      const old = await env.DB.prepare('SELECT slug, label FROM categories WHERE slug = ?').bind(oldSlug).first();
      if (old) {
        // Label changed → move every product from the old label to the new one.
        if (old.label !== label) {
          const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE category = ?').bind(old.label).first();
          renamedProducts = (cnt && cnt.n) || 0;
          batch.push(env.DB.prepare('UPDATE products SET category = ?, updated_at = datetime(\'now\') WHERE category = ?').bind(label, old.label));
        }
        // Slug changed → drop the old row (the upsert below writes the new slug).
        if (old.slug !== slug) batch.push(env.DB.prepare('DELETE FROM categories WHERE slug = ?').bind(oldSlug));
      }
    }
    batch.push(env.DB.prepare(
      `INSERT INTO categories (slug,label,banner,subtitle,bgpos,position,updated_at)
       VALUES (?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET label=excluded.label, banner=excluded.banner,
         subtitle=excluded.subtitle, bgpos=excluded.bgpos, position=excluded.position,
         updated_at=datetime('now')`
    ).bind(slug, label, banner, subtitle, bgpos, position));

    await env.DB.batch(batch);
    const categories = await loadCategories(env);
    return json({ success: true, slug, label, renamedProducts, categories });
  } catch (e) {
    const msg = /UNIQUE/i.test(String(e.message)) ? 'A category with that name or slug already exists' : String(e.message || e);
    return json({ error: msg }, 400);
  }
}
