/**
 * Saubhagya – Sign Up API
 * POST /api/auth/signup
 * Body: { name, email?, phone?, password }
 * Returns: { success: true, token, user: { id, name, email, phone } }
 */
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
    const { name, email, phone, password } = await request.json();
    if (!name || !password) {
      return new Response(JSON.stringify({ error: 'Name and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Email or phone is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const db = env.DB;

    // Check if email already exists
    if (email) {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'An account with this email already exists. Please sign in.' }), { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }
    if (phone) {
      const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'An account with this phone already exists. Please sign in.' }), { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // Create user
    const result = await db.prepare(
      'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)'
    ).bind(name, email || null, phone || null, password).run();

    const userId = result.meta.last_row_id;

    // Create session token
    const token = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    await db.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(userId, token, email || phone || '', name).run();

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: userId, name, email, phone }
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
