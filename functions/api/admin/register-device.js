/**
 * POST /api/admin/register-device — store this device's FCM token so it
 * receives new-order push alerts. Called by the app after login + on token
 * refresh. Body: { token, platform }. Auth: admin (owner or staff).
 * DELETE /api/admin/register-device — remove a token (logout). Body: { token }.
 */
import { verifyAdminAccess, adminCorsHeaders, logEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders(request);

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: false });
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders); }
  const token = String(body.token || '').trim();
  if (!token) return json({ error: 'token required' }, 400, corsHeaders);

  try {
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM admin_devices WHERE token = ?').bind(token).run();
      return json({ success: true, removed: true }, 200, corsHeaders);
    }

    const platform = String(body.platform || 'android').slice(0, 20);
    const username = auth.username || 'admin';
    await env.DB.prepare(
      `INSERT INTO admin_devices (token, username, platform, created_at, last_seen)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(token) DO UPDATE SET
         username = excluded.username,
         platform = excluded.platform,
         last_seen = datetime('now')`
    ).bind(token, username, platform).run();

    await logEvent(env.DB, { level: 'info', source: 'register-device', message: `device registered (${platform})`, meta: { username } });
    return json({ success: true }, 200, corsHeaders);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500, corsHeaders);
  }
}

function json(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
