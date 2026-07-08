/**
 * Saubhagya – Sign In API
 * POST /api/auth/signin
 * Body: { email?, phone?, password }
 * Returns: { success: true, token, user: { id, name, email, phone } }
 */
import { verifyPassword, hashPassword } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const { email, phone, password } = await request.json();
    if (!password) {
      return new Response(JSON.stringify({ error: 'Password is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Email or phone is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const db = env.DB;
    let user;

    if (email) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    } else {
      user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'No account found with this email/phone' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!(await verifyPassword(password, user.password))) {
      return new Response(JSON.stringify({ error: 'Incorrect password' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    // Upgrade legacy plaintext rows to salted hash on successful login
    if (!String(user.password).startsWith('s256$')) {
      try {
        await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(await hashPassword(password), user.id).run();
      } catch (e) {}
    }

    // Create session token
    const token = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    await db.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(user.id, token, user.email || user.phone, user.name).run();

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
