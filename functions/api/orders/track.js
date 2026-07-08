/**
 * Saubhagya – Track Orders API
 * GET /api/orders/track?email=xxx&phone=xxx   → all orders for a user
 * GET /api/orders/track?order_id=CC-XXXX      → single order by ID
 * Returns: { success: true, orders: [...] }
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const db = env.DB;
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');
    const email = url.searchParams.get('email');
    const phone = url.searchParams.get('phone');

    let results;

    if (orderId) {
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      results = order ? [order] : [];
    } else if (email && phone) {
      // Account view: orders may carry either identifier depending on checkout form
      results = await db.prepare(
        'SELECT * FROM orders WHERE email = ? OR phone = ? ORDER BY created_at DESC'
      ).bind(email, phone).all();
      results = results.results || [];
    } else if (email) {
      results = await db.prepare(
        'SELECT * FROM orders WHERE email = ? ORDER BY created_at DESC'
      ).bind(email).all();
      results = results.results || [];
    } else if (phone) {
      results = await db.prepare(
        'SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC'
      ).bind(phone).all();
      results = results.results || [];
    } else {
      return new Response(JSON.stringify({ error: 'Provide order_id, email, or phone' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Parse JSON fields for each order
    const orders = results.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
      address: typeof o.address === 'string' ? JSON.parse(o.address) : o.address,
    }));

    return new Response(JSON.stringify({ success: true, orders }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
