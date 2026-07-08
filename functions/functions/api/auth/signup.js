/**
 * Saubhagya – Sign Up API
 * POST /api/auth/signup
 * Body: { name, email?, phone?, password }
 * Returns: { success: true, token, user: { id, name, email, phone } }
 */
import { hashPassword } from '../_lib.js';

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

    // Find any existing account under this email or phone
    let existing = null;
    if (email) existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!existing && phone) existing = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();

    let userId;
    if (existing) {
      // Guest rows are auto-created at checkout with an unknowable random password.
      // Signing up with the same email/phone claims that account (orders are already
      // queryable by phone without auth, so this exposes nothing new).
      const isGuest = existing.is_guest === 1 || String(existing.password || '').startsWith('guest_');
      if (!isGuest) {
        return new Response(JSON.stringify({ error: 'An account with this email/phone already exists. Please sign in.' }), { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const hashed = await hashPassword(password);
      const newEmail = existing.email || email || null;
      const newPhone = existing.phone || phone || null;
      try {
        await db.prepare('UPDATE users SET name = ?, password = ?, email = ?, phone = ?, is_guest = 0, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(name, hashed, newEmail, newPhone, existing.id).run();
      } catch (e) {
        await db.prepare('UPDATE users SET name = ?, password = ? WHERE id = ?')
          .bind(name, hashed, existing.id).run();
      }
      userId = existing.id;
    } else {
      // Create user (password stored salted+hashed, never plaintext)
      const result = await db.prepare(
        'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)'
      ).bind(name, email || null, phone || null, await hashPassword(password)).run();
      userId = result.meta.last_row_id;
    }

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
