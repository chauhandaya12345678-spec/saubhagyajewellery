/**
 * Saubhagya – Send OTP (Twilio Verify)
 * POST /api/auth/send-otp
 * Body: { phone }
 * Returns: { success: true } or { error }
 *
 * Uses Twilio Verify API v2 — Twilio owns OTP generation, expiry (10 min)
 * and attempt/rate limiting server-side. No OTP is ever stored in D1.
 *
 * Env vars required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
 */
import { normPhone } from '../_lib.js';

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
    if (!phone) return json({ error: 'Enter a valid 10-digit mobile number.' }, 400);

    const res = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}/Verifications`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(sid + ':' + token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: '+91' + phone, Channel: 'sms' }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Twilio error codes worth surfacing distinctly:
      //   60203 = max send attempts reached (rate limited by Twilio)
      //   60200 = invalid phone number
      const friendly = data.code === 60203
        ? 'Too many attempts. Please try again in a few minutes.'
        : (data.message || 'Could not send OTP. Please try again.');
      return json({ error: friendly, code: data.code }, res.status >= 400 && res.status < 500 ? 400 : 502);
    }

    return json({ success: true, status: data.status });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
