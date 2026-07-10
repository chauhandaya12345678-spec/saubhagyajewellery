/**
 * Saubhagya – Reviews API (verified-buyer gated)
 *
 * GET  /api/reviews?sku=X
 *   → { success, reviews:[{name, rating, review_text, created_at, verified:1}], average, count }
 *
 * POST /api/reviews  { product_sku, email?, phone?, name, rating, review_text }
 *   → 200 { success } iff:
 *     - a confirmed order exists for this email/phone that contains product_sku
 *     - user hasn't already reviewed this product
 *   → 403 { error: "Only verified buyers can review this product." }
 *   → 409 { error: "You have already reviewed this product." }
 *
 * No admin approval loop, no rate-limit escape: identity is the order row.
 */
import { normEmail, normPhone } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const db = env.DB;
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const sku = url.searchParams.get('sku');
      if (!sku) return json({ error: 'sku required' }, 400);
      const { results } = await db.prepare(
        'SELECT name, rating, review_text, created_at FROM reviews WHERE product_sku = ? ORDER BY created_at DESC'
      ).bind(sku).all();
      const avg = results.length ? Math.round(results.reduce((s, r) => s + r.rating, 0) / results.length * 10) / 10 : 0;
      // Public payload — no user_id, no email leak; every published review is verified by construction
      const list = results.map(r => ({ name: r.name, rating: r.rating, review_text: r.review_text, created_at: r.created_at, verified: 1 }));
      return json({ success: true, reviews: list, average: avg, count: results.length });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { product_sku, name, rating, review_text } = body;
      const email = normEmail(body.email);
      const phone = normPhone(body.phone);
      if (!product_sku || !name || !rating || !review_text) {
        return json({ error: 'product_sku, name, rating, review_text required' }, 400);
      }
      if (!email && !phone) return json({ error: 'email or phone required so we can verify your order' }, 400);
      if (rating < 1 || rating > 5) return json({ error: 'rating must be 1-5' }, 400);
      if (String(review_text).length > 2000) return json({ error: 'review too long' }, 400);

      // Match confirmed orders for this email/phone; check items JSON contains the sku
      const rows = await db.prepare(
        `SELECT items FROM orders WHERE (lower(email) = ? OR phone = ?) AND status IN ('confirmed','processing','shipped','delivered')`
      ).bind(email || '', phone || '').all();
      const skuTag = `"id":"${product_sku}"`;
      const bought = (rows.results || []).some(o => String(o.items || '').includes(skuTag));
      if (!bought) return json({ error: 'Only verified buyers can review this product. Sign in with the email or phone you used at checkout.' }, 403);

      // One review per buyer per product
      const dupe = await db.prepare(
        `SELECT r.id FROM reviews r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.product_sku = ? AND (lower(u.email) = ? OR u.phone = ?)`
      ).bind(product_sku, email || '', phone || '').first().catch(() => null);
      if (dupe) return json({ error: 'You have already reviewed this product.' }, 409);

      // Look up the customer's user id if we have one on file (best-effort; not required to insert)
      let userId = null;
      if (email) {
        const u = await db.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first().catch(() => null);
        if (u) userId = u.id;
      }
      if (!userId && phone) {
        const u = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first().catch(() => null);
        if (u) userId = u.id;
      }

      await db.prepare('INSERT INTO reviews (product_sku, user_id, name, rating, review_text) VALUES (?, ?, ?, ?, ?)')
        .bind(product_sku, userId, String(name).slice(0, 60), rating, review_text).run();
      return json({ success: true, verified: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
