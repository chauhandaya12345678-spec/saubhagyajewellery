/**
 * PATCH /api/admin/update-inventory
 * Body: { sku, stock_count?, weightGrams?, price?, mrp?, image?, altImage?, name?, low_stock_threshold? }
 * Header: x-admin-key: <ADMIN_KEY env var>
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: true });
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { sku, stock_count, weightGrams, price, mrp, image, altImage, name, low_stock_threshold } = body || {};
  if (!sku) {
    return new Response(JSON.stringify({ error: 'sku required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const db = env.DB;
  const sc = stock_count !== undefined ? parseInt(stock_count, 10) : null;
  const wg = weightGrams !== undefined ? parseFloat(weightGrams) : null;
  const pr = price !== undefined ? parseInt(price, 10) : null;
  const mr = mrp !== undefined ? parseInt(mrp, 10) : null;
  const lt = low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : null;

  if (sc !== null && isNaN(sc)) {
    return new Response(JSON.stringify({ error: 'stock_count must be a number' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (wg !== null && isNaN(wg)) {
    return new Response(JSON.stringify({ error: 'weightGrams must be a number' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (pr !== null && isNaN(pr)) {
    return new Response(JSON.stringify({ error: 'price must be a number' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (mr !== null && isNaN(mr)) {
    return new Response(JSON.stringify({ error: 'mrp must be a number' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (lt !== null && isNaN(lt)) {
    return new Response(JSON.stringify({ error: 'low_stock_threshold must be a number' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const setClauses = ["updated_at = datetime('now')"];
    const params = [];
    if (sc !== null) { setClauses.push('stock_count = ?'); params.push(sc); }
    if (wg !== null) { setClauses.push('weightGrams = ?'); params.push(wg); }
    if (pr !== null) { setClauses.push('price = ?'); params.push(pr); }
    if (mr !== null) { setClauses.push('mrp = ?'); params.push(mr); }
    if (lt !== null) { setClauses.push('low_stock_threshold = ?'); params.push(lt); }
    if (typeof image === 'string' && image) { setClauses.push('image = ?'); params.push(image); }
    if (typeof altImage === 'string') { setClauses.push('altImage = ?'); params.push(altImage); }
    if (typeof name === 'string' && name.trim()) { setClauses.push('name = ?'); params.push(name.trim()); }
    if (setClauses.length === 1) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    params.push(sku);
    const sql = 'UPDATE products SET ' + setClauses.join(', ') + ' WHERE sku = ?';
    const result = await db.prepare(sql).bind(...params).run();
    return new Response(JSON.stringify({ success: true, changes: result.meta?.changes ?? result.changes ?? 0 }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
