/**
 * GET /api/reviews/mine
 *
 * Everything the signed-in customer is allowed to review, plus what they have
 * already said. Powers review.html, where the customer never picks a product:
 * the page lists the pieces they actually received.
 *
 * Auth: Bearer session token (same shape as /api/orders/track). There is no
 * anonymous path here on purpose — an unauthenticated caller could otherwise
 * enumerate what other people bought.
 *
 * → 200 {
 *     success, name,
 *     items:  [{ order_id, sku, name, image, price, delivered_at,
 *                review: { id, rating, review_text, image_url, created_at } | null }],
 *     reviewable, reviewed
 *   }
 * → 401 { error } when the session is missing or stale
 *
 * A review is written once and cannot be edited afterwards — POST /api/reviews
 * refuses a second one for the same buyer and product, so a card that already
 * carries a review is display only.
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    return await db.prepare(
      'SELECT s.user_id, u.name, u.email, u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1'
    ).bind(token).first();
  } catch (e) { return null; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'Database unavailable' }, 503);

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const session = await resolveSessionUser(db, token);
  if (!session) return json({ error: 'Sign in to leave a review' }, 401);

  const email = (session.email || '').toLowerCase();
  // users.phone is stored in assorted shapes; match on the last 10 digits.
  const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);

  // Only DELIVERED orders. A piece that has not arrived cannot be reviewed
  // honestly, and "review before it lands" is what makes a review section
  // look bought.
  let orders = [];
  try {
    const { results } = await db.prepare(
      `SELECT id, items, updated_at FROM orders
        WHERE status = 'delivered'
          AND (lower(email) = ? OR substr(replace(replace(replace(phone,' ',''),'-',''),'+',''), -10) = ?)
        ORDER BY updated_at DESC LIMIT 40`
    ).bind(email, phone).all();
    orders = results || [];
  } catch (e) { orders = []; }

  // Flatten to one row per (order, sku). Quantity is irrelevant: two of the
  // same piece in one order is still one opinion.
  const wanted = [];
  const seen = new Set();
  for (const o of orders) {
    let items = [];
    try { items = JSON.parse(o.items || '[]'); } catch (e) { items = []; }
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const sku = String((it && it.id) || '').trim();
      if (!sku) continue;
      const key = o.id + '|' + sku;
      if (seen.has(key)) continue;
      seen.add(key);
      wanted.push({
        order_id: o.id,
        sku,
        fallback_name: String((it && it.name) || sku),
        price: Number(it && it.price) || null,
        delivered_at: o.updated_at || null,
      });
    }
  }
  if (!wanted.length) {
    return json({ success: true, name: session.name || '', items: [], reviewable: 0, reviewed: 0 });
  }

  const skus = [...new Set(wanted.map(w => w.sku))];
  const marks = skus.map(() => '?').join(',');

  // Current catalogue name and image, so a card never shows a name the site
  // itself stopped using. The order-time name is the fallback.
  let byS = {};
  try {
    const { results } = await db.prepare(
      `SELECT sku, name, image, price FROM products WHERE sku IN (${marks})`
    ).bind(...skus).all();
    for (const r of results || []) byS[r.sku] = r;
  } catch (e) { byS = {}; }

  // This customer's existing reviews for those SKUs.
  let mine = {};
  try {
    const { results } = await db.prepare(
      `SELECT id, product_sku, order_id, rating, review_text, image_url, created_at
         FROM reviews WHERE user_id = ? AND product_sku IN (${marks})`
    ).bind(session.user_id, ...skus).all();
    for (const r of results || []) mine[(r.order_id || '') + '|' + r.product_sku] = r;
  } catch (e) { mine = {}; }

  const items = wanted.map(w => {
    const p = byS[w.sku] || {};
    const r = mine[w.order_id + '|' + w.sku] || mine['|' + w.sku] || null;
    let review = null;
    if (r) {
      review = {
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        // Photos publish immediately. The owner can delete one from the admin
        // panel, and that clears image_url, so a row that still has a URL is
        // a photo that is live on the storefront right now.
        image_url: r.image_url || null,
        created_at: r.created_at,
      };
    }
    return {
      order_id: w.order_id,
      sku: w.sku,
      name: p.name || w.fallback_name,
      image: p.image || '',
      price: w.price != null ? w.price : (p.price != null ? p.price : null),
      delivered_at: w.delivered_at,
      review,
    };
  });

  return json({
    success: true,
    name: session.name || '',
    items,
    reviewable: items.filter(i => !i.review).length,
    reviewed: items.filter(i => i.review).length,
  });
}
