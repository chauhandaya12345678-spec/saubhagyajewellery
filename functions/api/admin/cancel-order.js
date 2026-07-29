/**
 * POST /api/admin/cancel-order
 * Body: { order_id, reason }
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Cancels a confirmed/packed order — restocks items, sends WhatsApp cancellation
 * notification. Does NOT push to ShipPrime or trigger refund (Razorpay refund is
 * manual via Razorpay dashboard).
 */
import { verifyAdminAccess, adminCorsHeaders, logOrderEvent, restockOrder, sendWhatsAppMessage, orderProductLabel } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: true });
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const orderId = String(body.order_id || '').trim();
  if (!orderId) return json({ error: 'order_id required' }, 400);
  const reason = String(body.reason || '').trim();
  if (!reason) return json({ error: 'Cancellation reason required' }, 400);

  try {
    const db = env.DB;
    const order = await db.prepare(
      `SELECT id, name, email, phone, items, total, status, payment_method, test_mode
         FROM orders WHERE id = ?`
    ).bind(orderId).first();
    if (!order) return json({ error: 'Order not found' }, 404);

    const cancellable = ['confirmed', 'packed'];
    if (cancellable.indexOf(order.status) === -1) {
      return json({ error: `Cannot cancel order in "${order.status}" status. Only confirmed/packed orders can be cancelled.` }, 409);
    }

    // Update status + save reason
    await db.prepare(
      "UPDATE orders SET status = 'cancelled', updated_at = datetime('now'), cancellation_reason = ? WHERE id = ?"
    ).bind(reason, orderId).run();
    await logOrderEvent(db, orderId, 'cancelled', 1, 'reason: ' + reason);

    // Restock items
    const orderItems = (() => { try { return JSON.parse(order.items || '[]'); } catch(e) { return []; } })();
    await restockOrder(db, orderItems);

    // WhatsApp cancellation notification
    if (order.phone) {
      const orderForWa = {
        id: order.id, name: order.name, email: order.email, phone: order.phone,
        items: orderItems, totalPaise: order.total, paymentMethod: order.payment_method,
      };
      const waJob = sendWhatsAppMessage(env, order.phone, 'order_cancelled_update',
        [order.name || 'Customer', orderProductLabel(orderForWa), order.id]
      ).then(r => logOrderEvent(db, orderId, 'whatsapp_cancelled', r && r.sent ? 1 : 0, r && r.sent ? 'msgId ' + r.msgId : (r && r.error) || 'unknown'))
       .catch(() => {});
      if (context.waitUntil) context.waitUntil(waJob);
    }

    return json({ success: true, order_id: orderId, status: 'cancelled', reason });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
