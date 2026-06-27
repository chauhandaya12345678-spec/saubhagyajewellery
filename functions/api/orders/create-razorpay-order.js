/**
 * Saubhagya – Create Razorpay Order (Server-side)
 * POST /api/orders/create-razorpay-order
 * 
 * This creates a Razorpay Order so Shiprocket channel integration
 * can auto-import it and generate AWB + SMS + Email.
 * 
 * Body: { amount: number (paise), currency: 'INR', cart: array }
 * Returns: { id: 'order_...', amount, currency }
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { amount, currency, cart } = await request.json();
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return new Response(JSON.stringify({ error: 'Razorpay not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const keyId = 'rzp_live_T6EhbHB5QhrM5W';
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
        notes: { cart: JSON.stringify(cart || []) },
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      return new Response(JSON.stringify({ error: 'Razorpay order failed', details: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const orderData = await razorpayRes.json();
    return new Response(JSON.stringify({
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
