/**
 * Saubhagya – Save Order API (after Razorpay payment success, or COD)
 * POST /api/orders/save
 * Body: {
 *   razorpay_payment_id, razorpay_order_id?, razorpay_signature?,
 *   items, total, subtotal, discount,           // amounts in paise
 *   name, email, phone, address (JSON string or object),
 *   payment_method: 'razorpay' | 'cod',
 *   test_mode: bool,
 *   create_account: bool (auto-create user account for guest)
 * }
 * Returns: { success: true, order_id, user_id?, session_token?, shipprime? }
 *
 * Flow: verify signature (when order id present) → save to D1 (idempotent on
 * payment id) → push to ShipPrime order (skipped for tests).
 */
import { hmacSha256Hex, hashPassword, pushToShipPrime, recordShipprimeResult, normEmail, normPhone, sendOrderEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const {
      razorpay_payment_id, razorpay_order_id, razorpay_signature,
      items, total, subtotal, discount, name, address,
      create_account, test_mode, payment_method,
    } = body;
    const email = normEmail(body.email);
    const phone = normPhone(body.phone);

    if (!razorpay_payment_id || !items || total === undefined) {
      return json({ error: 'Missing required fields: razorpay_payment_id, items, total' }, 400);
    }

    // COD is disabled site-wide as of 2026-07-11. Reject any COD orders at the API
    // boundary even if a stale client tab tries to submit one — protects ShipPrime pipeline
    // pipeline from unverified pickups.
    if (payment_method === 'cod') {
      return json({ error: 'Cash on Delivery is temporarily unavailable. Please pay online.' }, 400);
    }

    // Verify the Razorpay signature whenever the payment went through an Order.
    // When RAZORPAY_KEY_SECRET is configured (always in production), we REQUIRE
    // both order_id and signature — rejecting without them prevents forged orders.
    let paymentVerified = false;
    if (env.RAZORPAY_KEY_SECRET) {
      if (!razorpay_order_id || !razorpay_signature) {
        return json({ error: 'Missing payment verification data (order_id and signature required)' }, 400);
      }
      const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
      if (expected !== razorpay_signature) {
        return json({ error: 'Payment signature verification failed' }, 400);
      }
      paymentVerified = true;
    }

    const db = env.DB;

    // Idempotency: same payment id → return the already-saved order.
    const dupe = await db.prepare('SELECT id FROM orders WHERE razorpay_payment_id = ?')
      .bind(razorpay_payment_id).first().catch(() => null);
    if (dupe) return json({ success: true, order_id: dupe.id, duplicate: true });

    // Generate order ID like CC-20260708-A7X3
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderId = `CC-${dateStr}-${rand}`;

    // Get or create user
    let userId = null;
    let sessionToken = null;

    if (email || phone) {
      const identifier = email || phone;
      let existingUser = null;
      if (email) {
        existingUser = await db.prepare('SELECT id, name FROM users WHERE lower(email) = ?').bind(email).first();
      }
      if (!existingUser && phone) {
        existingUser = await db.prepare('SELECT id, name FROM users WHERE phone = ?').bind(phone).first();
      }

      if (existingUser) {
        userId = existingUser.id;
      } else if (create_account) {
        // is_guest=1 lets a later signup with the same email/phone claim this account
        const autoPwd = await hashPassword('guest_' + crypto.randomUUID());
        let newUser;
        try {
          newUser = await db.prepare(
            'INSERT INTO users (name, email, phone, password, is_guest) VALUES (?, ?, ?, ?, 1)'
          ).bind(name || 'Guest', email || null, phone || null, autoPwd).run();
        } catch (e) {
          if (!/no such column/i.test(e.message)) throw e;
          newUser = await db.prepare(
            'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)'
          ).bind(name || 'Guest', email || null, phone || null, autoPwd).run();
        }
        userId = newUser.meta.last_row_id;
      }

      if (userId) {
        sessionToken = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
        await db.prepare(
          'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
        ).bind(userId, sessionToken, identifier, name || 'Guest').run();
      }
    }

    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items);
    const addressJson = typeof address === 'string' ? address : JSON.stringify(address);
    const method = payment_method === 'cod' ? 'cod' : 'razorpay';
    const isTest = test_mode ? 1 : 0;

    try {
      await db.prepare(
        `INSERT INTO orders (id, user_id, email, phone, name, items, total, subtotal, discount, address,
                             razorpay_payment_id, razorpay_order_id, payment_method, test_mode, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
      ).bind(
        orderId, userId, email || null, phone || null, name || 'Guest',
        itemsJson, total, subtotal || total, discount || 0, addressJson,
        razorpay_payment_id, razorpay_order_id || null, method, isTest
      ).run();
    } catch (e) {
      if (!/no such column/i.test(e.message)) throw e;
      // Pre-migration schema fallback
      await db.prepare(
        `INSERT INTO orders (id, user_id, email, phone, name, items, total, subtotal, discount, address, razorpay_payment_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
      ).bind(
        orderId, userId, email || null, phone || null, name || 'Guest',
        itemsJson, total, subtotal || total, discount || 0, addressJson, razorpay_payment_id
      ).run();
    }

    // ShipPrime push MUST await before the response — Pages Functions kill
    // the isolate right after `return`, so waitUntil never actually runs on
    // free tier. Cap at 22s (safe under the 30s wall limit). Every attempt
    // is logged to order_events + shipprime_error is written to the order
    // row so /api/orders/retry-shipprime can sweep failures later.
    let shipprimeResult = { pushed: false, note: 'skipped (test mode)' };
    if (!isTest) {
      const orderForJobs = {
        id: orderId,
        name: name || 'Guest',
        email,
        phone: phone || '',
        address: addressJson,
        items: typeof items === 'string' ? JSON.parse(items) : items,
        totalPaise: total,
        paymentMethod: method,
      };

      // ── Validate shipping address before pushing to ShipPrime ──
      // A missing or short pincode causes ShipPrime to reject the order
      // and repeated retries lock the account. Skip push and store the
      // error so the admin can fix the address and retry manually.
      let addrCheck = addressJson;
      if (typeof addrCheck === 'string') { try { addrCheck = JSON.parse(addrCheck); } catch (e) { addrCheck = {}; } }
      addrCheck = addrCheck || {};
      const pin = String(addrCheck.pin || '').replace(/\D/g, '');
      if (pin.length !== 6) {
        shipprimeResult = { pushed: false, error: 'skipped — invalid pincode "' + (addrCheck.pin || '') + '" — update address in Razorpay and retry via /api/orders/retry-shipprime' };
        try { await recordShipprimeResult(db, orderId, shipprimeResult); } catch (e) {}
      } else {
        const srPromise = pushToShipPrime(env, orderForJobs);
      const capped = Promise.race([
        srPromise,
        new Promise(res => setTimeout(() => res({ pushed: false, error: 'timeout (ShipPrime >22s)' }), 22000)),
      ]);
      try {
        shipprimeResult = await capped;
      } catch (e) {
        shipprimeResult = { pushed: false, error: 'push exception: ' + e.message };
      }
      // Always record — success writes SR ids, failure writes reason for
      // manual/scheduled retry. Never throws.
      try { await recordShipprimeResult(db, orderId, shipprimeResult); } catch (e) {}

      // Order-confirmation email: try waitUntil first, but await inline as a
      // fallback so it also survives free-tier isolate termination.
      const emailJob = sendOrderEmail(env, orderForJobs).catch(() => {});
      if (context.waitUntil) context.waitUntil(emailJob);
      }  // end else (valid pincode — push to ShipPrime)
    }

    return json({
      success: true,
      order_id: orderId,
      user_id: userId,
      session_token: sessionToken,
      payment_verified: paymentVerified,
      shipprimeResult,
      message: `Order ${orderId} confirmed.`,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
