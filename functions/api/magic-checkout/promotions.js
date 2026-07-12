/**
 * Saubhagya – Magic Checkout: Get Promotions + Apply Promotion API
 * Called DIRECTLY by Razorpay's checkout iframe. Must stay publicly
 * accessible with no auth — Razorpay Magic Checkout requirement.
 *
 * GET/POST /api/magic-checkout/promotions
 *   List mode  (no `code` in payload):  { order_id, contact, email }
 *     → { promotions: [{ code, summary, description }] }
 *   Apply mode (payload has `code`):    { order_id, contact, email, code }
 *     → success: { promotion: { reference_id, code, type, value, value_type, description } }
 *     → failure: { error: { description } }
 *
 * Only one coupon exists today: WELCOME10 (10% off), mirroring the
 * client-side discount logic already in checkout.html. Add more here as
 * real promotions are created — this is the single source of truth once
 * Magic Checkout is live.
 */
const PROMOS = {
  WELCOME10: { summary: '10% off your first order', description: '10% off on total cart value', type: 'percentage', value: 1000 }, // value in basis-like unit per docs: percentage value 1000 = 10.00%? Verify against live docs before go-live.
};

export async function onRequest(context) {
  const { request } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  let payload = {};
  try {
    if (request.method === 'POST') payload = await request.json();
    else {
      const url = new URL(request.url);
      payload = { code: url.searchParams.get('code') || '', order_id: url.searchParams.get('order_id') || '' };
      if (!payload.code) { try { payload = await request.json(); } catch (e) {} }
    }
  } catch (e) { payload = {}; }

  const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json', ...cors } });

  if (payload.code) {
    const code = String(payload.code).trim().toUpperCase();
    const promo = PROMOS[code];
    if (!promo) return json({ error: { description: 'Invalid or expired coupon code.' } });
    return json({
      promotion: {
        reference_id: 'offer_' + code,
        code,
        type: promo.type,
        value: promo.value,
        description: promo.description,
      },
    });
  }

  const promotions = Object.keys(PROMOS).map(code => ({
    code,
    summary: PROMOS[code].summary,
    description: PROMOS[code].description,
  }));
  return json({ promotions });
}
