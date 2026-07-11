/**
 * POST /api/auth/magic-link
 * Body: { email }
 * If email exists → generate token, send magic link. Always returns generic
 * success so we don't leak registered emails.
 */
import { sendMagicLinkEmail, normEmail } from '../_lib.js';

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
    const generic = 'If that email is registered, a sign-in link has been sent.';
    if (!normed) return json({ success: true, message: generic });

    const user = await env.DB.prepare('SELECT id, name FROM users WHERE lower(email) = ?').bind(normed).first();
    if (!user) return json({ success: true, message: generic });

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normed, token, 'magiclink', expiresAt).run();

    const r = await sendMagicLinkEmail(env, normed, user.name, token);
    return json({ success: true, message: generic, email_sent: r.sent });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
