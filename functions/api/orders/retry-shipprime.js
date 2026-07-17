/**
 * Saubhagya – Retry ShipPrime pushes for failed orders
 *
 * Sweep orders that:
 *   - have no shipprime_awb (never pushed OR previous push failed)
 *   - have a shipprime_error (means push was attempted and rejected)
 *   - are at least 5 minutes old (give order.paid webhook time to fill address)
 *   - were placed in the last 7 days (older failures need manual review)
 *
 * Auth: requires header `x-admin-key` to match env.ADMIN_KEY. Set the secret
 * in Cloudflare Pages env vars, then wire an external cron hitter to call:
 *   GET https://saubhagyajewellery.com/api/orders/retry-shipprime
 *   Header: x-admin-key: <your-secret>
 *
 * Recommended cron: every 30 minutes via https://cron-job.org (free tier).
 * Cloudflare Pages Functions do not support native scheduled triggers on
 * the free tier — this endpoint bridges to any external cron.
 */
import { pushToShipPrime, recordShipprimeResult, logOrderEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });

  const adminKey = request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const db = env.DB;

    // Grab up to 20 candidates per run (keeps request under the 30s wall)
    const rows = await db.prepare(
      `SELECT id, name, email, phone, address, items, total, payment_method, shipprime_attempts
         FROM orders
        WHERE (shipprime_awb IS NULL OR shipprime_awb = '')
          AND test_mode = 0
          AND datetime(created_at) < datetime('now', '-5 minutes')
          AND datetime(created_at) > datetime('now', '-7 days')
          AND COALESCE(shipprime_attempts, 0) < 5
        ORDER BY created_at DESC
        LIMIT 20`
    ).all().catch(() => ({ results: [] }));

    const candidates = rows.results || [];
    const summary = { scanned: candidates.length, pushed: 0, skipped: 0, failed: 0, details: [] };

    for (const row of candidates) {
      const items = typeof row.items === 'string' ? (() => { try { return JSON.parse(row.items); } catch { return []; } })() : (row.items || []);
      const orderForPush = {
        id: row.id,
        name: row.name || 'Customer',
        email: row.email || '',
        phone: row.phone || '',
        address: row.address,
        items,
        totalPaise: row.total || 0,
        paymentMethod: row.payment_method || 'razorpay',
      };
      const sp = await pushToShipPrime(env, orderForPush, db);
      try { await recordShipprimeResult(db, row.id, sp); } catch (e) {}
      if (sp.pushed) {
        try { await logOrderEvent(db, row.id, 'shipprime_retry_ok', 1, 'AWB ' + sp.awb); } catch (e) {}
        summary.pushed++;
      } else if (/incomplete address/i.test(sp.error || '')) {
        summary.skipped++;
      } else {
        summary.failed++;
      }
      summary.details.push({ id: row.id, pushed: sp.pushed, error: sp.error || null, awb: sp.awb || null });
    }

    return json({ success: true, ...summary });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
