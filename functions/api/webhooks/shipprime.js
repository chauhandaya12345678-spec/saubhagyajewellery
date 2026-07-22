/**
 * ShipPrime Webhook — real-time order status updates
 * POST /api/webhooks/shipprime
 *
 * ShipPrime sends status changes (SHIPPED, OUT_FOR_DELIVERY, DELIVERED, etc.)
 * We update the D1 order status + updated_at so the track-orders page
 * always shows the latest status without polling ShipPrime API.
 *
 * Set webhook URL in ShipPrime dashboard:
 *   https://saubhagyajewellery.com/api/webhooks/shipprime
 */
import { logOrderEvent, sendWhatsAppMessage, restockOrder } from '../_lib.js';

// Matches ShipPrime's real vocabulary (see SP_LABELS in account.html):
// CONFIRMED, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, UNDELIVERED,
// RTO_INITIATED, RTO, CANCELLED, LOST. Only restock on the final 'rto' —
// the piece is physically back with you by then. RTO_INITIATED means it's
// still in transit back (nothing to restock yet); LOST means the courier
// never returned it (restocking would let you oversell a piece you don't have).
const RTO_STATUSES = ['rto'];

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const db = env.DB;

    // ShipPrime webhook payload: { awb, currentStatus, statusDate, courier, ... }
    const awb = String(body.awb || body.awb_code || '').trim();
    const newStatus = String(body.currentStatus || body.status || '').trim();
    const statusDate = body.statusDate || body.status_date || new Date().toISOString();

    if (!awb) return json({ error: 'Missing AWB' }, 400);
    if (!newStatus) return json({ error: 'Missing status' }, 400);

    // Find order by AWB
    const order = await db.prepare(
      'SELECT id, phone, name, items, track_token, status, updated_at FROM orders WHERE shipprime_awb = ?'
    ).bind(awb).first().catch(() => null);

    if (!order) {
      return json({ ok: true, note: 'no matching order for AWB ' + awb });
    }

    // Don't update if status hasn't changed
    if (order.status === newStatus.toLowerCase()) {
      return json({ ok: true, note: 'status unchanged', order_id: order.id });
    }

    // Update order status
    const newStatusLower = newStatus.toLowerCase();
    await db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newStatusLower, order.id).run();

    // Log the event
    try {
      await logOrderEvent(db, order.id, 'shipprime_webhook', 1,
        `Status: ${order.status} → ${newStatusLower} (AWB: ${awb})`
      );
    } catch (e) {}

    // RTO (return to origin): courier failed delivery and sent it back —
    // restock the SKUs so they go back on sale automatically. Guarded on the
    // previous status so a repeat webhook for the same RTO state (couriers
    // often fire several) never double-restocks.
    if (RTO_STATUSES.includes(newStatusLower) && !RTO_STATUSES.includes(order.status)) {
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        await restockOrder(db, items);
        await logOrderEvent(db, order.id, 'rto_restock', 1, `Restocked ${items.length} line item(s) on RTO`);
      } catch (e) { /* best-effort — never fail the webhook over this */ }
    }

    // Send WhatsApp notification to customer (gracefully skip if templates not ready)
    if (order.phone && ['shipped','out_for_delivery','delivered'].includes(newStatus.toLowerCase())) {
      const templateName = newStatus.toLowerCase() === 'shipped' ? 'order_shipped'
        : newStatus.toLowerCase() === 'out_for_delivery' ? 'order_out_for_delivery'
        : 'order_delivered';
      try {
        const token = order.track_token || order.phone || '';
        const wa = await sendWhatsAppMessage(env, order.phone, templateName,
          [order.name || 'Customer', order.id, 'https://saubhagyajewellery.com/track-orders.html?order_id=' + order.id + '&token=' + token]
        );
        if (!wa.sent) {
          console.log('WA_DEBUG: template', templateName, 'not sent —', wa.error, '(create templates in Meta dashboard)');
        }
      } catch (e) { console.log('WA_DEBUG: error', e.message); }
    }

    return json({
      ok: true,
      order_id: order.id,
      awb,
      previous: order.status,
      current: newStatus.toLowerCase(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
