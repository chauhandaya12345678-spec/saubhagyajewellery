export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const oid = url.searchParams.get('id');
  const adminKey = request.headers.get('x-admin-key') || '';
  if (adminKey !== '0nhM/5nNus37ENJWM9Pk+GSVEQ0qFMKbDkIqEErHXbI=') return new Response('unauthorized', {status:401});
  if (!oid) return new Response('missing id', {status:400});
  const db = env.DB;
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(oid).first();
  return new Response(JSON.stringify(order || {not_found: true}), {headers:{'Content-Type':'application/json'}});
}
