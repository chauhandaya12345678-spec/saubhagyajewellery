/**
 * POST   /api/push/subscribe    { endpoint, keys: { p256dh, auth } }
 * DELETE /api/push/subscribe    { endpoint }
 * GET    /api/push/subscribe    → { publicKey }  (what the browser needs to subscribe)
 *
 * Public by design — anyone may opt their own browser in. The endpoint URL is
 * issued by the push service and is the only thing that identifies the browser,
 * so there is nothing here to authenticate against. It is rate-limited by being
 * a plain upsert on a UNIQUE endpoint: replaying it cannot create rows.
 */

export async function onRequest(context) {
  const { request, env } = context;
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json' },
  });

  if (request.method === 'GET') {
    if (!env.VAPID_PUBLIC_KEY) return json({ error: 'push not configured' }, 501);
    return json({ publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const endpoint = String((body && body.endpoint) || '').trim();
  // Only accept endpoints from the real push services. Without this the table
  // becomes an open redirect list: anything stored here is later POSTed to by
  // the server with a VAPID header attached.
  let host = '';
  try { host = new URL(endpoint).hostname; } catch { return json({ error: 'invalid endpoint' }, 400); }
  const allowed = /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|apple\.com)$/i.test(host);
  if (!allowed) return json({ error: 'unrecognised push service' }, 400);

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    return json({ success: true, removed: true });
  }

  const keys = (body && body.keys) || {};
  const p256dh = String(keys.p256dh || '');
  const auth = String(keys.auth || '');
  if (!p256dh || !auth) return json({ error: 'keys.p256dh and keys.auth required' }, 400);

  const ua = (request.headers.get('User-Agent') || '').slice(0, 180);

  // Re-subscribing the same browser must refresh the keys, not duplicate the row.
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, ua, fail_count)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fail_count = 0
  `).bind(endpoint, p256dh, auth, ua).run();

  return json({ success: true });
}
