/**
 * Saubhagya – Create Razorpay Order (Server-side)
 * POST /api/orders/create-razorpay-order
 *
 * Creates a Razorpay Order with auto-capture so the payment is captured the
 * moment it succeeds (no authorized-then-auto-refund limbo). Customer/cart
 * details go into order notes so the webhook can rebuild the order if the
 * browser never reports back.
 *
 * Body: { amount (paise), currency, cart, name, email, phone, address, address_json, test_mode, magic? }
 * Returns: { id: 'order_...', amount, currency, key_id }
 *
 * `magic: true` (only sent when window.CC_PAYMENTS.useMagicCheckout is on —
 * see checkout.html) additionally sends line_items_total + line_items,
 * which Razorpay requires to treat the order as a Magic Checkout order
 * instead of Standard Checkout. Requires each cart line to carry an
 * `image` URL (checkout.html includes this only when magic mode is on).
 *
 * IMPORTANT — Magic Checkout prerequisite: this order shape only matters
 * once Razorpay has manually enabled Magic Checkout on this account (raise
 * a request with your Razorpay SPOC/support — it is not a self-serve
 * toggle). Until then, useMagicCheckout stays false and this file behaves
 * exactly as before.
 */
import { computeExpectedTotalPaise } from '../_lib.js';

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
    const { amount, currency, cart, name, email, phone, address, address_json, test_mode, magic } = await request.json();
    if (!amount || amount <= 0) return json({ error: 'Invalid amount' }, 400);

    // Never trust the client-declared amount — recompute from real D1 prices.
    // Without this, editing the request (devtools, curl) lets anyone pay any
    // amount they want for a cart worth far more. Checked unconditionally —
    // `test_mode` is a client-supplied bookkeeping flag, not a real Razorpay
    // sandbox switch (the key used below is always rzp_live_...), so it must
    // never be allowed to skip this check.
    const expected = await computeExpectedTotalPaise(env.DB, cart || [], 'razorpay');
    if (expected !== Number(amount)) {
      return json({ error: 'Cart total does not match current pricing. Please refresh and try again.' }, 400);
    }

    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return json({ error: 'Razorpay not configured: RAZORPAY_KEY_SECRET secret missing on Pages project' }, 500);

    const keyId = env.RAZORPAY_KEY_ID || 'rzp_live_T6EhbHB5QhrM5W';
    const auth = btoa(`${keyId}:${keySecret}`);
    const receipt = 'CC-' + Date.now().toString(36).toUpperCase();

    const orderBody = {
      amount,
      currency: currency || 'INR',
      receipt,
      payment_capture: 1,
      notes: {
        cart: JSON.stringify(cart || []).slice(0, 512),
        shipping_address: String(address || '').slice(0, 256),
        address_json: JSON.stringify(address_json || {}).slice(0, 512),
        customer_name: name || '',
        customer_email: email || '',
        customer_phone: phone || '',
        test_mode: test_mode ? '1' : '0',
      },
    };

    // Magic Checkout order shape — only attached when explicitly requested.
    // NOTE: line_items_total must equal the sum of offer_price*quantity and
    // must match `amount` when there's no separate shipping/COD fee baked
    // into the Razorpay order. This site's pricing already includes
    // shipping in each item's price, so amount === line_items_total holds
    // as long as no discount is applied client-side; re-verify this the
    // moment a real discount/coupon flows through once Magic Checkout is
    // approved and testable — it was NOT possible to test end-to-end here.
    if (magic && Array.isArray(cart) && cart.length) {
      orderBody.line_items_total = amount;
      orderBody.line_items = cart.map(l => ({
        sku: String(l.id),
        variant_id: String(l.id), // single-variant catalog: SKU doubles as variant_id
        price: Math.round((l.price || 0) * 100),
        offer_price: Math.round((l.price || 0) * 100),
        quantity: l.qty || 1,
        name: l.name || String(l.id),
        image_url: l.image ? (String(l.image).startsWith('http') ? l.image : 'https://saubhagyajewellery.com/' + String(l.image).replace(/^\/+/, '')) : undefined,
      }));
    }

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      return json({ error: 'Razorpay order failed', details: errText }, 502);
    }

    const orderData = await razorpayRes.json();
    return json({
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      key_id: keyId,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
