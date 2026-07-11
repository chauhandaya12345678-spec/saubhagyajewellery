/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 * Verify reset token → update user password → return success
 */
import { hashPassword } from '../_lib.js';

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
    const { token, new_password } = await request.json();
    if (!token || typeof token !== 'string' || token.length < 10) return json({ error: 'Invalid or expired link' }, 400);
    if (!new_password || String(new_password).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

    const row = await env.DB.prepare(
      'SELECT id, email, type, expires_at, used FROM password_resets WHERE token = ?'
    ).bind(token.trim()).first();

    if (!row) return json({ error: 'Invalid or expired link' }, 400);
    if (row.type !== 'reset') return json({ error: 'Invalid link type' }, 400);
    if (row.used) return json({ error: 'This link has already been used' }, 400);
    if (new Date(row.expires_at) < new Date()) return json({ error: 'This link has expired. Please request a new one.' }, 400);

    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();

    const hashedPw = await hashPassword(new_password);
    await env.DB.prepare('UPDATE users SET password = ? WHERE lower(email) = ?').bind(hashedPw, row.email).run();

    return json({ success: true, message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
