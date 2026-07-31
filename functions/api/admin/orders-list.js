/**
 * GET /api/admin/orders-list?status=&q=&limit=
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Read-only order feed for admin-orders.html — status updates still flow
 * automatically via ShipPrime webhook, this is view-only.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders(request);

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
  const date = (url.searchParams.get('date') || '').trim().toLowerCase();
  const from = (url.searchParams.get('from') || '').trim(); // YYYY-MM-DD
  const to = (url.searchParams.get('to') || '').trim();     // YYYY-MM-DD
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 500, 2000);

  try {
    const db = env.DB;
    let sql = 'SELECT id, name, phone, email, items, total, subtotal, address, status, payment_method, shipprime_awb, test_mode, created_at, updated_at FROM orders';
    const clauses = [];
    const params = [];
    // "status" may be a single value or a comma-joined list, e.g. the
    // Dashboard's "Pending to Ship" card links here with status=confirmed,packed.
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      clauses.push('status IN (' + statuses.map(() => '?').join(',') + ')');
      params.push(...statuses);
    }
    // Relative windows (week/month/year) + today, plus an explicit from/to range.
    if (date === 'today') { clauses.push("date(created_at) = date('now')"); }
    else if (date === 'week') { clauses.push("date(created_at) >= date('now','-7 days')"); }
    else if (date === 'month') { clauses.push("date(created_at) >= date('now','-1 month')"); }
    else if (date === 'year') { clauses.push("date(created_at) >= date('now','-1 year')"); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { clauses.push("date(created_at) >= date(?)"); params.push(from); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { clauses.push("date(created_at) <= date(?)"); params.push(to); }
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
