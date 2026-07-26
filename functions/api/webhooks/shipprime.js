/**
 * ShipPrime Webhook — real-time order status updates
 * POST /api/webhooks/shipprime
 *
 * ShipPrime sends status changes (SHIPPED, OUT_FOR_DELIVERY, DELIVERED, etc.)
 * We update the D1 order status + updated_at so the track-orders page
 * always shows the latest status without polling ShipPrime API.
 *
 * Auth: ShipPrime's dashboard has a native "Secret Token" field that it
 * sends as `Authorization: Bearer <token>` — set that field to
 * SHIPPRIME_WEBHOOK_SECRET's value and leave the webhook URL plain. A
 * ?secret=... query param is also accepted as a fallback for providers
 * that don't support a secret-token field.
 *
 * Without this, anyone who finds the URL could POST fake status updates for
 * any AWB — including a fake 'rto' to trigger the auto-restock below.
 */
import { applyOrderStatus, constantTimeEqual } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const configuredSecret = env.SHIPPRIME_WEBHOOK_SECRET;
  if (!configuredSecret) return json({ error: 'SHIPPRIME_WEBHOOK_SECRET not configured' }, 501);
  const authHeader = request.headers.get('authorization') || '';
  const bearerSecret = authHeader.replace(/^Bearer\s+/i, '').trim();
  const providedSecret = bearerSecret || new URL(request.url).searchParams.get('secret') || request.headers.get('x-shipprime-secret') || '';
  if (!constantTimeEqual(providedSecret, configuredSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const db = env.DB;

    // ShipPrime webhook payload: { awb, currentStatus, statusDate, courier, ... }
    const awb = String(body.awb || body.awb_code || '').trim();
    const newStatus = String(body.currentStatus || body.status || '').trim();
    const statusDate = body.statusDate || body.status_date || new Date().toISOString();

    if (!awb) return json({ error: 'Missing AWB' }, 400);
    if (!newStatus) return json({ error: 'Missing status' }, 400);

    // Find order by AWB
    const order = await db.prepare(
      'SELECT id, phone, name, items, track_token, status, updated_at FROM orders WHERE shipprime_awb = ?'
    ).bind(awb).first().catch(() => null);

    if (!order) {
      return json({ ok: true, note: 'no matching order for AWB ' + awb });
    }

    // Single source of truth: update D1 + restock-on-RTO + customer WhatsApp,
    // all with event logging, shared with the cron status poller. No-ops if
    // the status is unchanged.
    const out = await applyOrderStatus(db, env, order, newStatus, 'shipprime-webhook');

    return json({
      ok: true,
      order_id: order.id,
      awb,
      previous: order.status,
      current: newStatus.toLowerCase(),
      changed: out.changed,
      whatsapp: out.wa ? out.wa.sent : null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
