/**
 * GET  /api/admin/pricing-settings  → current price-calculator constants (defaults merged)
 * POST /api/admin/pricing-settings  → save constants (owner only)
 *
 * These constants power the admin Price Calculator only — a helper that turns a
 * wholesale cost into a suggested Sell price + "compare at" MRP. They do NOT
 * change any existing product's price (each product's price is its own D1 row);
 * the owner still enters the final price when adding a product. Persisted as one
 * JSON blob in the `settings` table under key 'pricing_config' so a change on any
 * device sticks everywhere.
 *
 * Model (matches build/migrate-d1.py price_from_cost):
 *   pctCosts = gstPct/(100+gstPct) + gatewayPct/100      // GST is charged inclusively
 *   fixed    = cost + courier + packaging
 *   sell     = ceil((fixed/(1-pctCosts) + margin) / sellRound) * sellRound
 *   mrp      = ceil((sell/(1-discountPct/100)) / mrpRound) * mrpRound
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

const KEY = 'pricing_config';

export const PRICING_DEFAULTS = {
  courier: 90,          // ₹ forward shipping absorbed into the price
  packaging: 25,        // ₹ per order
  gstPct: 3,            // % GST, charged inclusively (HSN 7117)
  gatewayPct: 2.36,     // % payment-gateway fee
  sellRound: 5,         // round the sell price UP to the nearest ₹
  discountPct: 25,      // "compare at" MRP shows this % off
  mrpRound: 10,         // round the MRP UP to the nearest ₹
  marginNecklace: 90,   // default profit ₹ for necklaces / higher value
  marginEarring: 0,     // default profit ₹ for earrings / jhumkas (break-even)
};

const j = (o, s, cors) => new Response(JSON.stringify(o), {
  status: s || 200, headers: { 'Content-Type': 'application/json', ...cors },
});

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Reading is any-admin; saving is owner-only.
  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: request.method === 'POST' });
  if (auth.response) return auth.response;

  if (request.method === 'GET') {
    let config = { ...PRICING_DEFAULTS };
    try {
      const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
      if (row && row.value) config = { ...config, ...JSON.parse(row.value) };
    } catch (e) { /* fall back to defaults */ }
    return j({ success: true, config, defaults: PRICING_DEFAULTS }, 200, cors);
  }

  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch { return j({ error: 'Invalid JSON' }, 400, cors); }

    // Whitelist + numeric-coerce every known field; ignore anything else.
    const clean = {};
    for (const k of Object.keys(PRICING_DEFAULTS)) {
      const v = Number(b[k]);
      clean[k] = Number.isFinite(v) ? v : PRICING_DEFAULTS[k];
    }
    // Guardrails so the calculator can never divide by zero or go negative.
    if (!(clean.sellRound >= 1)) clean.sellRound = 1;
    if (!(clean.mrpRound >= 1)) clean.mrpRound = 1;
    if (clean.courier < 0) clean.courier = 0;
    if (clean.packaging < 0) clean.packaging = 0;
    if (clean.gstPct < 0) clean.gstPct = 0;
    if (clean.gatewayPct < 0) clean.gatewayPct = 0;
    if (clean.discountPct < 0 || clean.discountPct >= 100) clean.discountPct = PRICING_DEFAULTS.discountPct;

    try {
      await env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(KEY, JSON.stringify(clean)).run();
    } catch (e) { return j({ error: String(e.message || e) }, 500, cors); }
    return j({ success: true, config: clean }, 200, cors);
  }

  return j({ error: 'Method not allowed' }, 405, cors);
}
