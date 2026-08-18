/**
 * GET /api/admin/manifest?date=YYYY-MM-DD   (owner)
 *   → daily pickup handover sheet: every packed/shipped order with an AWB for
 *     that date. ShipPrime has no manifest API, so this is built from D1.
 *   Defaults to today (IST). Also returns the seller pickup block from settings.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { loadBusinessConfig, hydrateOrder } from './_docs.js';

const j = (o, s, cors) => new Response(JSON.stringify(o), {
  status: s || 200, headers: { 'Content-Type': 'application/json', ...cors },
});

const MANIFEST_STATUSES = ['packed', 'shipped', 'out_for_delivery'];

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    // Default to "today" in IST (UTC+5:30).
    const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
    const date = url.searchParams.get('date') || istNow.toISOString().slice(0, 10);

    const placeholders = MANIFEST_STATUSES.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT id, name, items, total, address, payment_method, shipprime_awb, created_at, updated_at
         FROM orders
        WHERE shipprime_awb IS NOT NULL AND shipprime_awb != ''
          AND COALESCE(test_mode, 0) = 0
          AND LOWER(COALESCE(status,'')) IN (${placeholders})
          AND date(COALESCE(updated_at, created_at)) = ?
        ORDER BY updated_at ASC`
    ).bind(...MANIFEST_STATUSES, date).all();

    const business = await loadBusinessConfig(env);
    const list = (rows.results || []).map((r) => {
      const o = hydrateOrder(r);
      const weightGrams = (o.items || []).reduce((s, it) =>
        s + (Number(it.weightGrams) || 0) * (Number(it.qty || it.quantity || 1) || 1), 0);
      const isCod = String(o.payment_method || '').toLowerCase().includes('cod');
      return {
        id: o.id,
        awb: o.shipprime_awb,
        name: o.name || '',
        city: (o.address && o.address.city) || '',
        pin: (o.address && o.address.pin) || '',
        weightGrams,
        codPaise: isCod ? (Number(o.total) || 0) : 0,
        totalPaise: Number(o.total) || 0,
      };
    });

    return j({ success: true, date, business, count: list.length, rows: list }, 200, cors);
  } catch (e) {
    return j({ error: String(e.message || e) }, 500, cors);
  }
}
