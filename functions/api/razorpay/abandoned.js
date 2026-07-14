/**
 * Saubhagya – Razorpay Magic Checkout Abandoned Cart Webhook
 * POST /api/razorpay/abandoned
 *
 * Razorpay sends abandoned checkout data here when a user starts
 * Magic Checkout but doesn't complete payment. Store for retargeting.
 *
 * Body: { event, payload: { abandonment: { ... } } }
 * Returns: { ok: true }
 */
export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const event = body.event || '';
    const data = body.payload || {};

    // Log for debugging — future: store in D1 for retargeting
    console.log('[abandoned]', event, JSON.stringify(data).slice(0, 500));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
