# Saubhagya — Magic Link Login + Password Reset via Email

**Site:** saubhagyajewellery.com  
**Repo:** C:\Users\Daya\Documents\GitHub\saubhagyajewellery  
**Email Service:** Resend (already configured, domain: saubhagyajewellery.com)  
**Database:** Cloudflare D1 (saubhagya-db)  
**Status:** ⏳ Ready to build — Resend domain just added via auto-configure

---

## Step 1: Verify Resend Domain (Daya)

- [ ] Resend dashboard → saubhagyajewellery.com → check green "Verified" badge
- [ ] If not verified: wait 2-5 min and refresh
- [ ] Send test email from Resend dashboard → check if received

**Gate:** Domain verified hone ke baad hi Step 2-7 karna.

---

## Step 2: Create D1 Table for Reset Tokens

Run this SQL on D1 database (saubhagya-db):

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'reset',  -- 'reset' or 'magiclink'
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(email);
```

**How to run:** Use Cloudflare D1 API (see saubhagya-d1-seed skill) or `wrangler d1 execute saubhagya-db --remote --command="..."`

---

## Step 3: Add Email Functions to `_lib.js`

**File:** `functions/api/_lib.js`  
**Action:** Add TWO new functions after the existing `sendWelcomeEmail()` function

### Function 1: `sendMagicLinkEmail(env, email, name, token)`

Paste this after line 304 (end of sendWelcomeEmail):

```javascript
/**
 * Magic link sign-in email. Same Resend plumbing; no-ops without RESEND_API_KEY.
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
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">FINE JEWELLERY</div>
  </div>
  <div style="padding:8px 24px 24px">
    <h2 style="font:600 20px Georgia,serif;color:#0B3C26;margin:0 0 12px">Sign in to your account</h2>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 20px">Hi ${first}, click the button below to sign in instantly. This link expires in 15 minutes and can be used only once.</p>
    <a href="${link}" style="display:inline-block;padding:14px 32px;background:#0B3C26;color:#fff;text-decoration:none;font-size:13px;letter-spacing:1px;border-radius:4px">SIGN IN TO SAUBHAGYA</a>
    <p style="font-size:12px;color:#9a9a9a;margin-top:20px">If you didn't request this, ignore this email. The link won't work after 15 minutes.</p>
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
```

### Function 2: `sendPasswordResetEmail(env, email, name, token)`

Paste after magic link function:

```javascript
/**
 * Password-reset email. Same Resend plumbing; no-ops without RESEND_API_KEY.
 * Returns { sent, id?, error? } — never throws.
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
    <div style="font-size:9px;letter-spacing:5px;color:#C5A059;margin-top:3px">FINE JEWELLERY</div>
  </div>
  <div style="padding:8px 24px 24px">
    <h2 style="font:600 20px Georgia,serif;color:#0B3C26;margin:0 0 12px">Reset your password</h2>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 8px">Hi ${first}, we received a request to reset your Saubhagya account password.</p>
    <p style="font-size:14px;line-height:1.7;color:#4a4a4a;margin:0 0 20px">Click below to set a new password. This link expires in 1 hour.</p>
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
```

---

## Step 4: Create API Endpoints (4 New Files)

### File 4a: `functions/api/auth/magic-link.js`

```javascript
/**
 * POST /api/auth/magic-link
 * Body: { email }
 * If email exists in users table → generate token, send magic link email
 * Always return success (don't leak which emails are registered)
 */
