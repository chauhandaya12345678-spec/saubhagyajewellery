/**
 * Saubhagya – Sync order status from ShipPrime + send customer WhatsApp
 * GET /api/orders/sync-status
 *
 * Polls ShipPrime tracking for every in-transit order and applies status
 * changes to D1, firing the customer WhatsApp status template on each change.
 * This is the self-driven replacement for ShipPrime's status webhook (which
 * was never firing) — status notifications now work without depending on any
 * ShipPrime dashboard config.
 *
 * Auth: header `x-admin-key` (or ?key=) must match env.ADMIN_KEY.
 * Wire an external cron (https://cron-job.org, free) to hit this every ~30min:
 *   GET https://saubhagyajewellery.com/api/orders/sync-status
 *   Header: x-admin-key: <ADMIN_KEY>
 * (retry-shipprime already calls this too, so an existing retry cron covers it.)
 */
import { syncActiveOrderStatuses } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });

  const adminKey = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key') || '';
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) return json({ error: 'unauthorized' }, 401);

  try {
    const dryRun = ['1', 'true', 'yes'].includes((new URL(request.url).searchParams.get('dry') || '').toLowerCase());
    const out = await syncActiveOrderStatuses(env, env.DB, 25, { dryRun });
    // Dead-man's-switch: ping Healthchecks.io on a real (non-dry) success so
    // you're alerted if this cron ever silently stops. No-ops if unset. Never
    // throws — a failed ping must not fail the sync.
    if (!dryRun && env.HEALTHCHECK_URL) {
      try { await fetch(env.HEALTHCHECK_URL); } catch { /* ignore */ }
    }
    return json(out);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
