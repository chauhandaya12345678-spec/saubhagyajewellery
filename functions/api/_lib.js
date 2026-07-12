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
 * Push a confirmed order to Shiprocket as an ad-hoc (Custom channel) order.
 * The Shiprocket "Razorpay" channel only imports Magic Checkout orders, so a
 * standard-Checkout site must push orders itself via this API.
 *
 * ── NOTIFICATION LIFECYCLE (why the customer gets no tracking SMS yet) ──────
 * Success here means the order EXISTS in the Shiprocket panel ("New Orders"
 * tab) — nothing has shipped and no tracking link exists at this timestamp.
 * A live tracking URL requires an AWB (air waybill) number, and Shiprocket
 * only assigns one after a human acts:
 *
 *   1. NOW  – this API call creates the order (order_id + shipment_id only).
 *             Customer gets the instant order-confirmation email; there is no
 *             trackable link yet, so no tracking SMS is possible.
 *   2. ADMIN – log in to the Shiprocket desk → New Orders → pack the item →
 *             click "Generate AWB" (assigns courier + AWB number).
 *   3. AUTO – the courier system then fires the customer's tracking SMS /
 *             WhatsApp / email with the live link automatically, and updates
 *             flow (picked up, in transit, delivered) without any code here.
 *
 * So: "order created but customer got no SMS" is the expected state between
 * steps 1 and 2 — it clears the moment the admin generates the AWB.
 * ─────────────────────────────────────────────────────────────────────────
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
    let street = [addr.street, addr.apt].filter(Boolean).join(', ') || 'NA';
    // Shiprocket rejects addresses <3 chars; pad short/missing ones so the push never fails validation
    if (street.length < 3) street = 'Address on request';

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

/** Record Shiprocket result on the order row + append an event log entry so
 *  a missing order in the Shiprocket panel is always diagnosable from D1. */
export async function recordShiprocketResult(db, orderId, sr) {
  const ok = !!(sr && sr.pushed);
  const detail = ok
    ? JSON.stringify({ shiprocket_order_id: sr.shiprocket_order_id, shipment_id: sr.shipment_id })
    : String((sr && sr.error) || 'unknown').slice(0, 500);

  // Bump attempt counter + save error text on the order row. Tolerate rows
  // that haven't been migrated yet.
  try {
    if (ok) {
      await db.prepare(
        `UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ?,
                            shiprocket_error = NULL,
                            shiprocket_attempts = COALESCE(shiprocket_attempts,0) + 1,
                            shiprocket_last_attempt_at = datetime('now'),
                            updated_at = datetime('now')
          WHERE id = ?`
      ).bind(sr.shiprocket_order_id, sr.shipment_id, orderId).run();
    } else {
      await db.prepare(
        `UPDATE orders SET shiprocket_error = ?,
                            shiprocket_attempts = COALESCE(shiprocket_attempts,0) + 1,
                            shiprocket_last_attempt_at = datetime('now'),
                            updated_at = datetime('now')
          WHERE id = ?`
      ).bind(detail, orderId).run();
    }
  } catch (e) {
    // Pre-migration schema — fall back to the original narrow update
    try {
      if (ok) {
        await db.prepare("UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(sr.shiprocket_order_id, sr.shipment_id, orderId).run();
      }
    } catch (e2) {}
  }

  // Append-only event log — never blocks even if the table isn't migrated yet.
  try {
    await db.prepare(
      'INSERT INTO order_events (order_id, kind, ok, detail) VALUES (?, ?, ?, ?)'
    ).bind(orderId, 'shiprocket_push', ok ? 1 : 0, detail).run();
  } catch (e) { /* order_events table not yet created */ }
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
