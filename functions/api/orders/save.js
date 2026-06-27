/**
 * Saubhagya – Save Order API (after Razorpay payment success)
 * POST /api/orders/save
 * Body: {
 *   razorpay_payment_id, items, total, subtotal, discount,
 *   name, email, phone, address (JSON string),
 *   create_account: bool (auto-create user account for guest)
 * }
 * Returns: { success: true, order_id: string }
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const body = await request.json();
    const { razorpay_payment_id, items, total, subtotal, discount, name, email, phone, address, create_account } = body;

    if (!razorpay_payment_id || !items || !total === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields: razorpay_payment_id, items, total' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const db = env.DB;

    // Generate order ID like CC-20260627-A7X3
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderId = `CC-${dateStr}-${rand}`;

    // Get or create user
    let userId = null;
    let sessionToken = null;

    if (email || phone) {
      const identifier = email || phone;
      const existingUser = email
        ? await db.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first()
        : await db.prepare('SELECT id, name FROM users WHERE phone = ?').bind(phone).first();

      if (existingUser) {
        userId = existingUser.id;
      } else if (create_account) {
        // Auto-create guest account
        const autoPwd = 'guest_' + Math.random().toString(36).substring(2, 10);
        const newUser = await db.prepare(
          'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)'
        ).bind(name || 'Guest', email || null, phone || null, autoPwd).run();
        userId = newUser.meta.last_row_id;
      }

      // Create session token for this user
      if (userId) {
        sessionToken = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
        await db.prepare(
          'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
        ).bind(userId, sessionToken, identifier, name || 'Guest').run();
      }
    }

    // Save the order
    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items);
    const addressJson = typeof address === 'string' ? address : JSON.stringify(address);

    await db.prepare(
      `INSERT INTO orders (id, user_id, email, phone, name, items, total, subtotal, discount, address, razorpay_payment_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
    ).bind(
      orderId,
      userId,
      email || null,
      phone || null,
      name || 'Guest',
      itemsJson,
      total,
      subtotal || total,
      discount || 0,
      addressJson,
      razorpay_payment_id
    ).run();

    return new Response(JSON.stringify({
      success: true,
      order_id: orderId,
      user_id: userId,
      session_token: sessionToken,
      message: `Order ${orderId} confirmed. Shiprocket tracking will be available once dispatched.`
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
