/**
 * POST /api/admin/mark-packed
 * Body: { order_id }
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Marks an order 'packed' — the warehouse-side signal that the SKU is
 * physically boxed, ahead of ShipPrime pickup. Only valid from 'confirmed'.
 */
import { verifyAdminKey, adminCorsHeaders, logOrderEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const unauthorized = await verifyAdminKey(request, env, corsHeaders);
  if (unauthorized) return unauthorized;

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const orderId = String(body.order_id || '').trim();
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const db = env.DB;
    const order = await db.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (order.status !== 'confirmed') {
      return new Response(JSON.stringify({ error: `Cannot mark packed from status "${order.status}"` }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    await db.prepare("UPDATE orders SET status = 'packed', updated_at = datetime('now') WHERE id = ?").bind(orderId).run();
    await logOrderEvent(db, orderId, 'marked_packed', 1, 'via admin panel');

    return new Response(JSON.stringify({ success: true, order_id: orderId, status: 'packed' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
