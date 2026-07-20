/**
 * WhatsApp Webhook — handles Meta Cloud API verification + incoming messages
 * 
 * GET  /api/webhooks/wa — Meta verification challenge
 * POST /api/webhooks/wa — incoming messages (we don't process yet, just ack)
 */
export async function onRequest(context) {
  const { request } = context;
  const json = (obj, s = 200) => new Response(JSON.stringify(obj), {
    status: s, headers: { 'Content-Type': 'application/json' },
  });

  const url = new URL(request.url);

  // GET — Meta verification challenge
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === 'saubhagya-wa-2026' && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Verification failed', { status: 403 });
  }

  // POST — incoming messages (ack only, we send not receive)
  if (request.method === 'POST') {
    return json({ status: 'ok' });
  }

  return json({ error: 'Method not allowed' }, 405);
}
