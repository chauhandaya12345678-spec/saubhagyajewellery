/**
 * GET /api/admin/customers-list?q=&limit=
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Read-only customer feed for admin-customers.html.
 *
 * Built from orders.phone, not users.id — orders created via the Razorpay
 * webhook race-condition path (functions/api/razorpay/webhook.js) always
 * insert user_id = NULL, even when a matching users row exists by phone.
 * Joining on user_id there silently hides every real customer. Phone is
 * the reliable identity across both tables, so aggregate on that instead.
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
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 500, 2000);

  try {
    const db = env.DB;
    let sql = `
      SELECT * FROM (
        SELECT
          o.phone AS phone,
          COALESCE(
            (SELECT o2.name FROM orders o2 WHERE o2.phone = o.phone AND o2.name IS NOT NULL AND o2.name != 'Guest' ORDER BY o2.created_at DESC LIMIT 1),
            'Guest'
          ) AS name,
          (SELECT u.email FROM users u WHERE u.phone = o.phone AND u.email IS NOT NULL LIMIT 1) AS email,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS lifetime_total,
          MIN(o.created_at) AS created_at
        FROM orders o
        WHERE o.phone IS NOT NULL
        GROUP BY o.phone
        UNION ALL
        SELECT u.phone, u.name, u.email, 0, 0, u.created_at
        FROM users u
        WHERE u.phone IS NOT NULL AND u.phone NOT IN (SELECT phone FROM orders WHERE phone IS NOT NULL)
      )`;
    const params = [];
    if (q) {
      sql += ' WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const like = '%' + q + '%';
      params.push(like, like, like);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
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
