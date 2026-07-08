/**
 * Saubhagya – Wishlist API
 * POST /api/wishlist/add    { user_id, product_sku }
 * POST /api/wishlist/remove { user_id, product_sku }
 * GET  /api/wishlist?user_id=X
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const db = env.DB;
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const { results } = await db.prepare('SELECT product_sku, created_at FROM wishlist WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
      return new Response(JSON.stringify({ success: true, items: results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (request.method === 'POST') {
      const { user_id, product_sku, action } = await request.json();
      if (!user_id || !product_sku) return new Response(JSON.stringify({ error: 'user_id and product_sku required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      if (action === 'remove') {
        await db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_sku = ?').bind(user_id, product_sku).run();
      } else {
        await db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_sku) VALUES (?, ?)').bind(user_id, product_sku).run();
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
