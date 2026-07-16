/**
 * Saubhagya – Fetch Customer Details from Razorpay
 * POST /api/razorpay/order-details
 *
 * After Magic Checkout payment, the client-side handler only receives
 * payment_id + order_id — no customer name/email/phone/address.
 * This endpoint fetches the full payment details from Razorpay's API
 * using the server-side key_secret, then returns customer info.
 *
 * Body: { razorpay_order_id, razorpay_payment_id }
 * Returns: { name, email, phone, address } or empty strings for unknowns.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...cors },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id } = body;
    if (!razorpay_payment_id) return json({ error: 'razorpay_payment_id required' }, 400);

    const keyId = env.RAZORPAY_KEY_ID || 'rzp_live_T6EhbHB5QhrM5W';
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return json({ error: 'Razorpay not configured' }, 500);

    const auth = btoa(keyId + ':' + keySecret);

    // Fetch payment details from Razorpay (includes email, contact)
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { 'Authorization': 'Basic ' + auth },
    });
    const payment = await payRes.json().catch(() => ({}));

    // Fetch order details (may include customer_details from Magic Checkout)
    let order = {};
    if (razorpay_order_id) {
      try {
        const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
          headers: { 'Authorization': 'Basic ' + auth },
        });
        order = await orderRes.json().catch(() => ({}));
      } catch (e) { /* order fetch is best-effort */ }
    }

    // Extract customer info
    const name = order.customer_details?.name
      || payment.notes?.customer_name
      || '';

    const email = payment.email
      || order.customer_details?.email
      || payment.notes?.customer_email
      || '';

    const phone = payment.contact
      || order.customer_details?.contact
      || payment.notes?.customer_phone
      || '';

    // Address: try order.customer_details → payment.shipping_address → notes
    let address = {};
    if (order.customer_details?.shipping_address) {
      const a = order.customer_details.shipping_address;
      address = {
        street: a.street1 || a.line1 || '',
        apt: a.street2 || a.line2 || '',
        city: a.city || '',
        state: a.state || '',
        pin: a.zipcode || a.pincode || '',
      };
    } else if (payment.shipping_address) {
      const a = payment.shipping_address;
      address = {
        street: a.street1 || a.line1 || '',
        city: a.city || '',
        state: a.state || '',
        pin: a.zipcode || a.pincode || '',
      };
    } else if (payment.notes?.address_json) {
      try { address = JSON.parse(payment.notes.address_json); } catch (e) {}
    } else if (payment.notes?.shipping_address) {
      address = { street: payment.notes.shipping_address };
    }

    return json({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).replace(/\D/g, '').slice(-10),
      address: JSON.stringify(address),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
