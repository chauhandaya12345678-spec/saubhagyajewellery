/**
 * Saubhagya – Magic Checkout: Shipping Info API
 * Called DIRECTLY by Razorpay's checkout iframe (browser → this URL),
 * NOT by our own frontend. Must stay publicly accessible with no auth —
 * that is a Razorpay Magic Checkout requirement, not an oversight.
 *
 * GET/POST /api/magic-checkout/shipping-info
 * Razorpay sends: { order_id, razorpay_order_id, email, contact, addresses: [{id, zipcode, state_code, country}] }
 * We return per-address serviceability + fees. Site policy today:
 *   - Ships everywhere in India (free insured shipping, price already includes it)
 *   - COD is disabled site-wide (see checkout.html payment section)
 * so every address is serviceable, shipping_fee = 0, cod = false.
 * Update this file the day COD or paid shipping zones come back.
 */
export async function onRequest(context) {
  const { request } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  let payload = {};
  try {
    if (request.method === 'POST') {
      payload = await request.json();
    } else {
      const url = new URL(request.url);
      const addrParam = url.searchParams.get('addresses');
      payload = { addresses: addrParam ? JSON.parse(addrParam) : [] };
      // Some integrations send GET with a JSON body despite convention — try that too.
      if (!payload.addresses.length) {
        try { payload = await request.json(); } catch (e) {}
      }
    }
  } catch (e) {
    payload = {};
  }

  const addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
  const result = addresses.map(a => ({
    id: a.id,
    zipcode: a.zipcode,
    country: a.country || 'IN',
    shipping_methods: [
      {
        id: 'standard',
        name: 'Standard Insured Shipping',
        description: 'Free insured shipping, 2-8 business days depending on location',
        serviceable: true,
        shipping_fee: 0,
        cod: false,
        cod_fee: 0,
      },
    ],
  }));

  return new Response(JSON.stringify({ addresses: result }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
