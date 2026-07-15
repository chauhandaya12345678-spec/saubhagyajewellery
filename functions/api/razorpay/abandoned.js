/**
 * Saubhagya – Razorpay Magic Checkout Abandoned Cart Webhook
 * POST /api/razorpay/abandoned
 *
 * Razorpay sends abandoned checkout data here when a user starts
 * Magic Checkout but doesn't complete payment. Store for retargeting.
 */
export async function onRequest(context) {
  const { request } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const body = await request.json();
    const event = body.event || '';
    const data = body.payload || {};

    console.log('[abandoned]', event, JSON.stringify(data).slice(0, 500));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
