/**
 * Saubhagya – Track Orders API
 *
 * Access rules (2026-07-17 hardening — was previously fully open):
 *   1. `order_id + phone` — single-order lookup. Only returns the row when
 *      the stored phone (last 10 digits) matches. This is what track-orders.html
 *      calls for guests.
 *   2. Bearer session token from Authorization header. Returns all orders
 *      for the authenticated user (email OR phone match).
 *   3. Legacy `email + phone` / `email` / `phone` / `user_id` still work but
 *      only when the caller also presents a valid session token — anonymous
 *      broad lookups by phone alone are the leak we are closing.
 *
 * Rate limit: per-IP, 20 lookups per 10 min. D1-backed (see rateLimitCheck
 * in _lib.js) — an in-memory Map here would reset unpredictably whenever
 * the Workers isolate recycles, so it wasn't a real guarantee.
 */
import { rateLimitCheck } from '../_lib.js';

async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    const row = await db.prepare(
      'SELECT s.user_id, u.email, u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1'
    ).bind(token).first();
    return row || null;
  } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...corsHeaders },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const db = env.DB;
  const rateOk = await rateLimitCheck(db, `track:${ip}`, 20, 10);
  if (!rateOk) return json({ error: 'Too many lookups, try again later' }, 429);

  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');
    const emailQ = url.searchParams.get('email');
    const phoneQ = url.searchParams.get('phone');
    const userIdQ = url.searchParams.get('user_id');
    const tokenQ = url.searchParams.get('token');

    // Bearer token (optional but expands access)
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? await resolveSessionUser(db, token) : null;

    let results = [];

    // Path 1: order_id + phone (unauthenticated single-order lookup, matches guest UX)
    if (orderId && phoneQ) {
      const phoneDigits = String(phoneQ).replace(/\D/g, '').slice(-10);
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      if (!order) return json({ success: true, orders: [] });
      const rowPhone = String(order.phone || '').replace(/\D/g, '').slice(-10);
      if (rowPhone !== phoneDigits) {
        return json({ error: 'Order not found or phone mismatch' }, 403);
      }
      results = [order];
    }
    // Path 1b: order_id + token (WhatsApp link, privacy-safe)
    else if (orderId && tokenQ) {
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      if (!order || order.track_token !== tokenQ) {
        return json({ success: true, orders: [] });
      }
      results = [order];
    }
    // Path 2: signed-in session — broad access to own orders
    else if (session) {
      const sEmail = session.email || null;
      // Match on last-10-digits suffix, not exact string — users.phone (from
      // Firebase, often "+91XXXXXXXXXX") and orders.phone (from checkout,
      // often bare 10 digits) rarely share the same format, so an exact `=`
      // silently returned zero rows here while the phone+order_id path above
      // (which does normalize) found the same order fine.
      const sPhoneDigits = session.phone ? String(session.phone).replace(/\D/g, '').slice(-10) : null;
      const rows = await db.prepare(
        `SELECT * FROM orders WHERE user_id = ? OR (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone LIKE '%' || ?) ORDER BY created_at DESC LIMIT 100`
      ).bind(session.user_id, sEmail, sPhoneDigits).all();
      results = rows.results || [];
    }
    // Path 3: order_id alone — must present phone or token
    else if (orderId) {
      return json({ error: 'Provide token, phone with order_id, or sign in' }, 401);
    }
    // Legacy paths without session are now blocked (was the leak)
    else if (emailQ || phoneQ || userIdQ) {
      return json({ error: 'Sign in required for broad order lookup' }, 401);
    }
    else {
      return json({ error: 'Provide order_id + phone, or sign in' }, 400);
    }

    const orders = results.map(o => ({
      ...o,
      awb: o.shipprime_awb || o.awb || '',
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
      address: typeof o.address === 'string' ? JSON.parse(o.address) : o.address,
    }));

    return json({ success: true, orders });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
