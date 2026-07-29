/**
 * POST /api/admin/login
 * Body: { username, password }
 * Returns: { success, token, role, username } — pass token back as
 * x-admin-session on subsequent /api/admin/* calls.
 */
import { adminLogin, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const result = await adminLogin(request, env, corsHeaders);
  const status = result.status || (result.success ? 200 : 401);
  return new Response(JSON.stringify(result), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
