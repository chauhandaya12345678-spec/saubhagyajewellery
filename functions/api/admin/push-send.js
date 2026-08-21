/**
 * GET  /api/admin/push-send  → subscriber count + recent broadcasts (owner)
 * POST /api/admin/push-send  { title, body, url?, icon?, confirm:true } (owner)
 *
 * Writes the broadcast row FIRST, then wakes every subscriber. The service
 * worker reads the row back from /api/push/latest, so the row must exist before
 * any push goes out or an early-waking browser shows the previous message.
 *
 * `confirm:true` is required: this reaches every opted-in customer's lock
 * screen and cannot be recalled.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { sendPush } from '../_push.js';

const BATCH = 30; // concurrent pushes; keeps well inside the subrequest budget

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
    return json({ error: 'VAPID keys not configured' }, 501);
  }

  if (request.method === 'GET') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first();
    const recent = await env.DB.prepare(
      'SELECT id, title, body, url, created_at, sent, failed FROM push_broadcasts ORDER BY id DESC LIMIT 20'
    ).all();
    return json({
      success: true,
      subscribers: (count && count.n) || 0,
      broadcasts: (recent && recent.results) || [],
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (body.confirm !== true) return json({ error: 'confirm:true required — this notifies every subscriber' }, 400);

  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if (!title) return json({ error: 'title required' }, 400);
  if (!text) return json({ error: 'body required' }, 400);
  if (title.length > 80) return json({ error: 'title must be 80 characters or fewer' }, 400);
  if (text.length > 200) return json({ error: 'body must be 200 characters or fewer' }, 400);

  // Only ever deep-link into our own site.
  let url = String(body.url || '/').trim() || '/';
  if (/^https?:\/\//i.test(url)) {
    try {
      const h = new URL(url).hostname;
      if (!/(^|\.)saubhagyajewellery\.com$/i.test(h)) return json({ error: 'url must be on saubhagyajewellery.com' }, 400);
    } catch { return json({ error: 'invalid url' }, 400); }
  } else if (!url.startsWith('/')) {
    return json({ error: 'url must be a site path or a saubhagyajewellery.com link' }, 400);
  }

  const ins = await env.DB.prepare(
    'INSERT INTO push_broadcasts (title, body, url, icon) VALUES (?, ?, ?, ?)'
  ).bind(title, text, url, String(body.icon || '') || null).run();
  const broadcastId = ins.meta?.last_row_id;

  const subs = await env.DB.prepare('SELECT id, endpoint FROM push_subscriptions').all();
  const list = (subs && subs.results) || [];

  let sent = 0, failed = 0;
  const dead = [];
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((s) => sendPush(env, s)));
    results.forEach((r, k) => {
      if (r.ok) sent++;
      else {
        failed++;
        // 404/410 means the browser is gone for good — pruning keeps the
        // subscriber count honest and stops us pushing into the void forever.
        if (r.gone) dead.push(slice[k].id);
      }
    });
  }

  if (dead.length) {
    const marks = dead.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${marks})`).bind(...dead).run();
  }

  await env.DB.prepare('UPDATE push_broadcasts SET sent = ?, failed = ? WHERE id = ?')
    .bind(sent, failed, broadcastId).run();

  return json({ success: true, broadcastId, subscribers: list.length, sent, failed, pruned: dead.length });
}
