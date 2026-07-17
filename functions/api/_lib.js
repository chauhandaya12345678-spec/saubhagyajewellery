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
 *   RESEND_API_KEY           Resend API key — enables order-confirmation email (optional)
 *   ORDER_EMAIL_FROM         verified sender, default "Saubhagya Jewellery <orders@saubhagyajewellery.com>"
 *   ORDER_EMAIL_BCC          store copy address (default saubhagyajewellery01@gmail.com)
 */

const enc = new TextEncoder();

/* Email is the account key — normalise to lowercase+trim everywhere so
   "Daya@x.com" and "daya@x.com" are one account, never duplicates. */
export function normEmail(e) {
  if (!e) return null;
  const t = String(e).trim().toLowerCase();
  return t || null;
}
export function normPhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  return d ? d.slice(-10) : null;
}

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
 * Push a confirmed order to ShipPrime (replaces Shiprocket).
 * ShipPrime uses a simple Bearer token — no login, no session management.
 * 
 * order = { id, name, email, phone, address, items, totalPaise, paymentMethod }
 * Returns { pushed, awb?, courier?, orderId?, labelUrl?, error? } — never throws.
 */
export async function pushToShipPrime(env, order, db) {
  try {
    const token = env.SHIPPRIME_TOKEN;
    if (!token) return { pushed: false, error: 'SHIPPRIME_TOKEN not configured' };

    // Load pickup address from D1 settings (preferred) or env vars (fallback)
    let pickup = {
      name: env.SHIPPRIME_PICKUP_NAME || 'Saubhagya Jewellery',
      phone: env.SHIPPRIME_PICKUP_PHONE || '9987008435',
      address1: env.SHIPPRIME_PICKUP_ADDRESS1 || 'Tanaji Nagar Rd, Vadar Pada Rd Number 2, opp vishwakarma mandir, Hanuman Nagar, Kandivali East',
      address2: env.SHIPPRIME_PICKUP_ADDRESS2 || '',
      city: env.SHIPPRIME_PICKUP_CITY || 'Mumbai',
      state: env.SHIPPRIME_PICKUP_STATE || 'Maharashtra',
      pincode: env.SHIPPRIME_PICKUP_PIN || '400101',
    };
    if (db) {
      try {
        const keys = ['pickup_name','pickup_phone','pickup_address1','pickup_address2','pickup_city','pickup_state','pickup_pin'];
        const rows = await db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all();
        if (rows.results && rows.results.length) {
          for (const r of rows.results) {
            if (r.key === 'pickup_name') pickup.name = r.value || pickup.name;
            if (r.key === 'pickup_phone') pickup.phone = r.value || pickup.phone;
            if (r.key === 'pickup_address1') pickup.address1 = r.value || pickup.address1;
            if (r.key === 'pickup_address2') pickup.address2 = r.value || pickup.address2;
            if (r.key === 'pickup_city') pickup.city = r.value || pickup.city;
            if (r.key === 'pickup_state') pickup.state = r.value || pickup.state;
            if (r.key === 'pickup_pin') pickup.pincode = r.value || pickup.pincode;
          }
        }
      } catch (e) { /* settings table may not exist yet, use fallback */ }
    }

    let addr = order.address;
    if (typeof addr === 'string') { try { addr = JSON.parse(addr); } catch (e) { addr = {}; } }
    addr = addr || {};

    // Hard-reject incomplete addresses — silent fallbacks like "Address, Mumbai, 400001"
    // create undeliverable ShipPrime labels (see order #4748410 for the failure mode).
    const streetRaw = String(addr.street || addr.address1 || '').trim();
    const pinRaw = String(addr.pin || addr.pincode || '').replace(/\D/g, '');
    const cityRaw = String(addr.city || '').trim();
    if (streetRaw.length < 5 || pinRaw.length !== 6 || cityRaw.length < 2) {
      return { pushed: false, error: 'incomplete address — street/city/pin required (got street="' + streetRaw + '", city="' + cityRaw + '", pin="' + pinRaw + '")' };
    }

    const items = (order.items || []).map(l => ({
      name: l.name || l.id || 'Jewellery item',
      sku: String(l.id || l.sku || 'SKU'),
      quantity: l.qty || 1,
      price: Math.round(l.price || 0),
      hsnCode: '7117', // imitation jewellery
    }));

    // Per-item weight: use explicit weightGrams if catalog has it, else guess by
    // name/category. Overshoots slightly on purpose so ShipPrime pickup courier
    // never surcharges. Update these once you weigh production pieces.
    const guessWeight = (l) => {
      if (l.weightGrams && Number(l.weightGrams) > 0) return Number(l.weightGrams);
      const s = String((l.category || '') + ' ' + (l.name || '')).toLowerCase();
      if (/bridal.*set|full set/.test(s)) return 500;
      if (/haaram|rani.*haar|long.*necklace/.test(s)) return 220;
      if (/waist|vanki/.test(s)) return 250;
      if (/set(?!.*earring)/.test(s)) return 300;   // necklace-set
      if (/choker/.test(s)) return 130;
      if (/necklace|mala/.test(s)) return 180;
      if (/pendant/.test(s)) return 40;
      if (/tikka|passa|nath/.test(s)) return 25;
      if (/jhumka|drop|earring|stud/.test(s)) return 35;
      return 100; // safe default
    };
    const totalWeight = (order.items || []).reduce(
      (s, l) => s + guessWeight(l) * (l.qty || 1), 0
    );
    // Add 40g packing (box + bubble + polybag). Floor 100g, ceiling 2kg.
    const packingWeight = 40;
    const finalWeight = Math.max(100, Math.min(2000, totalWeight + packingWeight));

    const bp = {
      clientReferenceId: order.id,
      paymentMethod: order.paymentMethod === 'cod' ? 'COD' : 'PREPAID',
      weightGrams: Number(env.SHIPPRIME_WEIGHT_GRAMS_OVERRIDE) || finalWeight,
      declaredValue: Math.round((order.totalPaise || 0) / 100) || items.reduce((s, i) => s + i.price * i.quantity, 0),
      items,
      pickupAddress: {
        name: pickup.name,
        phone: pickup.phone,
        address1: pickup.address1,
        address2: pickup.address2,
        city: pickup.city,
        state: pickup.state,
        pincode: pickup.pincode,
        country: 'India',
      },
      deliveryAddress: {
        name: (order.name || 'Customer').split(' ').slice(0, 5).join(' ').slice(0, 200),
        phone: String(order.phone || '').replace(/\D/g, '').slice(-10) || '9999999999',
        address1: streetRaw.slice(0, 250),
        address2: (addr.apt || addr.address2 || '').slice(0, 250),
        city: cityRaw.slice(0, 100),
        state: String(addr.state || '').trim().slice(0, 100) || 'Maharashtra',
        pincode: pinRaw,
        country: 'India',
      },
    };

    const res = await fetch('https://api.shipprime.live/v1/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(bp),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'SUCCESS') {
      return { pushed: true, awb: data.awb, courier: data.courier, labelUrl: data.labelUrl, shipPrimeOrderId: String(data.orderId) };
    }
    return { pushed: false, error: 'ShipPrime: ' + (data.message || data.code || res.status) };
  } catch (err) {
    return { pushed: false, error: 'ShipPrime push error: ' + err.message };
  }
}

