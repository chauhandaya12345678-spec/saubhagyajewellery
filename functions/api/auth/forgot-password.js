/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * If email exists → generate reset token, send reset email. Always returns
 * generic success so we don't leak registered emails.
 */
import { sendPasswordResetEmail, normEmail } from '../_lib.js';

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
    const { email } = await request.json();
    const normed = normEmail(email);
    const generic = 'If an account exists for that email, a password reset link has been sent.';
    if (!normed) return json({ success: true, message: generic });

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE lower(email) = ?').bind(normed).first();
    if (!user) return json({ success: true, message: generic });

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      "UPDATE password_resets SET used = 1 WHERE lower(email) = ? AND type = 'reset' AND used = 0"
    ).bind(normed).run();

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normed, token, 'reset', expiresAt).run();

    const r = await sendPasswordResetEmail(env, normed, user.name, token);
    return json({ success: true, message: generic, email_sent: r.sent });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
