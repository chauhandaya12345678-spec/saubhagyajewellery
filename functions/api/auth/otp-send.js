/**
 * POST /api/auth/otp-send
 * Body: { phone, turnstileToken }
 * Sign-in OTP, delivered over WhatsApp (login_otp Authentication template) —
 * replaces Firebase Phone Auth + Google reCAPTCHA. Cloudflare Turnstile
 * gates it instead: proof-of-work, no visual challenge for real users.
 */
import { rateLimitCheck } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { phone, turnstileToken } = await request.json();
    const phoneN = String(phone || '').replace(/\D/g, '').slice(-10);
    if (phoneN.length !== 10) return json({ error: 'Enter a valid 10-digit mobile number.' }, 400);
    if (!turnstileToken) return json({ error: 'Verification failed. Please try again.' }, 400);

    const secret = env.TURNSTILE_SECRET_KEY;
    if (!secret) return json({ error: 'Sign-in is not configured yet.' }, 501);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: turnstileToken, remoteip: ip }),
    });
    const tsData = await tsRes.json().catch(() => ({}));
    if (!tsData.success) return json({ error: 'Verification failed. Please try again.' }, 400);

    const db = env.DB;
    const okIp = await rateLimitCheck(db, 'otp-send-ip:' + ip, 10, 15);
    const okPhone = await rateLimitCheck(db, 'otp-send-phone:' + phoneN, 4, 15);
    if (!okIp || !okPhone) {
      return json({ error: 'Too many codes requested. Please wait 15 minutes and try again.' }, 429);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.prepare(
      'INSERT INTO login_otps (phone, otp, expires_at) VALUES (?, ?, ?)'
    ).bind(phoneN, otp, expiresAt).run();

    const phoneId = env.WHATSAPP_PHONE_ID, waToken = env.WHATSAPP_TOKEN;
    if (!phoneId || !waToken) return json({ error: 'Sign-in is not configured yet.' }, 501);

    const waRes = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + waToken },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '91' + phoneN,
        type: 'template',
        template: {
          name: 'login_otp',
          language: { code: 'en_US' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: otp }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
          ],
        },
      }),
    });
    const waData = await waRes.json().catch(() => ({}));
    if (!waRes.ok) {
      return json({ error: waData.error?.message || 'Could not send code. Please try again.' }, 502);
    }

    return json({ success: true, message: 'Code sent on WhatsApp.', expires_in: 600 });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
