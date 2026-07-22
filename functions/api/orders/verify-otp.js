/**
 * POST /api/orders/verify-otp
 * Body: { email, phone, otp }
 * Verifies a COD OTP → returns a short-lived verification_token that
 * /api/orders/save requires for any payment_method:'cod' order.
 * Max 3 wrong attempts per OTP before it's burned.
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
    const { email, phone, otp } = await request.json();
    const emailN = normEmail(email);
    const phoneN = normPhone(phone);
    if (!emailN || !phoneN || !otp) return json({ error: 'Email, phone, and code required' }, 400);

    const db = env.DB;
    const row = await db.prepare(
      "SELECT id, otp, attempts FROM order_otps WHERE lower(email) = ? AND phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(emailN, phoneN).first();

    if (!row) return json({ error: 'No active code found. Please request a new one.' }, 400);

    if (row.attempts >= 3) {
      await db.prepare('UPDATE order_otps SET used = 1 WHERE id = ?').bind(row.id).run();
      return json({ error: 'Too many wrong attempts. Please request a new code.' }, 400);
    }

    if (String(row.otp) !== String(otp).trim()) {
      await db.prepare('UPDATE order_otps SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
      const remaining = 2 - row.attempts;
      return json({ error: `Wrong code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }, 400);
    }

    await db.prepare('UPDATE order_otps SET used = 1 WHERE id = ?').bind(row.id).run();

    const vToken = 'vfy_' + crypto.randomUUID().replace(/-/g, '');
    await db.prepare(
      "INSERT INTO cod_verifications (token, email, phone, expires_at) VALUES (?, ?, ?, datetime('now', '+30 minutes'))"
    ).bind(vToken, emailN, phoneN).run();

    return json({ success: true, verification_token: vToken });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
