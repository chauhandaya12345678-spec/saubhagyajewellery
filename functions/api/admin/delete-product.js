/**
 * POST /api/admin/delete-product   (owner only)   Body: { sku, confirm: true }
 *
 * Deletes ONE product row (SKU) and is logged. Two cases:
 *  - Standalone / single-colour product → the row is removed outright.
 *  - One colour of a multi-colour design → that colour's row is removed AND the
 *    shared `variants` array is rebuilt on every remaining sibling (lead-first).
 *    If only one colour is left, that row becomes a plain single product
 *    (variants = NULL). Deleting the lead promotes the next colour to lead.
 *
 * `confirm:true` is required so a mis-fired call can't wipe a product. Past
 * orders keep the SKU string as it was at purchase time (they are never touched).
 */
import { verifyAdminAccess, adminCorsHeaders, logEvent } from '../_lib.js';

function parseVariants(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { return JSON.parse(v); } catch (e) { return null; } }
  return null;
}

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
  const sku = String(b.sku || '').trim();
  if (!sku) return json({ error: 'sku required' }, 400);
  if (b.confirm !== true) return json({ error: 'confirm:true is required to delete' }, 400);

  try {
    const p = await env.DB.prepare('SELECT sku, name, variants FROM products WHERE sku = ?').bind(sku).first();
    if (!p) return json({ error: `Product "${sku}" not found` }, 404);

    const variants = parseVariants(p.variants);
    const isDesign = Array.isArray(variants) && variants.length > 1 && variants.some(v => v.sku === sku);

    const batch = [env.DB.prepare('DELETE FROM products WHERE sku = ?').bind(sku)];
    let remainingCount = 0;

    if (isDesign) {
      const remaining = variants.filter(v => v.sku !== sku);
      remainingCount = remaining.length;
      const newVariants = remaining.length > 1 ? JSON.stringify(remaining) : null;   // 1 left → plain single
      for (const v of remaining) {
        batch.push(env.DB.prepare('UPDATE products SET variants = ?, updated_at = datetime(\'now\') WHERE sku = ?').bind(newVariants, v.sku));
      }
    }

    await env.DB.batch(batch);
    try {
      await logEvent(env.DB, {
        level: 'warn', source: 'delete-product',
        message: `Deleted ${isDesign ? 'colour' : 'product'} ${sku} — ${p.name}`,
        meta: { sku, wasDesign: isDesign, remaining: remainingCount },
      });
    } catch (e) { /* logging must not fail the delete */ }

    return json({ success: true, deleted: sku, wasDesign: isDesign, remaining: remainingCount });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