import { sendMagicLinkEmail, normEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { email } = await request.json();
    const normedEmail = normEmail(email);
    if (!normedEmail) {
      return new Response(JSON.stringify({ success: true, message: 'If that email is registered, a sign-in link has been sent.' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE lower(email) = ?').bind(normedEmail).first();
    if (!user) {
      // Don't leak: return same message
      return new Response(JSON.stringify({ success: true, message: 'If that email is registered, a sign-in link has been sent.' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Generate token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normedEmail, token, 'magiclink', expiresAt).run();

    const emailResult = await sendMagicLinkEmail(env, normedEmail, user.name, token);

    return new Response(JSON.stringify({
      success: true,
      message: 'If that email is registered, a sign-in link has been sent.',
      email_sent: emailResult.sent,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
```

### File 4b: `functions/api/auth/verify-magic-link.js`

```javascript
/**
 * POST /api/auth/verify-magic-link
 * Body: { token }
 * Verify magic link token → create session → return user + session_token
 */
import { normEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { token } = await request.json();
    if (!token || typeof token !== 'string' || token.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const row = await env.DB.prepare(
      'SELECT id, email, type, expires_at, used FROM password_resets WHERE token = ?'
    ).bind(token.trim()).first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (row.type !== 'magiclink') {
      return new Response(JSON.stringify({ error: 'Invalid link type' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (row.used) {
      return new Response(JSON.stringify({ error: 'This link has already been used' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This link has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Mark as used
    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();

    // Get user
    const user = await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE lower(email) = ?').bind(row.email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Account not found' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Create session
    const sessionToken = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    await env.DB.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(user.id, sessionToken, user.email || '', user.name || 'Guest').run();

    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      session_token: sessionToken,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
```

### File 4c: `functions/api/auth/forgot-password.js`

```javascript
/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * If email exists → generate reset token, send reset email
 * Always return success (don't leak which emails are registered)
 */
import { sendPasswordResetEmail, normEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { email } = await request.json();
    const normedEmail = normEmail(email);
    const genericMsg = 'If an account exists for that email, a password reset link has been sent.';

    if (!normedEmail) {
      return new Response(JSON.stringify({ success: true, message: genericMsg }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE lower(email) = ?').bind(normedEmail).first();
    if (!user) {
      return new Response(JSON.stringify({ success: true, message: genericMsg }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Generate token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Invalidate old unused tokens for this email
    await env.DB.prepare(
      "UPDATE password_resets SET used = 1 WHERE lower(email) = ? AND type = 'reset' AND used = 0"
    ).bind(normedEmail).run();

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normedEmail, token, 'reset', expiresAt).run();

    const emailResult = await sendPasswordResetEmail(env, normedEmail, user.name, token);

    return new Response(JSON.stringify({
      success: true,
      message: genericMsg,
      email_sent: emailResult.sent,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
```

### File 4d: `functions/api/auth/reset-password.js`

```javascript
/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 * Verify reset token → update user password → return success
 */
import { hashPassword, normEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { token, new_password } = await request.json();
    if (!token || typeof token !== 'string' || token.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!new_password || String(new_password).length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const row = await env.DB.prepare(
      'SELECT id, email, type, expires_at, used FROM password_resets WHERE token = ?'
    ).bind(token.trim()).first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (row.type !== 'reset') {
      return new Response(JSON.stringify({ error: 'Invalid link type' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (row.used) {
      return new Response(JSON.stringify({ error: 'This link has already been used' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This link has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Mark as used
    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();

    // Update password
    const hashedPw = await hashPassword(new_password);
    await env.DB.prepare('UPDATE users SET password = ? WHERE lower(email) = ?').bind(hashedPw, row.email).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset. You can now sign in.',
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
```

---

## Step 5: Create Reset Password Page

**File:** `reset-password.html` (new file in repo root)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Password · Saubhagya</title>
<link rel="stylesheet" href="site.css?v=5">
<style>
  .rp-container { max-width:420px; margin:60px auto; padding:32px 24px; text-align:center; }
  .rp-title { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:600; color:#0B3C26; margin:0 0 8px; }
  .rp-sub { font-size:13px; color:#6a6a6a; margin:0 0 28px; line-height:1.6; }
  .rp-input { display:block; width:100%; padding:13px 16px; border:1px solid #d4cec0; border-radius:4px; font-size:15px; margin-bottom:16px; box-sizing:border-box; }
  .rp-input:focus { outline:none; border-color:#C5A059; }
  .rp-btn { display:block; width:100%; padding:14px; background:#0B3C26; color:#fff; border:none; border-radius:4px; font-size:13px; letter-spacing:2px; cursor:pointer; font-weight:500; }
  .rp-btn:disabled { opacity:.5; cursor:not-allowed; }
  .rp-msg { font-size:13px; margin-top:14px; min-height:20px; }
  .rp-msg.error { color:#c0392b; }
  .rp-msg.success { color:#0B3C26; }
  .rp-link { font-size:13px; color:#0B3C26; display:inline-block; margin-top:20px; text-underline-offset:3px; }
</style>
</head>
<body>
  <x-layout page="reset-password.html"></x-layout>
  <main>
    <div class="rp-container">
      <h1 class="rp-title">Reset Your Password</h1>
      <p class="rp-sub" id="rp-text">Enter a new password for your Saubhagya account.</p>
      <input class="rp-input" id="rp-password" type="password" placeholder="New password (min 6 chars)" autocomplete="new-password">
      <button class="rp-btn" id="rp-btn">RESET PASSWORD</button>
      <div class="rp-msg" id="rp-msg"></div>
      <a class="rp-link" href="signin.html">← Back to sign in</a>
    </div>
  </main>

<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');
  var msg = document.getElementById('rp-msg');
  var btn = document.getElementById('rp-btn');
  var pw = document.getElementById('rp-password');
  var txt = document.getElementById('rp-text');

  if (!token) {
    txt.textContent = 'No reset link found. Please request a new password reset.';
    btn.style.display = 'none';
    pw.style.display = 'none';
    return;
  }

  btn.addEventListener('click', function() {
    var newPw = pw.value.trim();
    if (newPw.length < 6) {
      msg.className = 'rp-msg error';
      msg.textContent = 'Password must be at least 6 characters';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'RESETTING…';
    msg.className = 'rp-msg';
    msg.textContent = '';

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, new_password: newPw }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) {
        msg.className = 'rp-msg success';
        msg.textContent = 'Password reset! Redirecting to sign in…';
        setTimeout(function() { window.location.href = 'signin.html'; }, 1500);
      } else {
        msg.className = 'rp-msg error';
        msg.textContent = d.error || 'Something went wrong. Please try again.';
        btn.disabled = false;
        btn.textContent = 'RESET PASSWORD';
      }
    }).catch(function() {
      msg.className = 'rp-msg error';
      msg.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'RESET PASSWORD';
    });
  });

  pw.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btn.click();
  });
})();
</script>
</body>
</html>
```

---

## Step 6: Update Sign-In Page

**File:** `signin.html`  
**Action:** Add TWO things:

### 6a: Add "Forgot Password?" link

Find the password input area and add below it:

```html
<div style="text-align:right;margin:-8px 0 16px">
  <a href="#" id="forgot-link" style="font-size:11px;color:#C5A059;text-decoration:none;">Forgot password?</a>
</div>
```

### 6b: Add "Send Magic Link" button

Next to the "SIGN IN" button, add:

```html
<button type="button" id="magic-link-btn" style="display:block;width:100%;padding:12px;background:transparent;color:#0B3C26;border:1px solid #0B3C26;border-radius:4px;font-size:12px;letter-spacing:1px;cursor:pointer;margin-top:10px;">SEND MAGIC LINK INSTEAD</button>
```

### 6c: Add JavaScript for both

In the existing `<script>` block in signin.html, add these event handlers:

```javascript
// ── Forgot Password
var forgotLink = document.getElementById('forgot-link');
if (forgotLink) {
  forgotLink.addEventListener('click', function(e) {
    e.preventDefault();
    var email = ($('auth-email').value || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      document.getElementById('auth-error').textContent = 'Enter your email first';
      document.getElementById('auth-error').style.display = 'block';
      return;
    }
    document.getElementById('auth-error').style.display = 'none';
    forgotLink.textContent = 'Sending…';
    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      document.getElementById('auth-error').style.color = '#0B3C26';
      document.getElementById('auth-error').textContent = d.message || 'Reset link sent if account exists.';
      document.getElementById('auth-error').style.display = 'block';
      forgotLink.textContent = 'Forgot password?';
    }).catch(function() {
      document.getElementById('auth-error').textContent = 'Network error. Try again.';
      document.getElementById('auth-error').style.display = 'block';
      forgotLink.textContent = 'Forgot password?';
    });
  });
}

// ── Magic Link
// Check URL for magic link token on page load
var mlParams = new URLSearchParams(window.location.search);
var mlToken = mlParams.get('ml');
if (mlToken) {
  var errEl = document.getElementById('auth-error');
  errEl.style.color = '#6a6a6a';
  errEl.textContent = 'Verifying your sign-in link…';
  errEl.style.display = 'block';
  fetch('/api/auth/verify-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: mlToken }),
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success && d.session_token) {
      try { localStorage.setItem('cc_token', d.session_token); } catch(e) {}
      try { localStorage.setItem('cc_user', JSON.stringify(d.user)); } catch(e) {}
      window.location.href = 'account.html';
    } else {
      errEl.style.color = '#c0392b';
      errEl.textContent = d.error || 'Invalid or expired link';
    }
  }).catch(function() {
    errEl.style.color = '#c0392b';
    errEl.textContent = 'Network error. Please try again.';
  });
}

// Magic link button
var mlBtn = document.getElementById('magic-link-btn');
if (mlBtn) {
  mlBtn.addEventListener('click', function() {
    var email = ($('auth-email').value || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      document.getElementById('auth-error').textContent = 'Enter your email address first';
      document.getElementById('auth-error').style.display = 'block';
      return;
    }
    mlBtn.disabled = true;
    mlBtn.textContent = 'SENDING LINK…';
    document.getElementById('auth-error').style.display = 'none';
    fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      document.getElementById('auth-error').style.color = '#0B3C26';
      document.getElementById('auth-error').textContent = '✓ ' + (d.message || 'Check your email!');
      document.getElementById('auth-error').style.display = 'block';
      mlBtn.textContent = 'SEND MAGIC LINK INSTEAD';
      mlBtn.disabled = false;
    }).catch(function() {
      document.getElementById('auth-error').textContent = 'Network error. Try again.';
      document.getElementById('auth-error').style.display = 'block';
      mlBtn.textContent = 'SEND MAGIC LINK INSTEAD';
      mlBtn.disabled = false;
    });
  });
}
```

---

## Step 7: Deploy

```bash
cd C:/Users/Daya/Documents/GitHub/saubhagyajewellery
git add -A
git commit -m "feat(auth): magic link login + password reset via email"
npx wrangler pages deploy . --project-name saubhagyajewellery --branch main
# Verify:
curl -sL https://saubhagyajewellery.com/reset-password.html | head -5
```

---

## Step 8: Test Checklist

- [ ] `POST /api/auth/magic-link` with registered email → email received?
- [ ] Click magic link → auto-login to account.html?
- [ ] `POST /api/auth/forgot-password` → email received?
- [ ] Click reset link → reset-password.html loads with form?
- [ ] Enter new password → success → redirect to signin?
- [ ] Sign in with new password → works?

---

## Summary

| Step | What | Who |
|------|------|-----|
| 1 | Verify Resend domain | Daya |
| 2 | Create D1 table | Claude |
| 3 | Add 2 email functions to _lib.js | Claude |
| 4 | Create 4 API endpoints | Claude |
| 5 | Create reset-password.html | Claude |
| 6 | Update signin.html | Claude |
| 7 | Deploy | Claude |
| 8 | Test | Daya |

**Total new files:** 5  
**Files to edit:** 2 (_lib.js, signin.html)  
**D1 changes:** 1 new table
