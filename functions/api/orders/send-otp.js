/**
 * POST /api/orders/send-otp
 * Body: { email, phone, name }
 * Generates a 6-digit OTP, emails it via Resend, stores it in D1.
 * Rate limited: max 3 OTPs per email per 15 minutes — this is the COD
 * spam gate (see COD-SECURITY.md); online payment is never touched.
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
    const emailN = normEmail(email);
    const phoneN = normPhone(phone);
    if (!emailN || !phoneN) return json({ error: 'Valid email and phone required' }, 400);

    const db = env.DB;
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const recent = await db.prepare(
      "SELECT COUNT(*) AS cnt FROM order_otps WHERE lower(email) = ? AND created_at > ?"
    ).bind(emailN, fifteenMinAgo).first();
    if (recent && recent.cnt >= 3) {
      return json({ error: 'Too many verification codes requested. Please wait 15 minutes and try again.' }, 429);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.prepare(
      'INSERT INTO order_otps (email, phone, otp, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(emailN, phoneN, otp, expiresAt).run();

    const key = env.RESEND_API_KEY;
    if (key) {
      const first = String(name || 'there').split(' ')[0];
      const from = env.ORDER_EMAIL_FROM || 'Saubhagya Jewellery <care@saubhagyajewellery.com>';
      const html =
`<div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
  <div style="text-align:center;padding:24px 0 10px"><div style="font:600 22px Georgia,serif;color:#0B291C">SAUBHAGYA</div></div>
  <div style="padding:8px 24px 24px;text-align:center">
    <h2 style="font:600 18px Georgia,serif;color:#0B291C;margin:0 0 8px">Verify your Cash on Delivery order</h2>
    <p style="font-size:13px;color:#4a4a4a">Hi ${first}, use this code to confirm your COD order:</p>
    <div style="font:700 34px monospace;letter-spacing:8px;color:#0B291C;padding:18px;margin:16px 0;background:#faf8f3;border-radius:8px">${otp}</div>
    <p style="font-size:12px;color:#9a9a9a">Expires in 10 minutes. Didn't request this? Ignore this email.</p>
  </div>
</div>`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [emailN], subject: `${otp} is your Saubhagya COD verification code`, html }),
        });
      } catch (e) { /* best-effort — verify-otp will just report "no active code" */ }
    }

    return json({ success: true, message: 'Verification code sent to your email.', expires_in: 600 });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
