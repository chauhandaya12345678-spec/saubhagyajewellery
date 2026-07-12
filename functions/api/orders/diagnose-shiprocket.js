/**
 * Saubhagya – Shiprocket credential + pickup diagnostic
 *
 *   POST /api/orders/diagnose-shiprocket
 *   Body: { admin_key: "…" }
 *
 * Tests:
 *   1. env vars set?              (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD)
 *   2. login works?               (real API call, but no order created)
 *   3. pickup location valid?     (list pickup locations, check name match)
 *   4. recent orders unpushed?    (last 7 days count)
 *   5. recent errors?             (last 5 shiprocket_error strings)
 *
 * Run this WHENEVER an order fails so you know if it's stale password vs
 * timeout vs pickup mismatch vs rate-limit. No orders created here.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const expected = env.SHIPROCKET_RETRY_KEY;
  if (!expected) return json({ error: 'SHIPROCKET_RETRY_KEY not configured' }, 501);
  if (body.admin_key !== expected) return json({ error: 'unauthorized' }, 401);

  const report = {
    ts: new Date().toISOString(),
    env: {
      SHIPROCKET_EMAIL: !!env.SHIPROCKET_EMAIL,
      SHIPROCKET_PASSWORD: !!env.SHIPROCKET_PASSWORD,
      SHIPROCKET_PICKUP_LOCATION: env.SHIPROCKET_PICKUP_LOCATION || 'Primary (default)',
    },
    login: { attempted: false, ok: false, error: null, token_preview: null },
    pickup: { checked: false, ok: false, configured_name: null, panel_names: [], match: false, error: null },
    recent_orders: { last_7d_unpushed: 0, error_samples: [] },
  };

  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    report.login.error = 'env vars missing';
    return json(report, 200);
  }

  // 1. Login test
  try {
    report.login.attempted = true;
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      report.login.ok = true;
      report.login.token_preview = String(data.token).slice(0, 24) + '…';
    } else {
      report.login.error = `HTTP ${res.status}: ${data.message || JSON.stringify(data).slice(0, 200)}`;
      // Common Shiprocket errors:
      //   401 "Wrong number of email or password" → password rotated
      //   429 "Too many attempts, please try in 30 minutes" → IP rate-limited
      if (res.status === 401) report.login.hint = 'PASSWORD LIKELY ROTATED — update SHIPROCKET_PASSWORD env var in Cloudflare Pages settings';
      if (res.status === 429) report.login.hint = 'IP RATE-LIMITED — wait 30 min before next attempt';
    }

    // 2. Pickup location check (only if login worked)
    if (report.login.ok) {
      const configured = env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
      report.pickup.checked = true;
      report.pickup.configured_name = configured;
      const pRes = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
        headers: { 'Authorization': 'Bearer ' + data.token },
      });
      const pData = await pRes.json().catch(() => ({}));
      const locations = (pData && pData.data && pData.data.shipping_address) || [];
      report.pickup.panel_names = locations.map(l => l.pickup_location);
      report.pickup.match = report.pickup.panel_names.includes(configured);
      report.pickup.ok = report.pickup.match;
      if (!report.pickup.match) {
        report.pickup.error = `Configured "${configured}" NOT FOUND in Shiprocket panel. Update SHIPROCKET_PICKUP_LOCATION env var to one of: ${JSON.stringify(report.pickup.panel_names)}`;
      }
    }
  } catch (e) {
    report.login.error = 'network exception: ' + e.message;
  }

  // 3. Recent orders that never pushed
  try {
    const q = await env.DB.prepare(
      `SELECT id, shiprocket_error, shiprocket_attempts, created_at FROM orders
       WHERE shiprocket_order_id IS NULL
         AND (test_mode IS NULL OR test_mode = 0)
         AND datetime(created_at) > datetime('now', '-7 days')
       ORDER BY datetime(created_at) DESC
       LIMIT 20`
    ).all();
    const rows = q.results || [];
    report.recent_orders.last_7d_unpushed = rows.length;
    report.recent_orders.error_samples = rows.slice(0, 5).map(r => ({
      id: r.id, attempts: r.shiprocket_attempts, error: (r.shiprocket_error || 'no error recorded').slice(0, 240), created_at: r.created_at,
    }));
    report.recent_orders.retry_hint = rows.length
      ? `POST /api/orders/retry-shiprocket { admin_key, sweep: true, max: ${Math.min(rows.length, 10)} }`
      : null;
  } catch (e) {
    report.recent_orders.error = 'query failed: ' + e.message;
  }

  return json(report, 200);
}
