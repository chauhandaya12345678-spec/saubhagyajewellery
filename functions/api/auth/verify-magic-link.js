/**
 * POST /api/auth/verify-magic-link
 * Body: { token }
 * Verify magic link token → create session → return user + session_token
 */
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
    const { token } = await request.json();
    if (!token || typeof token !== 'string' || token.length < 10) return json({ error: 'Invalid or expired link' }, 400);

    const row = await env.DB.prepare(
      'SELECT id, email, type, expires_at, used FROM password_resets WHERE token = ?'
    ).bind(token.trim()).first();

    if (!row) return json({ error: 'Invalid or expired link' }, 400);
    if (row.type !== 'magiclink') return json({ error: 'Invalid link type' }, 400);
    if (row.used) return json({ error: 'This link has already been used' }, 400);
    if (new Date(row.expires_at) < new Date()) return json({ error: 'This link has expired. Please request a new one.' }, 400);

    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();

    const user = await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE lower(email) = ?').bind(row.email).first();
    if (!user) return json({ error: 'Account not found' }, 400);

    const sessionToken = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    await env.DB.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(user.id, sessionToken, user.email || '', user.name || 'Guest').run();

    return json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      session_token: sessionToken,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
