/**
 * PATCH /api/admin/update-inventory
 * Body: { sku, stock_count?, weightGrams?, price?, mrp?, image?, altImage? }
 * Header: x-admin-key: <ADMIN_KEY env var>
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const adminKey = env.ADMIN_KEY || '';
  const reqKey = request.headers.get('x-admin-key') || '';
  if (!adminKey || reqKey !== adminKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { sku, stock_count, weightGrams, price, mrp, image, altImage } = body || {};
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

  try {
    const setClauses = ["updated_at = datetime('now')"];
    const params = [];
    if (sc !== null) { setClauses.push('stock_count = ?'); params.push(sc); }
    if (wg !== null) { setClauses.push('weightGrams = ?'); params.push(wg); }
    if (pr !== null) { setClauses.push('price = ?'); params.push(pr); }
    if (mr !== null) { setClauses.push('mrp = ?'); params.push(mr); }
    if (typeof image === 'string' && image) { setClauses.push('image = ?'); params.push(image); }
    if (typeof altImage === 'string') { setClauses.push('altImage = ?'); params.push(altImage); }
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
