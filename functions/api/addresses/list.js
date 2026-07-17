/**
 * Saubhagya – List saved addresses
 * GET /api/addresses/list?phone=9999999999
 *   OR Header: Authorization: Bearer <session>
 *
 * Returns addresses saved for this phone / signed-in user, most-recent first.
 * Used by checkout.html to render the "use previous address" chooser.
 */
async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    const row = await db.prepare(
      'SELECT s.user_id, u.email, u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1'
    ).bind(token).first();
    return row || null;
  } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...cors },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = env.DB;
    const url = new URL(request.url);
    const phoneQ = String(url.searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? await resolveSessionUser(db, token) : null;

    let rows;
    if (session) {
      // Signed-in: fetch by user_id OR by session's phone (covers pre-signup guest addresses)
      const sPhone = String(session.phone || '').replace(/\D/g, '').slice(-10);
      rows = await db.prepare(
        `SELECT * FROM addresses
          WHERE user_id = ? OR (phone = ? AND ? != '')
          ORDER BY last_used_at DESC LIMIT 10`
      ).bind(session.user_id, sPhone, sPhone).all();
    } else if (phoneQ && phoneQ.length === 10) {
      // Guest by phone number — only recent 5, no email/user_id revealed
      rows = await db.prepare(
        `SELECT id, full_name, address1, address2, landmark, city, state, pincode, is_default, label, last_used_at, usage_count
           FROM addresses
          WHERE phone = ?
          ORDER BY last_used_at DESC LIMIT 5`
      ).bind(phoneQ).all();
    } else {
      return json({ error: 'Provide phone or sign in' }, 400);
    }

    return json({ success: true, addresses: rows.results || [] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
