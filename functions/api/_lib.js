/**
 * Saubhagya – shared server helpers (not routed: underscore-prefixed files
 * are excluded from Pages Functions routing).
 *
 * Env vars used across the API:
 *   RAZORPAY_KEY_ID          public key id (falls back to the one in index.html)
 *   RAZORPAY_KEY_SECRET      required to create/verify Razorpay orders
 *   RAZORPAY_WEBHOOK_SECRET  required for /api/razorpay/webhook
 *   SHIPROCKET_EMAIL         Shiprocket API-user email  (Settings → API → Configure)
 *   SHIPROCKET_PASSWORD      Shiprocket API-user password
 *   SHIPROCKET_PICKUP_LOCATION  pickup nickname in Shiprocket (default "Primary")
 */

const enc = new TextEncoder();

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(message) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Passwords stored as "s256$<salt>$<hex>". Legacy rows may hold plaintext. */
export async function hashPassword(plain) {
  const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `s256$${salt}$${await sha256Hex(salt + plain)}`;
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== 'string') return false;
  if (stored.startsWith('s256$')) {
    const [, salt, hex] = stored.split('$');
    return (await sha256Hex(salt + plain)) === hex;
  }
  return stored === plain; // legacy plaintext row — caller should upgrade on success
}

/**
 * Push a confirmed order to Shiprocket as an ad-hoc (Custom channel) order.
 * The Shiprocket "Razorpay" channel only imports Magic Checkout orders, so a
 * standard-Checkout site must push orders itself via this API.
 *
 * order = { id, name, email, phone, address: {street,apt,city,state,pin} | string,
 *           items: [{id,name,price,qty}], totalPaise, paymentMethod: 'razorpay'|'cod' }
 * Returns { pushed, shiprocket_order_id?, shipment_id?, error? } — never throws.
 */
export async function pushToShiprocket(env, order) {
  try {
    const email = env.SHIPROCKET_EMAIL, password = env.SHIPROCKET_PASSWORD;
    if (!email || !password) return { pushed: false, error: 'SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not configured' };

    const loginRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const login = await loginRes.json().catch(() => ({}));
    if (!loginRes.ok || !login.token) {
      return { pushed: false, error: 'Shiprocket login failed: ' + (login.message || loginRes.status) };
    }

    let addr = order.address;
    if (typeof addr === 'string') { try { addr = JSON.parse(addr); } catch (e) { addr = { street: addr }; } }
    addr = addr || {};

    const fullName = (order.name || 'Guest').trim();
    const firstName = fullName.split(/\s+/)[0] || 'Guest';
    const lastName = fullName.split(/\s+/).slice(1).join(' ') || '.';
    const phone10 = String(order.phone || '').replace(/\D/g, '').slice(-10);
    const street = [addr.street, addr.apt].filter(Boolean).join(', ') || 'NA';

    const items = (order.items || []).map(l => ({
      name: l.name || l.id || 'Jewellery item',
      sku: String(l.id || l.sku || 'SKU'),
      units: l.qty || 1,
      selling_price: Math.round(l.price || 0),
      hsn: 7117, // imitation jewellery
    }));

    const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
    const payload = {
      order_id: order.id,
      order_date: istNow.toISOString().slice(0, 16).replace('T', ' '),
      pickup_location: env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: street,
      billing_city: addr.city || 'NA',
      billing_pincode: String(addr.pin || '').replace(/\D/g, ''),
      billing_state: addr.state || 'NA',
      billing_country: 'India',
      billing_email: order.email || 'orders@saubhagyajewellery.com',
      billing_phone: phone10,
      shipping_is_billing: true,
      order_items: items,
      payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
      sub_total: Math.round((order.totalPaise || 0) / 100),
      length: Number(env.SHIPROCKET_BOX_LENGTH || 12),
      breadth: Number(env.SHIPROCKET_BOX_BREADTH || 12),
      height: Number(env.SHIPROCKET_BOX_HEIGHT || 6),
      weight: Number(env.SHIPROCKET_BOX_WEIGHT || 0.3),
    };

    const orderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + login.token },
      body: JSON.stringify(payload),
    });
    const created = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !created.order_id) {
      return { pushed: false, error: 'Shiprocket order create failed: ' + JSON.stringify(created).slice(0, 400) };
    }
    return { pushed: true, shiprocket_order_id: String(created.order_id), shipment_id: String(created.shipment_id || '') };
  } catch (err) {
    return { pushed: false, error: 'Shiprocket push error: ' + err.message };
  }
}

/** Record Shiprocket ids on the order row; tolerates pre-migration schema. */
export async function recordShiprocketResult(db, orderId, sr) {
  if (!sr || !sr.pushed) return;
  try {
    await db.prepare("UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(sr.shiprocket_order_id, sr.shipment_id, orderId).run();
  } catch (e) { /* columns may not exist until migration runs */ }
}
