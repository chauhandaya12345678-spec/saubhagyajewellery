/**
 * Saubhagya – Verify OTP + Sign In (Twilio Verify)
 * POST /api/auth/verify-otp
 * Body: { phone, code, name? }
 * Returns: { success: true, token, user: { id, name, email, phone } }
 *
 * On approved code: existing phone → sign in; unknown phone → auto-create
 * account (phone verified via OTP, so is_guest=0 — more trustworthy than
 * a checkout guest row). Session token issued exactly like /api/auth/signin.
 *
 * Env vars required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
 */
import { normPhone, hashPassword, sendWelcomeEmail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_VERIFY_SID: verifySid } = env;
    if (!sid || !token || !verifySid) {
      return json({ error: 'SMS sign-in is not configured yet. Please use email/password.' }, 501);
    }

    const body = await request.json();
    const phone = normPhone(body.phone);
    const code = String(body.code || '').trim();
    if (!phone) return json({ error: 'Enter a valid 10-digit mobile number.' }, 400);
    if (!code || code.length < 4) return json({ error: 'Enter the 6-digit code.' }, 400);

    const res = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(sid + ':' + token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: '+91' + phone, Code: code }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.status !== 'approved') {
      const friendly = data.code === 60202 ? 'Wrong code. Please try again.'
        : data.code === 60203 ? 'Too many attempts. Request a new code.'
        : data.status === 'pending' ? 'Wrong code. Please try again.'
        : (data.message || 'Could not verify code. Please try again.');
      return json({ error: friendly, code: data.code }, 400);
    }

    const db = env.DB;
    let user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();

    if (!user) {
      const name = (body.name || 'Guest').trim() || 'Guest';
      const autoPwd = await hashPassword(crypto.randomUUID());
      let created;
      try {
        created = await db.prepare(
          'INSERT INTO users (name, phone, password, is_guest) VALUES (?, ?, ?, 0)'
        ).bind(name, phone, autoPwd).run();
      } catch (e) {
        if (!/no such column/i.test(e.message)) throw e;
        created = await db.prepare(
          'INSERT INTO users (name, phone, password) VALUES (?, ?, ?)'
        ).bind(name, phone, autoPwd).run();
      }
      user = { id: created.meta.last_row_id, name, email: null, phone };
    } else if (user.is_guest === 1) {
      // A checkout-guest row with this phone — OTP verification claims it as a real account.
      try { await db.prepare("UPDATE users SET is_guest = 0, updated_at = datetime('now') WHERE id = ?").bind(user.id).run(); } catch (e) {}
    }

    const sessionToken = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    await db.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(user.id, sessionToken, user.email || user.phone, user.name).run();

    return json({
      success: true,
      token: sessionToken,
      user: { id: user.id, name: user.name, email: user.email || null, phone: user.phone },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
