/**
 * POST /api/admin/resend-whatsapp
 * Body: { order_id, template? }
 * Owner-only. Manually (re)sends a WhatsApp template for an order — for
 * cases like the webhook-fallback gap where confirm_order never fired.
 * Defaults to 'confirm_order'; pass template: 'order_shipped' etc to resend
 * a status message instead.
 */
import { verifyAdminAccess, adminCorsHeaders, sendWhatsAppMessage, logOrderEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: true });
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const orderId = String(body.order_id || '').trim();
  const template = String(body.template || 'confirm_order').trim();
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const db = env.DB;
    const order = await db.prepare('SELECT id, name, phone, track_token FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!order.phone) {
      return new Response(JSON.stringify({ error: 'Order has no phone number on file' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let trackToken = order.track_token;
    if (!trackToken) {
      trackToken = crypto.randomUUID().slice(0, 8);
      await db.prepare('UPDATE orders SET track_token = ? WHERE id = ?').bind(trackToken, orderId).run();
    }

    const result = await sendWhatsAppMessage(env, order.phone, template,
      [order.name || 'Customer', orderId, 'https://saubhagyajewellery.com/track-orders.html?order_id=' + orderId + '&token=' + trackToken]
    );
    await logOrderEvent(db, orderId, 'whatsapp_sent', result.sent ? 1 : 0, result.sent ? 'msgId ' + result.msgId + ' (manual resend)' : (result.error || 'unknown') + ' (manual resend)');

    return new Response(JSON.stringify({ success: result.sent, error: result.sent ? undefined : result.error }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
