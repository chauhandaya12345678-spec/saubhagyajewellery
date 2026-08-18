/**
 * Saubhagya – Reviews API (verified-buyer gated)
 *
 * GET  /api/reviews?sku=X
 *   → { success, reviews:[{name, rating, review_text, image_url, created_at, verified:1}], average, count }
 *
 * GET  /api/reviews?latest=1&limit=12   (no sku — homepage feed)
 *   → { success, reviews:[{product_sku, name, rating, review_text, image_url, created_at, verified:1}], count }
 *
 * POST /api/reviews  { product_sku, email?, phone?, name, rating, review_text, image_url? }
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
    // reviews.image_url ships with build/migrate-review-images.sql. Until that
    // has been run the column doesn't exist, so every read falls back to the
    // pre-migration SELECT instead of 500ing the whole reviews block.
    const T = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('d1-timeout')), 4500))]);
    const q = async (sqlWith, sqlWithout, ...bind) => {
      try { return await T(db.prepare(sqlWith).bind(...bind).all()); }
      catch (e) {
        if (!/no such column|has no column named/i.test(e.message || '')) throw e;
        return await T(db.prepare(sqlWithout).bind(...bind).all());
      }
    };

    if (request.method === 'GET') {
      const sku = url.searchParams.get('sku');

      // Homepage feed: newest reviews across ALL products. Only when no sku.
      if (!sku && url.searchParams.get('latest') === '1') {
        const n = parseInt(url.searchParams.get('limit'), 10);
        const limit = Math.min(Math.max(Number.isFinite(n) ? n : 12, 1), 24);
        // Photos publish with the words, no approval queue. Moderation is
        // after the fact: deleting a photo in the admin panel NULLs image_url,
        // so a row that still carries a URL is one the owner has left up.
        const { results } = await q(
          'SELECT product_sku, name, rating, review_text, image_url, created_at FROM reviews ORDER BY created_at DESC LIMIT ?',
          'SELECT product_sku, name, rating, review_text, created_at FROM reviews ORDER BY created_at DESC LIMIT ?',
          limit
        );
        const feed = (results || []).map(r => ({ product_sku: r.product_sku, name: r.name, rating: r.rating, review_text: r.review_text, image_url: r.image_url || null, created_at: r.created_at, verified: 1 }));
        return json({ success: true, reviews: feed, count: feed.length });
      }

      if (!sku) return json({ error: 'sku required' }, 400);
      const { results } = await q(
        'SELECT name, rating, review_text, image_url, created_at FROM reviews WHERE product_sku = ? ORDER BY created_at DESC',
        'SELECT name, rating, review_text, created_at FROM reviews WHERE product_sku = ? ORDER BY created_at DESC',
        sku
      );
      const avg = results.length ? Math.round(results.reduce((s, r) => s + r.rating, 0) / results.length * 10) / 10 : 0;
      // Public payload — no user_id, no email leak; every published review is verified by construction
      const list = results.map(r => ({ name: r.name, rating: r.rating, review_text: r.review_text, image_url: r.image_url || null, created_at: r.created_at, verified: 1 }));
      return json({ success: true, reviews: list, average: avg, count: results.length });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { product_sku, name, rating, review_text } = body;
      const orderId = typeof body.order_id === 'string' ? body.order_id.trim().slice(0, 40) : null;
      const email = normEmail(body.email);
      const phone = normPhone(body.phone);
      if (!product_sku || !name || !rating || !review_text) {
        return json({ error: 'product_sku, name, rating, review_text required' }, 400);
      }
      if (!email && !phone) return json({ error: 'email or phone required so we can verify your order' }, 400);
      if (rating < 1 || rating > 5) return json({ error: 'rating must be 1-5' }, 400);
      if (String(review_text).length > 2000) return json({ error: 'review too long' }, 400);

      // image_url must be an object WE wrote via /api/review-image — anything
      // else would let a poster park an arbitrary external URL in our DB (and
      // on the storefront). Prefix check, not a "contains", so no
      // https://evil.com/?x=https://img.../reviews/ bypass.
      const imgBase = (env.R2_PUBLIC_BASE || 'https://img.saubhagyajewellery.com').replace(/\/+$/, '');
      let imageUrl = null;
      if (body.image_url !== undefined && body.image_url !== null && body.image_url !== '') {
        if (typeof body.image_url !== 'string' || !body.image_url.startsWith(imgBase + '/reviews/')) {
          return json({ error: 'invalid image_url' }, 400);
        }
        imageUrl = body.image_url;
      }

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

      const safeName = String(name).slice(0, 60);
      try {
        // image_status is stamped 'approved' at insert so the column never
        // claims a photo is waiting when it is already on the storefront.
        // It flips to 'rejected' only when the owner deletes the photo.
        await db.prepare('INSERT INTO reviews (product_sku, user_id, name, rating, review_text, image_url, image_status, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(product_sku, userId, safeName, rating, review_text, imageUrl, imageUrl ? 'approved' : null, orderId).run();
      } catch (e) {
        // SQLite words this differently per statement type: SELECT gives
        // "no such column: x", INSERT gives "table reviews has no column
        // named x". Match both or the fallback never fires.
        if (!/no such column|has no column named/i.test(e.message || '')) throw e;
        await db.prepare('INSERT INTO reviews (product_sku, user_id, name, rating, review_text) VALUES (?, ?, ?, ?, ?)')
          .bind(product_sku, userId, safeName, rating, review_text).run();
        // The photo is already in R2 but can't be referenced — tell the
        // caller so it isn't reported as a fully successful submission.
        if (imageUrl) return json({ success: true, verified: true, photoStored: false });
      }
      return json({ success: true, verified: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.log('reviews error:', err && err.message);
    return json({ error: 'Could not process that right now. Please try again.' }, 500);
  }
}
