/**
 * GET /api/admin/logs — advanced, filterable log feed (Kibana-lite).
 * Unifies app_logs (structured app log) + order_events (per-order actions).
 *
 * Query params (all optional):
 *   level     = debug|info|warn|error
 *   source    = substring match on source/kind
 *   order_id  = exact order id
 *   q         = full-text substring across message + meta
 *   from,to   = ISO datetime bounds on the timestamp (custom date range)
 *   before    = cursor: return rows with ts < this value (pagination)
 *   limit     = 1..500 (default 100)
 *   facets=1  = also return distinct levels + sources for filter dropdowns
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders(request);

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: false });
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const p = url.searchParams;
  const level = (p.get('level') || '').trim().toLowerCase();
  const source = (p.get('source') || '').trim();
  const orderId = (p.get('order_id') || '').trim();
  const q = (p.get('q') || '').trim();
  const from = (p.get('from') || '').trim();
  const to = (p.get('to') || '').trim();
  const before = (p.get('before') || '').trim();
  const limit = Math.min(Math.max(parseInt(p.get('limit'), 10) || 100, 1), 500);

  // Unified view: app_logs + order_events, normalized to one shape.
  const base = `
    SELECT 'L' || id AS uid, ts, level, source, order_id, message, meta FROM app_logs
    UNION ALL
    SELECT 'E' || id AS uid, created_at AS ts,
           CASE WHEN ok = 1 THEN 'info' ELSE 'error' END AS level,
           kind AS source, order_id, detail AS message, NULL AS meta
    FROM order_events`;

  const where = [];
  const args = [];
  if (level)   { where.push('level = ?'); args.push(level); }
  if (source)  { where.push('source LIKE ?'); args.push('%' + source + '%'); }
  if (orderId) { where.push('order_id = ?'); args.push(orderId); }
  if (from)    { where.push('ts >= ?'); args.push(from); }
  if (to)      { where.push('ts <= ?'); args.push(to); }
  if (before)  { where.push('ts < ?'); args.push(before); }
  if (q)       { where.push('(message LIKE ? OR meta LIKE ?)'); args.push('%' + q + '%', '%' + q + '%'); }

  const sql = `SELECT * FROM (${base}) t
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ts DESC, uid DESC
    LIMIT ?`;
  args.push(limit);

  try {
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    const rows = results || [];
    const out = {
      success: true,
      logs: rows,
      nextBefore: rows.length === limit ? rows[rows.length - 1].ts : null,
    };

    if (p.get('facets') === '1') {
      const [lv, src] = await Promise.all([
        env.DB.prepare(`SELECT DISTINCT level FROM (${base}) t ORDER BY level`).all().catch(() => ({ results: [] })),
        env.DB.prepare(`SELECT DISTINCT source FROM (${base}) t ORDER BY source`).all().catch(() => ({ results: [] })),
      ]);
      out.facets = {
        levels: (lv.results || []).map(r => r.level).filter(Boolean),
        sources: (src.results || []).map(r => r.source).filter(Boolean),
      };
    }
    return json(out, 200, corsHeaders);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500, corsHeaders);
  }
}

function json(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
