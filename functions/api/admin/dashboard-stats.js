/**
 * GET /api/admin/dashboard-stats
 * Read-only summary counters for the admin.html Dashboard tab.
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

  try {
    const db = env.DB;
    const [todayRow, pendingRow, lowStockRow, customerRow, attentionRow] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS revenue FROM orders WHERE date(created_at) = date('now') AND test_mode = 0").first(),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status IN ('confirmed','packed') AND test_mode = 0").first(),
      db.prepare("SELECT COUNT(*) AS c FROM products WHERE stock_count IS NOT NULL AND stock_count <= 3").first(),
      db.prepare("SELECT COUNT(*) AS c FROM users").first(),
      db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status IN ('confirmed','packed') AND test_mode = 0 AND julianday('now') - julianday(created_at) > 5`).first(),
    ]);

    return new Response(JSON.stringify({
      success: true,
      today_orders: todayRow.c,
      today_revenue_paise: todayRow.revenue,
      pending_to_ship: pendingRow.c,
      low_stock_count: lowStockRow.c,
      total_customers: customerRow.c,
      needs_attention: attentionRow.c,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
