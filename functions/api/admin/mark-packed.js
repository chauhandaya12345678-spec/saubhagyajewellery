/**
 * POST /api/admin/mark-packed
 * Body: { order_id }
 * Header: x-admin-key: <ADMIN_KEY env var>
 * Marks an order 'packed' — the warehouse-side signal that the SKU is
 * physically boxed, ahead of ShipPrime pickup. Only valid from 'confirmed'.
 */
import { verifyAdminAccess, adminCorsHeaders, logOrderEvent, pushToShipPrime, recordShipprimeResult, sendWhatsAppMessage, orderProductLabel, sendInvoiceEmail } from '../_lib.js';
import { issueDocNumber } from './_docs.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders(request);

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

    // Fetch full order data for ShipPrime push + WhatsApp
    const fullOrder = await db.prepare(
      `SELECT id, name, email, phone, address, items, total, payment_method, test_mode,
              track_token, created_at, invoice_no, invoice_date, credit_note_no
         FROM orders WHERE id = ?`
    ).bind(orderId).first();
    if (!fullOrder) {
      return new Response(JSON.stringify({ error: 'Order data not found after update' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const orderItems = (() => { try { return JSON.parse(fullOrder.items || '[]'); } catch(e) { return []; } })();
    const orderAddr = (() => { try { return JSON.parse(fullOrder.address || '{}'); } catch(e) { return {}; } })();

    // Push to ShipPrime now that the order is physically packed
    const orderForShipPrime = {
      id: fullOrder.id,
      name: fullOrder.name || 'Guest',
      email: fullOrder.email || '',
      phone: fullOrder.phone || '',
      address: orderAddr,
      items: orderItems,
      totalPaise: fullOrder.total || 0,
      paymentMethod: fullOrder.payment_method || 'razorpay',
    };
    const shipprimeResult = await pushToShipPrime(env, orderForShipPrime, db);
    await recordShipprimeResult(db, orderId, shipprimeResult);
    await logOrderEvent(db, orderId, 'shipprime_pushed', shipprimeResult.pushed ? 1 : 0,
      shipprimeResult.pushed ? ('awb=' + (shipprimeResult.awb || '') + ',courier=' + (shipprimeResult.courier || '')) : (shipprimeResult.error || 'failed'));

    // WhatsApp: notify customer that order is shipped
    if (shipprimeResult.pushed && fullOrder.phone) {
      const waJob = sendWhatsAppMessage(env, fullOrder.phone, 'order_shipped',
        [fullOrder.name || 'Customer', orderProductLabel(orderForShipPrime), fullOrder.id]
      ).then(r => logOrderEvent(db, orderId, 'whatsapp_shipped', r && r.sent ? 1 : 0, r && r.sent ? 'msgId ' + r.msgId : (r && r.error) || 'unknown'))
       .catch(() => {});
      if (context.waitUntil) context.waitUntil(waJob);
    }

    // Legal tax invoice: assign the FY-sequenced number now (at dispatch/removal,
    // per GST Sec 31) and email the customer a secure link to the invoice page.
    let invoiceNo = null;
    if (shipprimeResult.pushed) {
      try {
        const issued = await issueDocNumber(env, {
          id: fullOrder.id, created_at: fullOrder.created_at,
          invoice_no: fullOrder.invoice_no, invoice_date: fullOrder.invoice_date,
          credit_note_no: fullOrder.credit_note_no,
        }, 'invoice');
        invoiceNo = issued.number;
        await logOrderEvent(db, orderId, 'invoice_issued', 1, invoiceNo);
        if (fullOrder.email && fullOrder.track_token) {
          const origin = new URL(request.url).origin;
          const invoiceUrl = `${origin}/invoice?order=${encodeURIComponent(fullOrder.id)}&t=${encodeURIComponent(fullOrder.track_token)}`;
          const mailJob = sendInvoiceEmail(env, { id: fullOrder.id, name: fullOrder.name, email: fullOrder.email }, invoiceNo, invoiceUrl)
            .then(r => logOrderEvent(db, orderId, 'invoice_email', r && r.sent ? 1 : 0, r && r.sent ? ('id ' + (r.id || 'mock')) : (r && r.error) || 'unknown'))
            .catch(() => {});
          if (context.waitUntil) context.waitUntil(mailJob);
        }
      } catch (e) {
        await logOrderEvent(db, orderId, 'invoice_issued', 0, String(e.message || e)).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: orderId,
      status: 'packed',
      invoice_no: invoiceNo,
      shipprime: { pushed: shipprimeResult.pushed, awb: shipprimeResult.awb || null, courier: shipprimeResult.courier || null },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
