/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * If email exists → generate reset token, send reset email. Always returns
 * generic success so we don't leak registered emails.
 */
import { sendPasswordResetEmail, normEmail, normPhone } from '../_lib.js';

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
    const body = await request.json();
    const raw = String(body.identifier || body.email || body.phone || '').trim();
    const generic = 'If an account exists for that email or phone, a password reset link has been sent to the email on file.';
    if (!raw) return json({ success: true, message: generic });

    let user = null;
    if (raw.includes('@')) {
      const em = normEmail(raw);
      if (em) user = await env.DB.prepare('SELECT id, name, email FROM users WHERE lower(email) = ?').bind(em).first();
    } else {
      const ph = normPhone(raw);
      if (ph) user = await env.DB.prepare('SELECT id, name, email FROM users WHERE phone = ?').bind(ph).first();
    }
    if (!user || !user.email) return json({ success: true, message: generic });

    const emailKey = normEmail(user.email);
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      "UPDATE password_resets SET used = 1 WHERE lower(email) = ? AND type = 'reset' AND used = 0"
    ).bind(emailKey).run();

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(emailKey, token, 'reset', expiresAt).run();

    const r = await sendPasswordResetEmail(env, user.email, user.name, token);
    return json({ success: true, message: generic, email_sent: r.sent, resend_error: r.error || undefined });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
