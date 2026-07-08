/**
 * Saubhagya – Reviews API
 * POST /api/reviews   { product_sku, user_id?, name, rating, review_text }
 * GET  /api/reviews?sku=X
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
      const sku = url.searchParams.get('sku');
      if (!sku) return new Response(JSON.stringify({ error: 'sku required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const { results } = await db.prepare('SELECT id, name, rating, review_text, created_at FROM reviews WHERE product_sku = ? ORDER BY created_at DESC').bind(sku).all();
      // Calculate average
      const avg = results.length ? Math.round(results.reduce((s, r) => s + r.rating, 0) / results.length * 10) / 10 : 0;
      return new Response(JSON.stringify({ success: true, reviews: results, average: avg, count: results.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (request.method === 'POST') {
      const { product_sku, user_id, name, rating, review_text } = await request.json();
      if (!product_sku || !name || !rating || !review_text) return new Response(JSON.stringify({ error: 'product_sku, name, rating, review_text required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (rating < 1 || rating > 5) return new Response(JSON.stringify({ error: 'rating must be 1-5' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      await db.prepare('INSERT INTO reviews (product_sku, user_id, name, rating, review_text) VALUES (?, ?, ?, ?, ?)')
        .bind(product_sku, user_id || null, name, rating, review_text).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
