/**
 * Review photo moderation.
 *
 * GET  /api/admin/review-photos?status=pending   → photos awaiting a decision
 * POST /api/admin/review-photos  { id, action: 'approve' | 'reject' }
 *
 * The review TEXT is already public the moment it is written — only the photo
 * waits here, so rejecting one never silences a genuine customer, it just
 * drops the image.
 *
 * Auth: owner only (x-admin-key or an owner session), same as the other
 * mutating admin endpoints.
 */
import { adminCorsHeaders, verifyAdminAccess } from '../_lib.js';

const ALLOWED_STATUS = ['pending', 'approved', 'rejected'];

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const gate = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (gate.response) return gate.response;

  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 501);

  try {
    if (request.method === 'GET') {
      const status = new URL(request.url).searchParams.get('status') || 'pending';
      if (!ALLOWED_STATUS.includes(status)) return json({ error: 'bad status' }, 400);
      const { results } = await db.prepare(
        `SELECT id, product_sku, name, rating, review_text, image_url, image_status, created_at
           FROM reviews
          WHERE image_url IS NOT NULL AND image_status = ?
          ORDER BY created_at DESC LIMIT 100`
      ).bind(status).all();
      return json({ success: true, photos: results || [], count: (results || []).length });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      const id = parseInt(body.id, 10);
      const action = String(body.action || '');
      if (!Number.isFinite(id)) return json({ error: 'id required' }, 400);
      if (action !== 'approve' && action !== 'reject') return json({ error: 'action must be approve or reject' }, 400);

      const next = action === 'approve' ? 'approved' : 'rejected';
      // Reject also clears the URL: the row keeps the customer's words, and
      // the orphaned R2 object stops being referenced by anything public.
      const sql = next === 'approved'
        ? 'UPDATE reviews SET image_status = ? WHERE id = ?'
        : 'UPDATE reviews SET image_status = ?, image_url = NULL WHERE id = ?';
      const res = await db.prepare(sql).bind(next, id).run();
      const changed = (res && res.meta && res.meta.changes) || 0;
      if (!changed) return json({ error: 'not found' }, 404);
      return json({ success: true, id, status: next });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    if (/no such column/i.test(e.message || '')) {
      return json({ error: 'Run build/migrate-review-photo-moderation.sql first' }, 501);
    }
    return json({ error: String(e.message || e) }, 500);
  }
}
