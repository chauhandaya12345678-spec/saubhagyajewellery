/**
 * Saubhagya – Razorpay Webhook (server-side backstop)
 * POST /api/razorpay/webhook
 *
 * Handles:
 *   `payment.captured`: if browser never called /api/orders/save (tab closed,
 *     network drop), the order is rebuilt here from Razorpay notes.
 *   `order.paid` (NEW): fires AFTER Magic Checkout captures the shipping address.
 *     We UPDATE the existing order with the real address + push to ShipPrime.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://saubhagyajewellery.com/api/razorpay/webhook
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, order.paid
 */
import { hmacSha256Hex, pushToShipPrime, recordShipprimeResult, sendOrderEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'RAZORPAY_WEBHOOK_SECRET not configured' }, 501);

  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const expected = await hmacSha256Hex(secret, raw);
  if (expected !== signature) return json({ error: 'Invalid signature' }, 401);

  try {
    const event = JSON.parse(raw);
    const db = env.DB;

    // ═══ order.paid — Magic Checkout address fix ═══
    // This event fires AFTER payment with the full order object including
    // customer_details.shipping_address that Magic Checkout captured.
    if (event.event === 'order.paid') {
      const o = event.payload.order.entity;
      const cd = o.customer_details || {};
      const shipAddr = cd.shipping_address || {};

      // Build address from Magic Checkout order
      let address = {};
      if (shipAddr.street1 || shipAddr.line1 || shipAddr.city) {
        address = {
          street: shipAddr.street1 || shipAddr.line1 || '',
          apt: shipAddr.street2 || shipAddr.line2 || '',
          city: shipAddr.city || '',
          state: shipAddr.state || '',
          pin: shipAddr.zipcode || shipAddr.pincode || '',
        };
      } else {
        // No address in order.paid — nothing to update
        return json({ ok: true, event: 'order.paid', note: 'no address in payload' });
      }

      // Update existing order's address if it was empty
      const notes = o.notes || {};
      // order.paid webhook: payment is at event.payload.payment.entity
      const paymentEntity = event.payload.payment?.entity || {};
      const paymentId = notes.payment_id || paymentEntity.id || '';
      if (!paymentId) return json({ ok: true, event: 'order.paid', note: 'no payment_id' });

      const existing = await db.prepare('SELECT id, address, items, shipprime_awb, total FROM orders WHERE razorpay_payment_id = ?')
        .bind(paymentId).first().catch(() => null);
      if (!existing) return json({ ok: true, event: 'order.paid', note: 'order not found (browser save.js already saved?)' });

      // Only update if address was empty
      let addrStr = '';
      try { addrStr = existing.address || ''; if (typeof addrStr === 'string') { const a = JSON.parse(addrStr); if (Object.keys(a).length > 0 && a.pin) addrStr = 'has_address'; } } catch (e) {}
      if (addrStr === 'has_address') {
        return json({ ok: true, event: 'order.paid', order_id: existing.id, note: 'address already present, skipping' });
      }

      const addressJson = JSON.stringify(address);
      await db.prepare('UPDATE orders SET address = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(addressJson, existing.id).run();

      // Push to ShipPrime now that we have the address
      if (!existing.shipprime_awb) {
        // Validate pincode before pushing (same logic as save.js)
        const pin = String(address.pin || '').replace(/\D/g, '');
        if (pin.length !== 6) {
          return json({ ok: true, event: 'order.paid', order_id: existing.id,
            address_updated: true, shipprime: { pushed: false, error: 'invalid pincode: ' + (address.pin || 'empty') } });
        }
        // Parse items from existing order
        let orderItems = [];
        if (existing.items) {
          try { orderItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items; } catch (e) {}
        }
        const orderForPush = {
          id: existing.id,
          name: cd.name || notes.customer_name || 'Guest',
          email: cd.email || notes.customer_email || '',
          phone: cd.contact || notes.customer_phone || '',
          address: addressJson,
          items: orderItems,
          totalPaise: o.amount || existing.total || 0,
          paymentMethod: 'razorpay',
        };
        const sp = await pushToShipPrime(env, orderForPush);
        if (sp.pushed) {
          await db.prepare('UPDATE orders SET shipprime_awb = ?, shipprime_order_id = ?, name = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .bind(sp.awb || '', sp.shipPrimeOrderId || '', cd.name || notes.customer_name || 'Guest', existing.id).run();
        }
        return json({ ok: true, event: 'order.paid', order_id: existing.id, address_updated: true, shipprime: sp });
      }

      return json({ ok: true, event: 'order.paid', order_id: existing.id, address_updated: true });
    }

    // ═══ payment.captured — backstop save ═══
    if (event.event !== 'payment.captured') {
      return json({ ok: true, ignored: event.event });
    }

    const p = event.payload.payment.entity;

    const existing = await db.prepare('SELECT id FROM orders WHERE razorpay_payment_id = ?').bind(p.id).first().catch(() => null);
    if (existing) return json({ ok: true, order_id: existing.id, duplicate: true });

    const notes = p.notes || {};
    let items = [];
    try { items = JSON.parse(notes.cart || '[]'); } catch (e) {}

    // Build address — try multiple sources
    let addressObj = {};
    if (notes.address_json) {
      try { addressObj = JSON.parse(notes.address_json); } catch (e) {}
    } else if (notes.shipping_address) {
      addressObj = { street: notes.shipping_address };
    }
    // Also check payment.shipping_address (Magic Checkout puts address here)
    if (!addressObj.pin && !addressObj.street && p.shipping_address) {
      const sa = p.shipping_address;
      addressObj = {
        street: sa.street1 || sa.line1 || '',
        city: sa.city || '',
        state: sa.state || '',
        pin: sa.zipcode || sa.pincode || '',
      };
    }
    const addressJson = JSON.stringify(addressObj);
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

    let sp; // ShipPrime result
    if (!isTest) {
      const orderForPush = {
        id: orderId,
        name: notes.customer_name || 'Guest',
        email: notes.customer_email || p.email || '',
        phone: notes.customer_phone || p.contact || '',
        address: addressJson,
        items,
        totalPaise: p.amount,
        paymentMethod: 'razorpay',
      };
      sp = await Promise.race([
        pushToShipPrime(env, orderForPush),
        new Promise(res => setTimeout(() => res({ pushed: false, error: 'timeout (ShipPrime >22s)' }), 22000)),
      ]).catch(e => ({ pushed: false, error: 'push exception: ' + e.message }));

      if (sp && sp.pushed) {
        await db.prepare('UPDATE orders SET shipprime_awb = ?, shipprime_order_id = ?, name = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(sp.awb || '', sp.shipPrimeOrderId || '', notes.customer_name || 'Guest', orderId).run();
      }

      const emailJob = sendOrderEmail(env, {
        id: orderId, name: notes.customer_name || 'Guest',
        email: notes.customer_email || p.email || '',
        phone: notes.customer_phone || p.contact || '',
        address: addressJson, items,
        totalPaise: p.amount, paymentMethod: 'razorpay',
      });
      if (context.waitUntil) context.waitUntil(emailJob); else await emailJob;
    }

    return json({ ok: true, order_id: orderId, shipprime: sp || { pushed: false } });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
