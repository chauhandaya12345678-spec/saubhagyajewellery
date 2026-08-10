/**
 * Review moderation — the owner's view of every published review.
 *
 * There is no approval queue: a customer's words and photo go live the moment
 * they are written. Moderation is after the fact, which is what this endpoint
 * is for.
 *
 *   GET  /api/admin/reviews?limit=200&q=&only=photos
 *        → { success, reviews: [...], count, withPhotos }
 *
 *   POST /api/admin/reviews  { id, action }
 *        action: 'delete_photo' → clears the photo, keeps the review text
 *                'delete'       → removes the review row entirely
 *
 * Both actions also delete the R2 object, so a photo the owner takes down is
 * gone from storage and not merely unlinked. R2 failures are reported but do
 * not fail the request: the row is already updated and the public site no
 * longer references the object, which is the part that matters.
 *
 * Auth: owner only. Staff accounts are read-only across the panel and
 * deleting a customer's words is not a read-only act.
 */
import { adminCorsHeaders, verifyAdminAccess, logEvent } from '../_lib.js';

const PUBLIC_BASE_DEFAULT = 'https://img.saubhagyajewellery.com';

/**
 * Turn a stored image_url back into its R2 key.
 * Only keys under reviews/ are ever returned — a row whose URL points
 * somewhere else (a hand-edited value, a different bucket) must never let this
 * endpoint delete an arbitrary object such as a product photo.
 */
function r2KeyFor(url, env) {
  if (!url || typeof url !== 'string') return null;
  const base = (env.R2_PUBLIC_BASE || PUBLIC_BASE_DEFAULT).replace(/\/+$/, '');
  if (!url.startsWith(base + '/')) return null;
  let key;
  try { key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, '')); }
  catch { return null; }
  if (!key.startsWith('reviews/') || key.includes('..')) return null;
  return key;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const gate = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (gate.response) return gate.response;

  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 501);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const n = parseInt(url.searchParams.get('limit'), 10);
      const limit = Math.min(Math.max(Number.isFinite(n) ? n : 200, 1), 500);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const only = url.searchParams.get('only') || '';

      const where = [];
      const bind = [];
      if (only === 'photos') where.push('image_url IS NOT NULL');
      if (q) {
        where.push('(lower(name) LIKE ? OR lower(product_sku) LIKE ? OR lower(review_text) LIKE ?)');
        const like = '%' + q + '%';
        bind.push(like, like, like);
      }
      const sql =
        'SELECT id, product_sku, name, rating, review_text, image_url, order_id, created_at FROM reviews' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '') +
        ' ORDER BY created_at DESC, id DESC LIMIT ?';
      bind.push(limit);

      // order_id landed later than the rest of the table. On a database that
      // has not been migrated yet, fall back rather than 500 the whole tab.
      let results;
      try {
        ({ results } = await db.prepare(sql).bind(...bind).all());
      } catch (e) {
        if (!/no such column/i.test(e.message || '')) throw e;
        ({ results } = await db.prepare(sql.replace('image_url, order_id,', 'image_url,')).bind(...bind).all());
      }
      const reviews = results || [];
      return json({
        success: true,
        reviews,
        count: reviews.length,
        withPhotos: reviews.filter(r => r.image_url).length,
      });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      const id = parseInt(body.id, 10);
      const action = String(body.action || '');
      if (!Number.isFinite(id)) return json({ error: 'id required' }, 400);
      if (action !== 'delete' && action !== 'delete_photo') {
        return json({ error: 'action must be delete or delete_photo' }, 400);
      }

      const row = await db.prepare('SELECT id, product_sku, image_url FROM reviews WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'not found' }, 404);

      if (action === 'delete_photo' && !row.image_url) {
        return json({ error: 'this review has no photo' }, 400);
      }

      if (action === 'delete') {
        await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
      } else {
        await db.prepare("UPDATE reviews SET image_url = NULL, image_status = 'rejected' WHERE id = ?").bind(id).run();
      }

      // The row no longer points at the object, so drop it from R2 too.
      let photoDeleted = null;
      const key = r2KeyFor(row.image_url, env);
      if (key && env.IMAGES) {
        try { await env.IMAGES.delete(key); photoDeleted = true; }
        catch (e) { photoDeleted = false; }
      }

      await logEvent(db, {
        level: 'info',
        source: 'admin',
        message: `review ${id} (${row.product_sku}) ${action} by ${gate.username || 'owner'}`,
        meta: { id, action, sku: row.product_sku, photoDeleted },
      }).catch(() => {});

      return json({ success: true, id, action, photoDeleted });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
