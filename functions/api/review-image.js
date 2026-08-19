/**
 * POST /api/review-image   (gated by session, same as POST /api/reviews)
 *
 * Header: Authorization: Bearer <session token>
 * Multipart form-data:
 *   file        : the photo (jpeg/png/webp, ≤5 MB)
 *   product_sku : SKU the review is for
 *
 * → 200 { success: true, url }   url is always ${base}/reviews/<uuid>.<ext>
 * → 401 when not signed in
 * → 403 same error shape as reviews.js when the buyer can't be verified
 *
 * SECURITY: this endpoint must never behave like an open file host. Four
 * things keep it closed:
 *   1. the session check + order lookup below (no verified buyer → no upload),
 *   2. a hard jpeg/png/webp allowlist (no svg — svg carries script; no avif),
 *   3. a server-generated R2 key — no client "key"/filename field is ever read,
 *      so nothing can be written outside reviews/ or overwrite an existing object.
 */

import { normEmail, normPhone } from './_lib.js';

async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    return await db.prepare(
      'SELECT s.user_id, u.email, u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1'
    ).bind(token).first();
  } catch (e) { return null; }
}

const PUBLIC_BASE_DEFAULT = 'https://img.saubhagyajewellery.com';
const ALLOWED = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequest(context) {
  const { request, env } = context;
  // Mirrors reviews.js — the upload form lives on the same public product page.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = env.DB;
    if (!db) return json({ error: 'DB not bound' }, 501);
    if (!env.IMAGES) return json({ error: 'R2 bucket (IMAGES) not bound' }, 501);

    // Identity comes from the session, never from the request — see reviews.js.
    const authHeader = request.headers.get('Authorization') || '';
    const sessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const session = await resolveSessionUser(db, sessToken);
    if (!session) return json({ error: 'Sign in to leave a review' }, 401);
    const email = normEmail(session.email);
    const phone = normPhone(session.phone);

    // Reject oversized bodies BEFORE parsing — formData() materialises the
    // entire request in memory, so the cap has to come first or this public
    // endpoint is a memory-exhaustion lever for anyone, order or not.
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BYTES + 64 * 1024) return json({ error: 'File too large (max 5 MB)' }, 413);

    let form;
    try { form = await request.formData(); } catch { return json({ error: 'Expected multipart/form-data' }, 400); }

    const product_sku = String(form.get('product_sku') || '').trim();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'file field required' }, 400);
    if (!product_sku) return json({ error: 'product_sku required' }, 400);

    // Same gate as POST /api/reviews — verify the buyer BEFORE touching R2.
    const rows = await db.prepare(
      `SELECT items FROM orders WHERE (lower(email) = ? OR phone = ?) AND status IN ('confirmed','processing','shipped','delivered')`
    ).bind(email || '', phone || '').all();
    const skuTag = `"id":"${product_sku}"`;
    const bought = (rows.results || []).some(o => String(o.items || '').includes(skuTag));
    if (!bought) return json({ error: 'Only verified buyers can review this product.' }, 403);

    // Strip any ";charset=..." and normalise before the lookup.
    const ct = String(file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const ext = ALLOWED.get(ct);
    if (!ext) return json({ error: 'Unsupported type ' + ct + ' (use jpg/png/webp)' }, 415);

    // Cheap size check first (Blob.size), then re-check the real buffer length.
    if (Number(file.size) > MAX_BYTES) return json({ error: 'File too large (max 5 MB)' }, 413);
    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: 'File too large (max 5 MB)' }, 413);
    if (!buf.byteLength) return json({ error: 'Empty file' }, 400);

    // Server-generated key only — nothing here is client-controlled.
    const key = `reviews/${crypto.randomUUID()}.${ext}`;
    try {
      await env.IMAGES.put(key, buf, { httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' } });
    } catch (err) {
      return json({ error: 'R2 put failed: ' + (err.message || err) }, 500);
    }

    const base = (env.R2_PUBLIC_BASE || PUBLIC_BASE_DEFAULT).replace(/\/+$/, '');
    return json({ success: true, url: `${base}/${key}` });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
