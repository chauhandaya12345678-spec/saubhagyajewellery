/**
 * GET  /api/admin/business-settings  → business/tax identity (defaults merged)
 * POST /api/admin/business-settings  → save it (owner only)
 *
 * Single source of truth for the legal invoice (GSTIN, HSN, rate, address,
 * bank, invoice-number prefix). Persisted as one JSON blob in `settings` under
 * key 'business_config'. Independent of ShipPrime.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { BUSINESS_DEFAULTS, loadBusinessConfig, cleanBusinessConfig } from './_docs.js';

const j = (o, s, cors) => new Response(JSON.stringify(o), {
  status: s || 200, headers: { 'Content-Type': 'application/json', ...cors },
});

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: request.method === 'POST' });
  if (auth.response) return auth.response;

  if (request.method === 'GET') {
    const config = await loadBusinessConfig(env);
    return j({ success: true, config, defaults: BUSINESS_DEFAULTS }, 200, cors);
  }

  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch { return j({ error: 'Invalid JSON' }, 400, cors); }
    const clean = cleanBusinessConfig(b);
    try {
      await env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind('business_config', JSON.stringify(clean)).run();
    } catch (e) { return j({ error: String(e.message || e) }, 500, cors); }
    return j({ success: true, config: clean }, 200, cors);
  }

  return j({ error: 'Method not allowed' }, 405, cors);
}
