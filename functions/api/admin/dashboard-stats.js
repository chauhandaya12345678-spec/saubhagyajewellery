/**
 * GET /api/admin/dashboard-stats
 * Read-only summary counters + revenue-by-period for the admin.html Dashboard tab.
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
    const periodSql = (whereExtra) => db.prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS revenue FROM orders WHERE test_mode = 0 AND ${whereExtra}`
    ).first();

    const [
      todayRow, weekRow, monthRow, yearRow,
      pendingRow, lowStockRow, customerRow, attentionRow,
      codTodayRow, onlineTodayRow, rtoRow,
    ] = await Promise.all([
      periodSql("date(created_at) = date('now')"),
      periodSql("created_at >= date('now', '-6 days')"),
      periodSql("strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"),
      periodSql("strftime('%Y', created_at) = strftime('%Y', 'now')"),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status IN ('confirmed','packed') AND test_mode = 0").first(),
      db.prepare("SELECT COUNT(*) AS c FROM products WHERE stock_count IS NOT NULL AND stock_count <= COALESCE(low_stock_threshold, 3)").first(),
      db.prepare("SELECT COUNT(*) AS c FROM users").first(),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status IN ('confirmed','packed') AND test_mode = 0 AND julianday('now') - julianday(created_at) > 5").first(),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE payment_method = 'cod' AND test_mode = 0 AND date(created_at) = date('now')").first(),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE payment_method != 'cod' AND test_mode = 0 AND date(created_at) = date('now')").first(),
      db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'rto' AND test_mode = 0").first(),
    ]);

    return new Response(JSON.stringify({
      success: true,
      today_orders: todayRow.c,
      today_revenue_paise: todayRow.revenue,
      week_orders: weekRow.c,
      week_revenue_paise: weekRow.revenue,
      month_orders: monthRow.c,
      month_revenue_paise: monthRow.revenue,
      year_orders: yearRow.c,
      year_revenue_paise: yearRow.revenue,
      pending_to_ship: pendingRow.c,
      low_stock_count: lowStockRow.c,
      total_customers: customerRow.c,
      needs_attention: attentionRow.c,
      cod_orders_today: codTodayRow.c,
      online_orders_today: onlineTodayRow.c,
      rto_count: rtoRow.c,
      avg_order_value_today_paise: todayRow.c > 0 ? Math.round(todayRow.revenue / todayRow.c) : 0,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
