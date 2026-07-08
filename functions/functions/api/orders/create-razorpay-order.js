/**
 * Saubhagya – Create Razorpay Order (Server-side)
 * POST /api/orders/create-razorpay-order
 *
 * Creates a Razorpay Order with auto-capture so the payment is captured the
 * moment it succeeds (no authorized-then-auto-refund limbo). Customer/cart
 * details go into order notes so the webhook can rebuild the order if the
 * browser never reports back.
 *
 * Body: { amount (paise), currency, cart, name, email, phone, address, address_json, test_mode }
 * Returns: { id: 'order_...', amount, currency, key_id }
 */
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
    const { amount, currency, cart, name, email, phone, address, address_json, test_mode } = await request.json();
    if (!amount || amount <= 0) return json({ error: 'Invalid amount' }, 400);

    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return json({ error: 'Razorpay not configured: RAZORPAY_KEY_SECRET secret missing on Pages project' }, 500);

    const keyId = env.RAZORPAY_KEY_ID || 'rzp_live_T6EhbHB5QhrM5W';
    const auth = btoa(`${keyId}:${keySecret}`);
    const receipt = 'CC-' + Date.now().toString(36).toUpperCase();

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
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