/** Record Shipprime result on the order row + append an event log entry so
 *  a missing order in the Shipprime panel is always diagnosable from D1. */
export async function recordShipprimeResult(db, orderId, sp) {
  const ok = !!(sp && sp.pushed);
  const detail = ok
    ? JSON.stringify({ shipprime_awb: sp.awb, shipprime_order_id: sp.shipPrimeOrderId || sp.shipment_id })
    : String((sp && sp.error) || 'unknown').slice(0, 500);

  // Bump attempt counter + save error text on the order row. Tolerate rows
  // that haven't been migrated yet.
  try {
    if (ok) {
      await db.prepare(
        `UPDATE orders SET shipprime_awb = ?, shipprime_order_id = ?,
                            shipprime_error = NULL,
                            shipprime_attempts = COALESCE(shipprime_attempts,0) + 1,
                            shipprime_last_attempt_at = datetime('now'),
                            updated_at = datetime('now')
          WHERE id = ?`
      ).bind(sp.awb, sp.shipPrimeOrderId || sp.shipment_id || '', orderId).run();
    } else {
      await db.prepare(
        `UPDATE orders SET shipprime_error = ?,
                            shipprime_attempts = COALESCE(shipprime_attempts,0) + 1,
                            shipprime_last_attempt_at = datetime('now'),
                            updated_at = datetime('now')
          WHERE id = ?`
      ).bind(detail, orderId).run();
    }
  } catch (e) {
    // Pre-migration schema — fall back to the original narrow update
    try {
      if (ok) {
        await db.prepare("UPDATE orders SET shipprime_awb = ?, shipprime_order_id = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(sp.awb, sp.shipPrimeOrderId || sp.shipment_id || '', orderId).run();
      }
    } catch (e2) {}
  }

  // Append-only event log
  try {
    await db.prepare(
      'INSERT INTO order_events (order_id, kind, ok, detail) VALUES (?, ?, ?, ?)'
    ).bind(orderId, 'shipprime_push', ok ? 1 : 0, detail).run();
  } catch (e) {}
}

/** Generic append-only event log for anything worth debugging later. Never throws. */
export async function logOrderEvent(db, orderId, kind, ok, detail) {
  try {
    await db.prepare(
      'INSERT INTO order_events (order_id, kind, ok, detail) VALUES (?, ?, ?, ?)'
    ).bind(orderId, kind, ok ? 1 : 0, String(detail || '').slice(0, 1000)).run();
  } catch (e) {}
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function inr(paise) { return '₹' + Number((paise || 0) / 100).toLocaleString('en-IN'); }

/**
 * Estimated delivery window by PIN zone (dispatch + courier transit):
 * Mumbai 400/401 → 2-4 days · Maharashtra 41-44 → 3-5 · rest of India → 5-8.
 * Returns { minDays, maxDays, text: "14–17 Jul" } from `from` (default now, IST).
 */
export function etaForPin(pin, from) {
  const p = String(pin || '').replace(/\D/g, '');
  let lo = 5, hi = 8;
  if (/^40[01]/.test(p)) { lo = 2; hi = 4; }
  else if (/^4[1-4]/.test(p)) { lo = 3; hi = 5; }
  const base = from ? new Date(from) : new Date();
  const ist = new Date(base.getTime() + 5.5 * 3600 * 1000);
  const fmt = d => d.getUTCDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const a = new Date(ist.getTime() + lo * 86400000);
  const b = new Date(ist.getTime() + hi * 86400000);
  return { minDays: lo, maxDays: hi, text: fmt(a) + ' – ' + fmt(b) };
}

/**
 * Instant order-confirmation email via Resend (https://resend.com, free tier).
 * No-ops silently when RESEND_API_KEY is unset, so it never blocks an order.
 * Sender domain must be verified in Resend; store gets a bcc copy.
 *
 * order = { id, name, email, phone, address:{...}|string, items:[{name,qty,price}],
 *           totalPaise, paymentMethod }
 * Returns { sent, id?, error? } — never throws.
 */
export async function sendOrderEmail(env, order) {
  try {
    const key = env.RESEND_API_KEY;
    if (!key) return { sent: false, error: 'RESEND_API_KEY not configured' };
    if (!order.email) return { sent: false, error: 'no customer email' };

    // care@ routes to the store gmail via Cloudflare Email Routing
    const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
    const bcc = env.ORDER_EMAIL_BCC || 'care@saubhagyajewellery.com';

    let addr = order.address;
    if (typeof addr === 'string') { try { addr = JSON.parse(addr); } catch (e) { addr = { street: addr }; } }
    addr = addr || {};
    const addrLine = [addr.street, addr.apt, addr.city, addr.state, addr.pin].filter(Boolean).join(', ');

    const rows = (order.items || []).map(l =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #f0ece1;font:14px Georgia,serif;color:#1A1A1A">${esc(l.name)} &times; ${l.qty || 1}</td>` +
      `<td style="padding:8px 0;border-bottom:1px solid #f0ece1;text-align:right;font:14px Arial,sans-serif;color:#0B3C26">${inr((l.price || 0) * 100 * (l.qty || 1))}</td></tr>`
    ).join('');

    const pay = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online';
    const eta = etaForPin(addr.pin);
    const html =
`<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
  <div style="text-align:center;padding:26px 0 14px">
    <div style="font:600 24px Georgia,serif;letter-spacing:2px;color:#0B3C26">SAUBHAGYA</div>
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">FINE JEWELLERY</div>
  </div>
  <div style="background:#0B3C26;color:#fff;padding:22px 24px;text-align:center">
    <div style="font:600 20px Georgia,serif">Order Confirmed</div>
    <div style="font-size:13px;opacity:.85;margin-top:6px">Order <strong>${esc(order.id)}</strong></div>
  </div>
  <div style="padding:24px">
    <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:0 0 18px">Hi ${esc((order.name || 'there').split(' ')[0])}, thank you for your order. We're preparing your piece for dispatch. You can track it anytime at <a href="https://saubhagyajewellery.com/track-orders.html" style="color:#0B3C26">My Orders</a> using your phone number.</p>
    <table style="width:100%;border-collapse:collapse">${rows}
      <tr><td style="padding:12px 0 0;font:600 16px Georgia,serif">Total (${esc(pay)})</td>
      <td style="padding:12px 0 0;text-align:right;font:600 18px Georgia,serif;color:#0B3C26">${inr(order.totalPaise)}</td></tr>
    </table>
    <div style="margin-top:20px;padding:14px 16px;background:#faf8f3;border:1px solid #eee5d6;border-radius:6px">
      <div style="font-size:10px;letter-spacing:2px;color:#C5A059;margin-bottom:6px">SHIP TO</div>
      <div style="font-size:13px;line-height:1.6;color:#1A1A1A">${esc(order.name || '')}<br>${esc(addrLine)}<br>${esc(order.phone || '')}</div>
      <div style="font-size:12px;color:#0B3C26;margin-top:10px"><strong>Estimated delivery:</strong> ${esc(eta.text)}</div>
    </div>
    <p style="font-size:12px;line-height:1.7;color:#9a9a9a;margin-top:20px">Ready pieces dispatch in 2–4 business days (10–14 for made-to-order bridal). A tracking link arrives on WhatsApp &amp; email once shipped. All sales are final; manufacturing defects are repaired or replaced.</p>
    <p style="font-size:12px;color:#9a9a9a">Questions? <a href="https://wa.me/919987008435" style="color:#0B3C26">WhatsApp us</a>.</p>
  </div>
</div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [order.email], bcc: [bcc],
        subject: `Order ${order.id} confirmed · Saubhagya Jewellery`,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, error: 'Resend error: ' + JSON.stringify(data).slice(0, 300) };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: 'Email error: ' + err.message };
  }
}

/**
 * Account-created welcome email. Same Resend plumbing as sendOrderEmail;
 * no-ops without RESEND_API_KEY. Never throws.
 */
export async function sendWelcomeEmail(env, user) {
  try {
    const key = env.RESEND_API_KEY;
    if (!key) return { sent: false, error: 'RESEND_API_KEY not configured' };
    if (!user.email) return { sent: false, error: 'no email' };
    const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
    const first = esc(String(user.name || 'there').split(' ')[0]);
    const html =
`<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
  <div style="text-align:center;padding:26px 0 14px">
    <div style="font:600 24px Georgia,serif;letter-spacing:2px;color:#0B3C26">SAUBHAGYA</div>
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">FINE JEWELLERY</div>
  </div>
  <div style="padding:8px 24px 24px">
    <h2 style="font:600 20px Georgia,serif;color:#0B3C26;margin:0 0 12px">Welcome, ${first}</h2>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 14px">Your Saubhagya account is ready. Every order you place is saved to it — track them anytime at <a href="https://saubhagyajewellery.com/track-orders.html" style="color:#0B3C26">My Orders</a> with your phone number.</p>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 18px">Handcrafted temple, Kundan/Polki and American Diamond jewellery — free insured shipping across India, every price all-inclusive.</p>
    <a href="https://saubhagyajewellery.com/" style="display:inline-block;padding:13px 26px;background:#0B3C26;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px">EXPLORE COLLECTIONS</a>
    <p style="font-size:12px;color:#9a9a9a;margin-top:22px">Questions? <a href="https://wa.me/919987008435" style="color:#0B3C26">WhatsApp us</a> or reply to this email.</p>
  </div>
</div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [user.email], subject: 'Welcome to Saubhagya Jewellery', html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, error: 'Resend error: ' + JSON.stringify(data).slice(0, 300) };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: 'Email error: ' + err.message };
  }
}

