/**
 * Saubhagya – Magic Checkout: Shipping Info API
 * Razorpay calls this during Magic Checkout to check pincode serviceability.
 *
 * CRITICAL: Must echo back exact address 'id' from request.
 * Must return shipping_methods array (Razorpay schema requirement).
 *
 * GET/POST /api/magic-checkout/shipping-info
 */
export async function onRequest(context) {
  const { request } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Log incoming request for debugging
  console.log('[shipping-info] method:', request.method, 'url:', request.url);

  let addresses = [];
  try {
    if (request.method === 'POST') {
      const rawText = await request.text();
      console.log('[shipping-info] raw payload:', rawText.slice(0, 1000));
      const payload = JSON.parse(rawText);
      addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
    } else {
      const url = new URL(request.url);
      const raw = url.searchParams.get('addresses');
      if (raw) { try { addresses = JSON.parse(raw); } catch (e) {} }
    }
  } catch (e) {
    console.error('[shipping-info] parse error:', e.message);
    addresses = [];
  }

  console.log('[shipping-info] addresses count:', addresses.length);

  // Map every address — echo exact ID back (Razorpay crashes if ID mismatches)
  const result = addresses.map(a => ({
    id: a.id,
    serviceable: true,
    shipping_fee: 0,
    cod: false,
    cod_fee: 0,
    shipping_methods: [{
      id: 'standard',
      name: 'Standard Delivery',
      shipping_fee: 0,
    }],
  }));

  console.log('[shipping-info] response:', JSON.stringify({ addresses: result }).slice(0, 500));

  return new Response(JSON.stringify({ addresses: result }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}
