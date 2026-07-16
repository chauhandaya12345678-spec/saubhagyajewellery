/**
 * Saubhagya – Magic Checkout: Shipping Info API
 * Called DIRECTLY by Razorpay's servers during Magic Checkout pincode entry.
 *
 * GET/POST /api/magic-checkout/shipping-info
 * Razorpay sends: { order_id, addresses: [{id, zipcode}] }
 * We return: { addresses: [{ id, serviceability, shipping_fee, cod }] }
 *
 * Site policy: Free insured shipping across India, COD disabled.
 */
export async function onRequest(context) {
  const { request } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  let addresses = [];
  try {
    if (request.method === 'POST') {
      const payload = await request.json();
      addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
    } else {
      const url = new URL(request.url);
      const raw = url.searchParams.get('addresses');
      if (raw) { try { addresses = JSON.parse(raw); } catch (e) {} }
    }
  } catch (e) {
    addresses = [];
  }

  // Every pincode in India is serviceable with free shipping
  const result = addresses.map(a => ({
    id: a.id || '0',
    serviceability: true,
    shipping_fee: 0,
    cod: false,
  }));

  return new Response(JSON.stringify({ addresses: result }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}
