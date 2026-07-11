# Saubhagya — COD Security + Spam Protection Spec (v2)

**Site:** saubhagyajewellery.com  
**Updated:** OTP verify added, online-payment rate limit REMOVED

---

## 🔴 Golden Rule

**Online payment (Razorpay) = ZERO restrictions. Kabhi block nahi hona chahiye.**  
Sirf COD orders pe security lagani hai.

---

## Step 1: OTP Verification for COD (MOST IMPORTANT)

### Flow:

```
Customer fills checkout → selects COD → clicks PLACE ORDER
         │
         ▼
OTP overlay opens: "We've sent a 6-digit code to your email"
         │
         ▼
Email OTP sent via Resend (FREE — same API already set up)
         │
         ▼
Customer enters OTP → clicks VERIFY & PLACE ORDER
         │
         ▼
Backend verifies OTP → order saved → Shiprocket push
```

### 1a: D1 Table for OTPs

```sql
CREATE TABLE IF NOT EXISTS order_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otps_email_phone ON order_otps(email, phone);
```

### 1b: API Endpoint — Generate & Send OTP

**File (new):** `functions/api/orders/send-otp.js`

```javascript
/**
 * POST /api/orders/send-otp
 * Body: { email, phone, name }
 * Generates 6-digit OTP, sends via Resend email, stores in D1
 * Rate limited: max 3 OTPs per email per 15 minutes
 */
import { normEmail, normPhone } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email, phone, name } = await request.json();
    const normEmail_ = normEmail(email);
    const normPhone_ = normPhone(phone);
    if (!normEmail_ || !normPhone_) return json({ error: 'Valid email and phone required' }, 400);

    // ── Rate limit: 3 OTPs per email per 15 min ──────────────────
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM order_otps WHERE lower(email) = ? AND created_at > ?"
    ).bind(normEmail_, fifteenMinAgo).first();
    if (recentCount && recentCount.cnt >= 3) {
      return json({ error: 'Too many OTP requests. Please wait 15 minutes.' }, 429);
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    await env.DB.prepare(
      'INSERT INTO order_otps (email, phone, otp, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normEmail_, normPhone_, otp, expiresAt).run();

    // Send OTP email via Resend
    const key = env.RESEND_API_KEY;
    if (key) {
      const first = String(name || 'Customer').split(' ')[0];
      const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
      const html = `<div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#1A1A1A">
        <div style="text-align:center;padding:20px 0"><div style="font:600 20px Georgia,serif;color:#0B3C26">SAUBHAGYA</div></div>
        <div style="padding:8px 24px 24px;text-align:center">
          <h2 style="font:600 18px Georgia,serif;color:#0B3C26;margin:0 0 8px">Your Verification Code</h2>
          <p style="font-size:14px;color:#4a4a4a">Hi ${first}, use this code to confirm your COD order:</p>
          <div style="font:700 36px monospace;letter-spacing:6px;color:#0B3C26;padding:20px;margin:16px 0;background:#faf8f3;border-radius:6px">${otp}</div>
          <p style="font-size:12px;color:#9a9a9a">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div></div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [normEmail_], subject: `Verification code: ${otp} · Saubhagya`, html }),
      });
    }

    return json({ success: true, message: 'OTP sent to your email. Valid for 10 minutes.', expires_in: 600 });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
```

### 1c: API Endpoint — Verify OTP

**File (new):** `functions/api/orders/verify-otp.js`

```javascript
/**
 * POST /api/orders/verify-otp
 * Body: { email, phone, otp }
 * Verifies OTP → returns verification_token for order-save
 * Max 3 wrong attempts per OTP
 */
import { normEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email, phone, otp } = await request.json();
    const normEmail_ = normEmail(email);
    if (!normEmail_ || !phone || !otp) return json({ error: 'Email, phone, and OTP required' }, 400);

    // Find latest unused, unexpired OTP
    const row = await env.DB.prepare(
      "SELECT id, otp, expires_at, attempts FROM order_otps WHERE lower(email) = ? AND phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(normEmail_, String(phone).replace(/\D/g, '').slice(-10)).first();

    if (!row) return json({ error: 'No active OTP found. Please request a new one.' }, 400);

    if (row.attempts >= 3) {
      await env.DB.prepare('UPDATE order_otps SET used = 1 WHERE id = ?').bind(row.id).run();
      return json({ error: 'Too many wrong attempts. Please request a new OTP.' }, 400);
    }

    if (row.otp !== String(otp).trim()) {
      await env.DB.prepare('UPDATE order_otps SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
      const remaining = 2 - row.attempts;
      return json({ error: `Wrong code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }, 400);
    }

    // OTP correct → mark used, generate verification token
    await env.DB.prepare('UPDATE order_otps SET used = 1 WHERE id = ?').bind(row.id).run();

    const vToken = 'vfy_' + crypto.randomUUID().replace(/-/g, '');
    // Store short-lived verification token
    await env.DB.prepare(
      "INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, 'cod_verify', datetime('now', '+30 minutes'))"
    ).bind(normEmail_, vToken).run();

    return json({ success: true, verification_token: vToken });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
```

### 1d: Update /api/orders/save — Require Verification for COD

**File:** `functions/api/orders/save.js`

Add this check in the `onRequest` function, BEFORE order processing, when `payment_method === 'cod'`:

```javascript
// ── COD: Require OTP verification ──────────────────────────────────
if (body.payment_method === 'cod') {
  const vToken = body.verification_token;
  if (!vToken) {
    return json({ error: 'Phone verification required for COD orders. Please verify your phone.' }, 400);
  }

  const verifyRow = await db.prepare(
    "SELECT id FROM password_resets WHERE token = ? AND type = 'cod_verify' AND used = 0 AND expires_at > datetime('now')"
  ).bind(String(vToken)).first();

  if (!verifyRow) {
    return json({ error: 'Verification expired or invalid. Please verify again.' }, 400);
  }

  // Mark token as used
  await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(verifyRow.id).run();
}
```

### 1e: Update checkout.html — OTP Flow

**Add HTML** (before the PLACE ORDER button):

```html
<!-- COD OTP overlay -->
<div id="co-otp-overlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:200;display:none;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:8px;padding:32px 24px;max-width:400px;width:90%;text-align:center;">
    <div style="font:600 20px Georgia,serif;color:#0B3C26;margin-bottom:4px;">Verify Your Phone</div>
    <p style="font-size:13px;color:#6a6a6a;margin:0 0 20px;">We sent a 6-digit code to <strong id="co-otp-email"></strong></p>
    <input id="co-otp-input" type="text" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit code"
      style="width:100%;padding:14px;text-align:center;font-size:22px;letter-spacing:8px;border:1px solid #d4cec0;border-radius:6px;box-sizing:border-box;">
    <div id="co-otp-error" style="font-size:12px;color:#c0392b;margin:10px 0;min-height:18px;"></div>
    <button id="co-otp-verify" class="co-btn" style="width:100%;margin-bottom:8px;">VERIFY & PLACE ORDER</button>
    <button id="co-otp-cancel" style="background:none;border:none;color:#6a6a6a;font-size:12px;cursor:pointer;">Cancel</button>
  </div>
</div>
```

**Add JavaScript** in checkout.html `<script>`:

```javascript
// ── COD OTP Flow ──────────────────────────────────────────────────
var otpOverlay = document.getElementById('co-otp-overlay');
var otpInput = document.getElementById('co-otp-input');
var otpError = document.getElementById('co-otp-error');
var otpEmail = document.getElementById('co-otp-email');
var pendingCodOrder = null; // holds the validated order data while waiting for OTP

function showOtpOverlay(v, cart, lines) {
  var email = v.email;
  otpEmail.textContent = email;
  otpInput.value = '';
  otpError.textContent = '';
  otpOverlay.style.display = 'flex';
  otpInput.focus();

  // Send OTP
  otpError.textContent = 'Sending code…';
  otpError.style.color = '#6a6a6a';
  fetch('/api/orders/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, phone: v.phone, name: v.first }),
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      otpError.textContent = 'Code sent! Check your email.';
      otpError.style.color = '#0B3C26';
    } else {
      otpError.textContent = d.error || 'Failed to send code';
      otpError.style.color = '#c0392b';
    }
  }).catch(function() {
    otpError.textContent = 'Network error. Try again.';
    otpError.style.color = '#c0392b';
  });
}

document.getElementById('co-otp-verify').addEventListener('click', function() {
  var otp = otpInput.value.trim();
  if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    otpError.textContent = 'Enter the 6-digit code';
    otpError.style.color = '#c0392b';
    return;
  }

  var btn = document.getElementById('co-otp-verify');
  btn.disabled = true;
  btn.textContent = 'VERIFYING…';

  fetch('/api/orders/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: pendingCodOrder.v.email, phone: pendingCodOrder.v.phone, otp: otp }),
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success && d.verification_token) {
      otpOverlay.style.display = 'none';
      // Continue COD order with verification token
      pendingCodOrder.saveBody.verification_token = d.verification_token;
      finalizeOrder(pendingCodOrder.lastOrder, pendingCodOrder.codOrderId, pendingCodOrder.saveBody);
    } else {
      otpError.textContent = d.error || 'Invalid code';
      otpError.style.color = '#c0392b';
      btn.disabled = false;
      btn.textContent = 'VERIFY & PLACE ORDER';
    }
  }).catch(function() {
    otpError.textContent = 'Network error';
    otpError.style.color = '#c0392b';
    btn.disabled = false;
    btn.textContent = 'VERIFY & PLACE ORDER';
  });
});

document.getElementById('co-otp-cancel').addEventListener('click', function() {
  otpOverlay.style.display = 'none';
  document.getElementById('co-submit').disabled = false;
  document.getElementById('co-submit').textContent = 'PLACE ORDER';
});

// Update doPayment() COD path:
// In doPayment(), find the COD section and replace with OTP flow:

// OLD: if (v.pay === 'cod') { ... finalizeOrder(...) ... }
// NEW:
if (v.pay === 'cod') {
  var codOrderId = 'COD' + Date.now().toString(36).toUpperCase();
  var lastOrder = {
    id: codOrderId, paymentId: 'COD', customer: name, email: v.email, phone: v.phone,
    totalText: fmt(total), lines: lines.map(function(l) { return { name: l.name, qty: l.qty, lineText: fmt(l.price * l.qty) }; }),
    address: [v.addr, v.city, v.state, v.pin].filter(Boolean).join(', ')
  };
  var saveBody = {
    razorpay_payment_id: 'COD-' + codOrderId, items: lines,
    total: total * 100, subtotal: subtotal * 100, discount: discount * 100,
    shipping: (shipFee + codFee) * 100,
    name: name, email: v.email || '', phone: v.phone || '',
    address: addressStr, create_account: true, test_mode: false, payment_method: 'cod'
  };
  // Store pending order and show OTP overlay
  pendingCodOrder = { v: v, lastOrder: lastOrder, codOrderId: codOrderId, saveBody: saveBody };
  showOtpOverlay(v, cartItems.slice(), lines);
  return;
}
```

---

## Step 2: COD-Specific Rate Limit (COD ONLY — NOT Online Payment)

**File:** `functions/api/orders/save.js`

Add COD-only rate limit (does NOT affect Razorpay payments):

```javascript
// ── COD Rate Limit: max 3 COD orders per phone per 24 hours ────────
if (body.payment_method === 'cod') {
  const phone = normPhone(body.phone);
  if (phone) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const codRecent = await db.prepare(
      "SELECT COUNT(*) as cnt FROM orders WHERE phone = ? AND payment_method = 'cod' AND created_at > ?"
    ).bind(phone, yesterday).first();
    if (codRecent && codRecent.cnt >= 3) {
      return json({ error: 'Maximum 3 COD orders per day. Please pay online for more orders.' }, 429);
    }
  }
}
```

---

## Step 3: COD Amount Cap

**File:** `checkout.html` — `doPayment()` function

```javascript
var COD_MAX_AMOUNT = 2000; // ₹2,000 max for COD
if (v.pay === 'cod' && total > COD_MAX_AMOUNT) {
  $('co-error').textContent = 'COD available up to ₹2,000 only. Please pay online for higher amounts.';
  $('co-error').style.display = 'block';
  $('co-submit').disabled = false;
  $('co-submit').textContent = 'PLACE ORDER';
  return;
}
```

---

## Step 4: COD Fee

**File:** `checkout.html` — line 154

```javascript
var PRICING = { freeShipping: true, codFee: 49 };
```

---

## Step 5: Cloudflare WAF (Dashboard)

Cloudflare Dashboard → saubhagyajewellery.com → Security → WAF → Rate Limiting Rules

**Rule 1:** COD OTP abuse prevention
| Field | Value |
|-------|-------|
| Path | `/api/orders/send-otp` |
| Rate | 5 requests per 5 minutes |
| Action | Block |

**Rule 2:** General API protection
| Field | Value |
|-------|-------|
| Path | `/api/*` |
| Rate | 100 requests per 1 minute |
| Action | JS Challenge |

---

## Step 6: Origin Check (Soft)

**File:** `functions/api/orders/save.js`

```javascript
const origin = request.headers.get('Origin') || '';
const allowedOrigins = ['https://saubhagyajewellery.com', 'http://localhost:5000', 'http://localhost:3000'];
if (origin && !allowedOrigins.includes(origin)) {
  console.log('SAVE_ORDER_BAD_ORIGIN', { origin, ip: clientIP });
  return json({ error: 'Invalid request' }, 403);
}
```

---

## Summary — What Gets Protected

| Protection | COD | Online Pay |
|-----------|-----|------------|
| OTP verification | ✅ Required | ❌ Not needed |
| 3 COD/day per phone | ✅ | ❌ |
| Amount cap ₹2,000 | ✅ | ❌ |
| ₹49 COD fee | ✅ | ❌ |
| Origin check | ✅ | ✅ |
| Cloudflare WAF | ✅ | ✅ |

---

## Files Changed

| File | Action |
|------|--------|
| `functions/api/orders/send-otp.js` | **NEW** — Send OTP email |
| `functions/api/orders/verify-otp.js` | **NEW** — Verify OTP |
| `functions/api/orders/save.js` | Edit — COD verification + rate limit |
| `checkout.html` | Edit — OTP UI + COD cap + COD fee |
| D1 — `order_otps` table | **NEW** |
| D1 — `password_resets` (reused) | `cod_verify` type |

**Online payment (Razorpay) = ZERO changes, ZERO impact.**
