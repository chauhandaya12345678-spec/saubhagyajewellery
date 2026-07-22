/**
 * GET /api/admin/customers-list?q=&limit=
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Read-only customer feed for admin-customers.html.
 */
import { verifyAdminKey, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const unauthorized = await verifyAdminKey(request, env, corsHeaders);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 500, 2000);

  try {
    const db = env.DB;
    let sql = `SELECT u.id, u.name, u.email, u.phone, u.created_at,
                      COUNT(o.id) AS order_count,
                      COALESCE(SUM(o.total), 0) AS lifetime_total
               FROM users u
               LEFT JOIN orders o ON o.user_id = u.id`;
    const params = [];
    if (q) {
      sql += ' WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const like = '%' + q + '%';
      params.push(like, like, like);
    }
    sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(sql).bind(...params).all();
    return new Response(JSON.stringify({ success: true, count: results.length, customers: results || [] }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
