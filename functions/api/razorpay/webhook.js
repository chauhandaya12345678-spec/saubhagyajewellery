/**
 * Saubhagya – Razorpay Webhook (server-side backstop)
 * POST /api/razorpay/webhook
 *
 * Handles `payment.captured`: if the browser never called /api/orders/save
 * (tab closed, network drop), the order is rebuilt here from the Razorpay
 * order notes and saved + pushed to Shiprocket. Idempotent on payment id.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://saubhagyajewellery.com/api/razorpay/webhook
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET
 *   Event:  payment.captured
 */
import { hmacSha256Hex, pushToShiprocket, recordShiprocketResult, sendOrderEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'RAZORPAY_WEBHOOK_SECRET not configured' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const expected = await hmacSha256Hex(secret, raw);
  if (expected !== signature) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const event = JSON.parse(raw);
    if (event.event !== 'payment.captured') {
      return new Response(JSON.stringify({ ok: true, ignored: event.event }), { headers: { 'Content-Type': 'application/json' } });
    }

    const p = event.payload.payment.entity;
    const db = env.DB;

    const existing = await db.prepare('SELECT id FROM orders WHERE razorpay_payment_id = ?').bind(p.id).first().catch(() => null);
    if (existing) {
      return new Response(JSON.stringify({ ok: true, order_id: existing.id, duplicate: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const notes = p.notes || {};
    let items = [];
    try { items = JSON.parse(notes.cart || '[]'); } catch (e) {}
    let addressJson = notes.address_json || '';
    if (!addressJson) addressJson = JSON.stringify({ street: notes.shipping_address || '' });
    const isTest = notes.test_mode === '1' ? 1 : 0;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderId = `CC-${dateStr}-${rand}`;

    try {
      await db.prepare(
        `INSERT INTO orders (id, user_id, email, phone, name, items, total, subtotal, discount, address,
                             razorpay_payment_id, razorpay_order_id, payment_method, test_mode, status)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'razorpay', ?, 'confirmed')`
      ).bind(
        orderId, notes.customer_email || p.email || null, notes.customer_phone || p.contact || null,
        notes.customer_name || 'Guest', JSON.stringify(items), p.amount, p.amount,
        addressJson, p.id, p.order_id || null, isTest
      ).run();
    } catch (e) {
      if (!/no such column/i.test(e.message)) throw e;
      await db.prepare(
        `INSERT INTO orders (id, user_id, email, phone, name, items, total, subtotal, discount, address, razorpay_payment_id, status)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'confirmed')`
      ).bind(
        orderId, notes.customer_email || p.email || null, notes.customer_phone || p.contact || null,
        notes.customer_name || 'Guest', JSON.stringify(items), p.amount, p.amount, addressJson, p.id
      ).run();
    }

    let shiprocket = { pushed: false, error: 'skipped (test mode)' };
    if (!isTest) {
      shiprocket = await pushToShiprocket(env, {
        id: orderId,
        name: notes.customer_name || 'Guest',
        email: notes.customer_email || p.email || '',
        phone: notes.customer_phone || p.contact || '',
        address: addressJson,
        items,
        totalPaise: p.amount,
        paymentMethod: 'razorpay',
      });
      await recordShiprocketResult(db, orderId, shiprocket);

      // Backstop path also sends the confirmation email (browser never called save)
      const emailJob = sendOrderEmail(env, {
        id: orderId,
        name: notes.customer_name || 'Guest',
        email: notes.customer_email || p.email || '',
        phone: notes.customer_phone || p.contact || '',
        address: addressJson,
        items,
        totalPaise: p.amount,
        paymentMethod: 'razorpay',
      });
      if (context.waitUntil) context.waitUntil(emailJob); else await emailJob;
    }

    return new Response(JSON.stringify({ ok: true, order_id: orderId, shiprocket }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    // Return 500 so Razorpay retries the delivery later.
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
