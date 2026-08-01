/**
 * POST /api/admin/test-push  — send a test FCM alert to all registered admin
 * devices, so the owner can verify push works without placing a real order
 * (test ₹1 orders skip the new-order push by design).
 * Header: x-admin-key or x-admin-session.
 */
import { verifyAdminAccess, adminCorsHeaders, sendFcmToAdmins } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: false });
  if (auth.response) return auth.response;

  const r = await sendFcmToAdmins(
    env,
    { title: 'Saubhagya — test alert', body: 'Push notifications are working.' },
    { type: 'test' }
  );
  return new Response(JSON.stringify({ success: true, ...r }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
