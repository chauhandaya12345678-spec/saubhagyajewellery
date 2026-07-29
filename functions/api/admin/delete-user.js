/**
 * POST /api/admin/delete-user
 * Body: { id }
 * Owner-only. Refuses to delete the last remaining owner account so the
 * panel can never lock everyone out.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

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
  const id = parseInt(body.id, 10);
  if (!id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const db = env.DB;
    const target = await db.prepare('SELECT role FROM admin_users WHERE id = ?').bind(id).first();
    if (!target) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (target.role === 'owner') {
      const ownerCount = await db.prepare("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'owner'").first();
      if (ownerCount.c <= 1) {
        return new Response(JSON.stringify({ error: 'Cannot delete the last owner account' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }
    await db.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
    await db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
