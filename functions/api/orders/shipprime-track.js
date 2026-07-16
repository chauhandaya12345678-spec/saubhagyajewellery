/**
 * Saubhagya – ShipPrime Tracking Proxy
 * GET /api/orders/shipprime-track?awb=33827...
 *
 * Proxies ShipPrime tracking API so the frontend can show live status.
 * Uses SHIPPRIME_TOKEN from env (same as pushToShipPrime).
 */
export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const url = new URL(request.url);
    const awb = url.searchParams.get('awb');
    if (!awb || !/^\d+$/.test(awb)) {
      return new Response(JSON.stringify({ error: 'Valid AWB required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const token = env.SHIPPRIME_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: 'ShipPrime not configured' }), {
        status: 501, headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const res = await fetch(
      `https://api.shipprime.live/v1/forward/track?awbs=${awb}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json().catch(() => ({}));

    if (data.status === 'SUCCESS' && data.results && data.results.length) {
      const r = data.results[0];
      return new Response(JSON.stringify({
        success: true,
        awb: r.awb,
        currentStatus: r.currentStatus,
        statusDate: r.statusDate,
        history: r.history || [],
      }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...cors } });
    }

    return new Response(JSON.stringify({ success: false, awb, note: 'Not found or not yet tracked' }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
