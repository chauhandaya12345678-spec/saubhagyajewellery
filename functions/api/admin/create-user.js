/**
 * POST /api/admin/create-user
 * Body: { username, password, role: 'owner'|'staff' }
 * Owner-only. Creates a named admin account (see build/migrate-2026-07-22-admin-users.sql).
 */
import { verifyAdminAccess, adminCorsHeaders, hashPassword } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: true });
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = body.role === 'owner' ? 'owner' : 'staff';

  if (!username || username.length < 3) {
    return new Response(JSON.stringify({ error: 'Username must be at least 3 characters' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (!password || password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const db = env.DB;
    const hash = await hashPassword(password);
    await db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').bind(username, hash, role).run();
    return new Response(JSON.stringify({ success: true, username, role }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const msg = /UNIQUE/i.test(String(err.message)) ? 'Username already exists' : String(err.message || err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
