/**
 * POST /api/admin/delete-category  (owner only)  Body: { slug }
 * Refuses if any product still uses the category (would orphan them) — move or
 * delist those products first. Returns the updated category list.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { loadCategories } from '../../_categories.js';

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
  const slug = String(b.slug || '').trim();
  if (!slug) return json({ error: 'slug required' }, 400);

  try {
    const row = await env.DB.prepare('SELECT slug, label FROM categories WHERE slug = ?').bind(slug).first();
    if (!row) return json({ error: 'Category not found' }, 404);
    const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE category = ?').bind(row.label).first();
    if (cnt && cnt.n) return json({ error: `${cnt.n} product(s) still use "${row.label}" — move or remove them first.` }, 409);
    await env.DB.prepare('DELETE FROM categories WHERE slug = ?').bind(slug).run();
    const categories = await loadCategories(env);
    return json({ success: true, categories });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
}
