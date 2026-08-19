/**
 * Saubhagya – List saved addresses
 * GET /api/addresses/list
 * Header: Authorization: Bearer <session>  (required)
 *
 * Returns addresses saved for the signed-in user, most-recent first, or an
 * empty list when not signed in (not an error — checkout.html just shows no
 * suggestions until the customer verifies via the inline OTP prompt).
 *
 * A bare ?phone= lookup with no session used to work here — removed. It let
 * anyone pull any customer's name/email/saved addresses by guessing a phone
 * number, no proof of ownership required.
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

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? await resolveSessionUser(db, token) : null;
    if (!session) return json({ success: true, addresses: [] });

    let rows;
    try {
      const sPhone = String(session.phone || '').replace(/\D/g, '').slice(-10);
      rows = await db.prepare(
        `SELECT * FROM addresses
          WHERE user_id = ? OR (phone = ? AND ? != '')
          ORDER BY last_used_at DESC LIMIT 10`
      ).bind(session.user_id, sPhone, sPhone).all();
    } catch (e) {
      // Table not migrated yet — return empty list so checkout can still proceed
      if (/no such table/i.test(e.message)) {
        return json({ success: true, addresses: [], warning: 'addresses table not migrated yet' });
      }
      throw e;
    }

    return json({ success: true, addresses: rows.results || [] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
