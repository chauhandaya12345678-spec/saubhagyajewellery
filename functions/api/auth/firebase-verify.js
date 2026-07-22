/**
 * Saubhagya – Firebase Auth Verify (replaces Twilio OTP)
 * POST /api/auth/firebase-verify
 * Body: { idToken, phone }
 *
 * Verifies Firebase ID token via Google's tokeninfo API, then
 * finds or creates user in D1. Returns session token + user.
 */
import { genSessionToken } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const FIREBASE_API_KEY = env.FIREBASE_API_KEY;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...cors },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!FIREBASE_API_KEY) return json({ error: 'Firebase not configured' }, 501);

  try {
    const body = await request.json();
    const { idToken, phone } = body;
    if (!idToken) return json({ error: 'Missing ID token' }, 400);
    if (!phone || String(phone).replace(/\D/g, '').length !== 10) {
      return json({ error: 'Invalid phone number' }, 400);
    }

    // Verify Firebase ID token via Firebase REST API (works with App Check)
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const verifyData = await verifyRes.json().catch(() => ({}));

    if (!verifyRes.ok || !verifyData.users || !verifyData.users.length) {
      return json({ error: 'Invalid or expired authentication' }, 401);
    }

    // Confirm the verified phone matches
    const fbPhone = (verifyData.users[0].phoneNumber || '').replace(/\D/g, '').slice(-10);
    const reqPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (fbPhone !== reqPhone) {
      return json({ error: 'Phone number mismatch' }, 400);
    }

    const db = env.DB;

    // Find existing user by phone
    let user = await db.prepare('SELECT * FROM users WHERE phone = ?')
      .bind(phone).first();

    if (!user) {
      // No users row yet — this happens when the customer's only prior order
      // landed via the razorpay webhook fallback path, which never creates
      // an account (save.js owns that). Their real name still lives on the
      // orders row itself, so recover it from there instead of defaulting
      // to "Guest" and locking in a wrong name forever.
      let recoveredName = null, recoveredEmail = null;
      try {
        const lastOrder = await db.prepare(
          'SELECT name, email FROM orders WHERE phone = ? AND name IS NOT NULL ORDER BY created_at DESC LIMIT 1'
        ).bind(phone).first();
        if (lastOrder) { recoveredName = lastOrder.name; recoveredEmail = lastOrder.email; }
      } catch (e) {}
      // Auto-create user (OTP-verified = trusted, is_guest=0)
      const name = (body.name || recoveredName || 'Guest').trim() || 'Guest';
      const email = recoveredEmail || null;
      const autoPwd = 'firebase_' + crypto.randomUUID();
      try {
        const created = await db.prepare(
          'INSERT INTO users (name, phone, email, password, is_guest) VALUES (?, ?, ?, ?, 0)'
        ).bind(name, phone, email, autoPwd).run();
        user = { id: created.meta.last_row_id, name, email, phone };
      } catch (e) {
        if (!/no such column/i.test(e.message)) throw e;
        const created = await db.prepare(
          'INSERT INTO users (name, phone, password) VALUES (?, ?, ?)'
        ).bind(name, phone, autoPwd).run();
        user = { id: created.meta.last_row_id, name, email: null, phone };
      }
    } else if (user.is_guest === 1) {
      try {
        await db.prepare("UPDATE users SET is_guest = 0, updated_at = datetime('now') WHERE id = ?")
          .bind(user.id).run();
      } catch (e) {}
    }

    // Create session token
    const sessionToken = genSessionToken();
    await db.prepare(
      'INSERT INTO sessions (user_id, token, email, name) VALUES (?, ?, ?, ?)'
    ).bind(user.id, sessionToken, user.email || user.phone, user.name).run();

    return json({
      success: true,
      token: sessionToken,
      user: { id: user.id, name: user.name, email: user.email || null, phone: user.phone },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
