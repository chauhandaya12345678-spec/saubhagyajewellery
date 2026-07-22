/**
 * Saubhagya – Wishlist API
 * POST /api/wishlist/add    { user_id, product_sku }
 * POST /api/wishlist/remove { user_id, product_sku }
 * GET  /api/wishlist?user_id=X
 *
 * Requires a session token (Authorization: Bearer sess_...) that resolves to
 * the same user_id being read/written — previously user_id was trusted
 * straight from the request with no auth at all, so anyone could read or
 * modify any other user's wishlist just by guessing their id.
 */
async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    const row = await db.prepare('SELECT user_id FROM sessions WHERE token = ? LIMIT 1').bind(token).first();
    return row || null;
  } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const db = env.DB;
    const url = new URL(request.url);

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? await resolveSessionUser(db, token) : null;
    if (!session) return json({ error: 'Sign in required' }, 401);

    if (request.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return json({ error: 'user_id required' }, 400);
      if (Number(userId) !== session.user_id) return json({ error: 'Forbidden' }, 403);
      const { results } = await db.prepare('SELECT product_sku, created_at FROM wishlist WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
      return json({ success: true, items: results });
    }

    if (request.method === 'POST') {
      const { user_id, product_sku, action } = await request.json();
      if (!user_id || !product_sku) return json({ error: 'user_id and product_sku required' }, 400);
      if (Number(user_id) !== session.user_id) return json({ error: 'Forbidden' }, 403);

      if (action === 'remove') {
        await db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_sku = ?').bind(user_id, product_sku).run();
      } else {
        await db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_sku) VALUES (?, ?)').bind(user_id, product_sku).run();
      }
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