/**
 * Magic-link sign-in email. Same Resend plumbing; no-ops without RESEND_API_KEY.
 * Returns { sent, id?, error? } — never throws.
 */
export async function sendMagicLinkEmail(env, email, name, token) {
  try {
    const key = env.RESEND_API_KEY;
    if (!key) return { sent: false, error: 'RESEND_API_KEY not configured' };
    if (!email) return { sent: false, error: 'no email' };

    const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
    const first = esc(String(name || 'there').split(' ')[0]);
    const link = `https://saubhagyajewellery.com/signin.html?ml=${encodeURIComponent(token)}`;

    const html =
`<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
  <div style="text-align:center;padding:26px 0 14px">
    <div style="font:600 24px Georgia,serif;letter-spacing:2px;color:#0B3C26">SAUBHAGYA</div>
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">JEWELLERY</div>
  </div>
  <div style="padding:8px 24px 24px">
    <h2 style="font:600 20px Georgia,serif;color:#0B3C26;margin:0 0 12px">Sign in to your account</h2>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 20px">Hi ${first}, click below to sign in instantly. Link expires in 15 minutes and works only once.</p>
    <a href="${link}" style="display:inline-block;padding:14px 32px;background:#0B3C26;color:#fff;text-decoration:none;font-size:13px;letter-spacing:1px;border-radius:4px">SIGN IN TO SAUBHAGYA</a>
    <p style="font-size:12px;color:#9a9a9a;margin-top:20px">If you didn't request this, ignore this email.</p>
  </div>
</div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Sign in to Saubhagya Jewellery', html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, error: 'Resend error: ' + JSON.stringify(data).slice(0, 300) };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: 'Magic link error: ' + err.message };
  }
}

/**
 * Password-reset email. Same Resend plumbing; no-ops without RESEND_API_KEY.
 */
export async function sendPasswordResetEmail(env, email, name, token) {
  try {
    const key = env.RESEND_API_KEY;
    if (!key) return { sent: false, error: 'RESEND_API_KEY not configured' };
    if (!email) return { sent: false, error: 'no email' };

    const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
    const first = esc(String(name || 'there').split(' ')[0]);
    const link = `https://saubhagyajewellery.com/reset-password.html?token=${encodeURIComponent(token)}`;

    const html =
`<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
  <div style="text-align:center;padding:26px 0 14px">
    <div style="font:600 24px Georgia,serif;letter-spacing:2px;color:#0B3C26">SAUBHAGYA</div>
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">JEWELLERY</div>
  </div>
  <div style="padding:8px 24px 24px">
    <h2 style="font:600 20px Georgia,serif;color:#0B3C26;margin:0 0 12px">Reset your password</h2>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 8px">Hi ${first}, we received a request to reset your Saubhagya account password.</p>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 20px">Click below to set a new password. Link expires in 1 hour.</p>
    <a href="${link}" style="display:inline-block;padding:14px 32px;background:#0B3C26;color:#fff;text-decoration:none;font-size:13px;letter-spacing:1px;border-radius:4px">RESET PASSWORD</a>
    <p style="font-size:12px;color:#9a9a9a;margin-top:20px">If you didn't request this, ignore this email. Your password won't change.</p>
  </div>
</div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Reset your Saubhagya password', html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, error: 'Resend error: ' + JSON.stringify(data).slice(0, 300) };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: 'Reset email error: ' + err.message };
  }
}
