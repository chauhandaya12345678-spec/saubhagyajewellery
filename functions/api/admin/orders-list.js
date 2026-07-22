/**
 * GET /api/admin/orders-list?status=&q=&limit=
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Read-only order feed for admin-orders.html — status updates still flow
 * automatically via ShipPrime webhook, this is view-only.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: false });
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim().toLowerCase();
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 200, 500);

  try {
    const db = env.DB;
    let sql = 'SELECT id, name, phone, email, items, total, subtotal, address, status, payment_method, shipprime_awb, test_mode, created_at, updated_at FROM orders';
    const clauses = [];
    const params = [];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (q) {
      clauses.push('(id LIKE ? OR phone LIKE ? OR name LIKE ? OR email LIKE ?)');
      const like = '%' + q + '%';
      params.push(like, like, like, like);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(sql).bind(...params).all();
    const orders = (results || []).map(o => {
      let items = [];
      let address = {};
      try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (e) {}
      try { address = typeof o.address === 'string' ? JSON.parse(o.address) : (o.address || {}); } catch (e) {}
      return { ...o, items, address };
    });

    return new Response(JSON.stringify({ success: true, count: orders.length, orders }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
