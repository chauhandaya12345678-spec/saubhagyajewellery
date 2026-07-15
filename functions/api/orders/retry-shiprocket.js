/**
 * Saubhagya – Shiprocket manual retry endpoint
 *
 *   POST /api/orders/retry-shiprocket
 *   Body: { admin_key: "…", order_id?: "CC-…", sweep?: true, max?: 10 }
 *
 * Modes:
 *   • order_id="CC-…"  → retry that one order (idempotent — no-op if already pushed)
 *   • sweep=true       → retry every order with shiprocket_order_id IS NULL
 *                        AND created_at within the last 7 days, cap at `max`
 *                        (default 10) to stay under the 30s worker limit.
 *
 * Auth: SHIPROCKET_RETRY_KEY env var must match admin_key. Set it in the
 * Cloudflare Pages settings — don't commit it.
 *
 * Every attempt is logged to orders.shiprocket_error + order_events so the
 * next call knows what happened last time.
 */
import { pushToShiprocket, recordShiprocketResult, logOrderEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'invalid JSON body' }, 400); }

  const expected = env.SHIPROCKET_RETRY_KEY;
  if (!expected) return json({ error: 'SHIPROCKET_RETRY_KEY not configured on server' }, 501);
  if (body.admin_key !== expected) return json({ error: 'unauthorized' }, 401);

  const db = env.DB;

  async function retryOne(row) {
    const items = safeParse(row.items, []);
    const address = row.address || '{}';
    // ── Validate pincode before pushing ──
    // Prevents invalid addresses from locking the Shiprocket account
    let addrCheck = address;
    if (typeof addrCheck === 'string') { try { addrCheck = JSON.parse(addrCheck); } catch (e) { addrCheck = {}; } }
    addrCheck = addrCheck || {};
    const pin = String(addrCheck.pin || '').replace(/\D/g, '');
    if (pin.length !== 6) {
      const skip = { pushed: false, error: 'skipped — invalid pincode "' + (addrCheck.pin || '') + '" — update address and retry' };
      await recordShiprocketResult(db, row.id, skip);
      await logOrderEvent(db, row.id, 'shiprocket_retry', 0, skip.error);
      return { id: row.id, ...skip };
    }
    const orderForPush = {
      id: row.id,
      name: row.name || 'Guest',
      email: row.email || '',
      phone: row.phone || '',
      address,
      items,
      totalPaise: row.total,
      paymentMethod: row.payment_method || 'razorpay',
    };
    const sr = await Promise.race([
      pushToShiprocket(env, orderForPush),
      new Promise(res => setTimeout(() => res({ pushed: false, error: 'timeout (Shiprocket >22s)' }), 22000)),
    ]).catch(e => ({ pushed: false, error: 'push exception: ' + e.message }));
    await recordShiprocketResult(db, row.id, sr);
    await logOrderEvent(db, row.id, 'shiprocket_retry', sr.pushed, sr.pushed ? JSON.stringify(sr) : sr.error);
    return { id: row.id, ...sr };
  }

  // Single-order retry
  if (body.order_id) {
    const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(body.order_id).first();
    if (!row) return json({ error: 'order not found' }, 404);
    if (row.shiprocket_order_id) return json({ ok: true, order_id: row.id, already_pushed: row.shiprocket_order_id });
    const result = await retryOne(row);
    return json({ ok: !!result.pushed, ...result });
  }

  // Sweep: retry every unpushed order in the last 7 days.
  if (body.sweep) {
    const max = Math.max(1, Math.min(50, Number(body.max) || 10));
    let rows;
    try {
      const q = await db.prepare(
        `SELECT * FROM orders
         WHERE shiprocket_order_id IS NULL
           AND (test_mode IS NULL OR test_mode = 0)
           AND datetime(created_at) > datetime('now', '-7 days')
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      ).bind(max).all();
      rows = q.results || [];
    } catch (e) {
      // Pre-migration schema fallback: no test_mode column
      const q = await db.prepare(
        `SELECT * FROM orders
         WHERE shiprocket_order_id IS NULL
           AND datetime(created_at) > datetime('now', '-7 days')
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      ).bind(max).all();
      rows = q.results || [];
    }
    const results = [];
    for (const row of rows) results.push(await retryOne(row));
    const pushed = results.filter(r => r.pushed).length;
    return json({ ok: true, checked: rows.length, pushed, failed: rows.length - pushed, results });
  }

  return json({ error: 'pass either { order_id: "CC-…" } or { sweep: true, max?: N }' }, 400);
}

function safeParse(v, fallback) {
  if (typeof v !== 'string') return v || fallback;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}
