/**
 * Saubhagya – Magic Checkout: Shipping Info API
 * Called by Razorpay during Magic Checkout pincode entry.
 * Response MUST include shipping_methods array (Razorpay requirement).
 *
 * GET/POST /api/magic-checkout/shipping-info
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
      if (!addresses.length) {
        try { const p = await request.json(); addresses = Array.isArray(p.addresses) ? p.addresses : []; } catch (e) {}
      }
    }
  } catch (e) { addresses = []; }

  const result = addresses.map(a => ({
    id: a.id || '0',
    serviceability: true,
    cod: false,
    shipping_methods: [{
      id: 'free_standard',
      name: 'Standard Delivery',
      shipping_fee: 0,
    }],
  }));

  return new Response(JSON.stringify({ addresses: result }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}
