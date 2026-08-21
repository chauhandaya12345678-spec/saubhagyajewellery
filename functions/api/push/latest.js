/**
 * GET /api/push/latest → the newest broadcast, for the service worker to render.
 *
 * Public and deliberately contentless beyond the notification itself: the push
 * message carries no payload, so every woken service worker calls this to learn
 * what to show. It must therefore never return anything customer-specific.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare(
    'SELECT id, title, body, url, icon, created_at FROM push_broadcasts ORDER BY id DESC LIMIT 1'
  ).first();

  if (!row) {
    return new Response(JSON.stringify({ title: 'Saubhagya Jewellery', body: '' }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url || '/',
    icon: row.icon || '/images/brand/favicon-mark.png',
    at: row.created_at,
  }), {
    headers: {
      'Content-Type': 'application/json',
      // Short shared cache: thousands of service workers hit this within
      // seconds of one broadcast, and they should all get the same row.
      'Cache-Control': 'public, max-age=30, s-maxage=30',
    },
  });
}
