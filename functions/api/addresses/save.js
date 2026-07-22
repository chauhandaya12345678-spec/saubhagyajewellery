/**
 * Saubhagya – Save/upsert an address
 * POST /api/addresses/save
 * Body: {
 *   full_name, phone, email?,
 *   address1, address2?, landmark?,
 *   city, state, pincode,
 *   label?, is_default?,
 *   address_id?  // if present, update that row; else insert new
 * }
 * Returns: { success: true, address_id }
 *
 * De-dup rule: if an existing row for this phone has the same address1 +
 * pincode (case-insensitive, whitespace-normalized), bump its usage_count
 * + last_used_at instead of inserting a duplicate.
 */
import { rateLimitCheck } from '../_lib.js';

async function resolveSessionUser(db, token) {
  if (!token || !token.startsWith('sess_')) return null;
  try {
    const row = await db.prepare(
      'SELECT s.user_id, u.email, u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1'
    ).bind(token).first();
    return row || null;
  } catch (e) { return null; }
}

function norm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function normPhone(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
function normEmail(e) { return e ? String(e).trim().toLowerCase() : null; }

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...cors },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = env.DB;
    const body = await request.json();

    // Validate mandatory fields
    const full_name = String(body.full_name || '').trim();
    const phone = normPhone(body.phone);
    const email = normEmail(body.email);
    const address1 = String(body.address1 || '').trim();
    const address2 = String(body.address2 || '').trim() || null;
    const landmark = String(body.landmark || '').trim() || null;
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const pincode = String(body.pincode || '').replace(/\D/g, '').slice(0, 6);
    const label = String(body.label || '').trim() || null;
    const isDefault = body.is_default ? 1 : 0;

    const errs = [];
    if (full_name.length < 2) errs.push('full_name too short');
    if (phone.length !== 10) errs.push('phone must be 10 digits');
    if (address1.length < 5) errs.push('address1 too short');
    if (city.length < 2) errs.push('city required');
    if (state.length < 2) errs.push('state required');
    if (pincode.length !== 6) errs.push('pincode must be 6 digits');
    if (errs.length) return json({ error: 'Validation: ' + errs.join('; ') }, 400);

    // Optional session — links address to user_id
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? await resolveSessionUser(db, token) : null;
    const userId = session ? session.user_id : null;

    // Update path — explicit address_id + must belong to this phone / user.
    // The phone-match branch has no session behind it (by design — guests
    // reuse saved addresses via phone alone), so address_id + phone together
    // is guessable in theory; rate-limit it per IP to make brute-forcing
    // (guessing address_id against a known phone) impractical.
    if (body.address_id) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ok = await rateLimitCheck(db, `addr-update:${ip}`, 20, 10);
      if (!ok) return json({ error: 'Too many attempts. Please try again later.' }, 429);

      const existing = await db.prepare('SELECT id, user_id, phone FROM addresses WHERE id = ?')
        .bind(Number(body.address_id)).first();
      if (!existing) return json({ error: 'address not found' }, 404);
      const ownedBySession = userId && existing.user_id && existing.user_id === userId;
      const ownedByPhone = existing.phone === phone;
      if (!ownedBySession && !ownedByPhone) return json({ error: 'forbidden' }, 403);

      if (isDefault) {
        await db.prepare('UPDATE addresses SET is_default = 0 WHERE phone = ?').bind(phone).run();
      }
      await db.prepare(
        `UPDATE addresses SET full_name=?, email=?, address1=?, address2=?, landmark=?,
                              city=?, state=?, pincode=?, label=?, is_default=?,
                              last_used_at=datetime('now'), usage_count = usage_count + 1
           WHERE id = ?`
      ).bind(full_name, email, address1, address2, landmark, city, state, pincode, label, isDefault, existing.id).run();
      return json({ success: true, address_id: existing.id, updated: true });
    }

    // De-dup check: same phone + normalized address1 + pincode
    // Gracefully handle missing table (migration not yet run) — order flow
    // still works because save.js also stores address JSON on the order row.
    let dupe = null;
    try {
      dupe = await db.prepare(
        `SELECT id FROM addresses
          WHERE phone = ? AND LOWER(TRIM(address1)) = ? AND pincode = ?
          LIMIT 1`
      ).bind(phone, norm(address1), pincode).first();
    } catch (e) {
      if (/no such table/i.test(e.message)) {
        return json({ success: true, address_id: 0, warning: 'addresses table not migrated yet — address will still travel with the order' });
      }
      throw e;
    }

    if (dupe) {
      // Refresh existing row instead of duplicating
      if (isDefault) {
        await db.prepare('UPDATE addresses SET is_default = 0 WHERE phone = ?').bind(phone).run();
      }
      await db.prepare(
        `UPDATE addresses SET full_name=?, email=COALESCE(?, email),
                              address2=?, landmark=?, city=?, state=?,
                              label=COALESCE(?, label), is_default=?,
                              last_used_at=datetime('now'),
                              usage_count = usage_count + 1,
                              user_id = COALESCE(?, user_id)
           WHERE id = ?`
      ).bind(full_name, email, address2, landmark, city, state, label, isDefault, userId, dupe.id).run();
      return json({ success: true, address_id: dupe.id, deduped: true });
    }

    // Ensure only one default per phone
    if (isDefault) {
      await db.prepare('UPDATE addresses SET is_default = 0 WHERE phone = ?').bind(phone).run();
    }

    let res;
    try {
      res = await db.prepare(
        `INSERT INTO addresses (user_id, phone, email, full_name, address1, address2, landmark, city, state, pincode, is_default, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, phone, email, full_name, address1, address2, landmark, city, state, pincode, isDefault, label).run();
    } catch (e) {
      if (/no such table/i.test(e.message)) {
        return json({ success: true, address_id: 0, warning: 'addresses table not migrated yet — address will still travel with the order' });
      }
      throw e;
    }

    return json({ success: true, address_id: res.meta.last_row_id, created: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
