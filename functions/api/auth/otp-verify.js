/**
 * POST /api/auth/otp-verify
 * Body: { phone, otp }
 * Verifies the WhatsApp-delivered sign-in code, finds or creates the D1
 * user (recovering name/email from past orders if needed — see
 * findOrCreateUserByPhone), and issues a session token.
 */
import { genSessionToken, findOrCreateUserByPhone, constantTimeEqual } from '../_lib.js';

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
    const { phone, otp } = await request.json();
    const phoneN = String(phone || '').replace(/\D/g, '').slice(-10);
    const codeN = String(otp || '').trim();
    if (phoneN.length !== 10 || !codeN) return json({ error: 'Enter the 6-digit code.' }, 400);

    const db = env.DB;
    const row = await db.prepare(
      "SELECT id, otp, attempts FROM login_otps WHERE phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(phoneN).first();

    if (!row) return json({ error: 'Session expired. Please request a new code.' }, 400);

    if (row.attempts >= 3) {
      await db.prepare('UPDATE login_otps SET used = 1 WHERE id = ?').bind(row.id).run();
      return json({ error: 'Too many wrong attempts. Please request a new code.' }, 400);
    }

    if (!constantTimeEqual(row.otp, codeN)) {
      await db.prepare('UPDATE login_otps SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
      const remaining = 2 - row.attempts;
      return json({ error: `Wrong code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }, 400);
    }

    await db.prepare('UPDATE login_otps SET used = 1 WHERE id = ?').bind(row.id).run();

    const user = await findOrCreateUserByPhone(db, phoneN, {});
    const sessionToken = genSessionToken();
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
