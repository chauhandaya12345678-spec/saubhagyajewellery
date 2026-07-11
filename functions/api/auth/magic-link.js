/**
 * POST /api/auth/magic-link
 * Body: { email }
 * If email exists → generate token, send magic link. Always returns generic
 * success so we don't leak registered emails.
 */
import { sendMagicLinkEmail, normEmail, normPhone } from '../_lib.js';

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
    const generic = 'If that account is registered, a sign-in link has been sent to the email on file.';
    if (!raw) return json({ success: true, message: generic });

    /* Accept either email or 10-digit phone. Phone lookup finds account,
       magic link still lands on the email on that account.               */
    let user = null;
    if (raw.includes('@')) {
      const em = normEmail(raw);
      if (em) user = await env.DB.prepare('SELECT id, name, email FROM users WHERE lower(email) = ?').bind(em).first();
    } else {
      const ph = normPhone(raw);
      if (ph) user = await env.DB.prepare('SELECT id, name, email FROM users WHERE phone = ?').bind(ph).first();
    }
    if (!user || !user.email) return json({ success: true, message: generic });

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO password_resets (email, token, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(normEmail(user.email), token, 'magiclink', expiresAt).run();

    const r = await sendMagicLinkEmail(env, user.email, user.name, token);
    return json({ success: true, message: generic, email_sent: r.sent, resend_error: r.error || undefined });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
