/**
 * GET /api/admin/activity-log?limit=
 * Read-only feed of order_events — every ShipPrime push, WhatsApp/email
 * send, RTO restock, and "marked packed" action already gets logged there
 * (see logOrderEvent in _lib.js); this just surfaces it in the admin panel.
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
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 100, 300);

  try {
    const { results } = await env.DB.prepare(
      `SELECT e.id, e.order_id, e.kind, e.ok, e.detail, e.created_at, o.name AS customer_name
       FROM order_events e LEFT JOIN orders o ON o.id = e.order_id
       ORDER BY e.id DESC LIMIT ?`
    ).bind(limit).all();
    return new Response(JSON.stringify({ success: true, events: results || [] }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
