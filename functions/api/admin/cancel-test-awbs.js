/** Cancel specified ShipPrime AWBs. Run once, then delete this file. */
export async function onRequest(context) {
  const { env } = context;
  const token = env.SHIPPRIME_TOKEN;
  if (!token) return new Response(JSON.stringify({error:'SHIPPRIME_TOKEN not set'}), {status:500, headers:{'Content-Type':'application/json'}});

  const awbs = ['33827133791224','33827133799904','33827133866706'];
  const results = [];

  for (const awb of awbs) {
    try {
      const res = await fetch(`https://api.shipprime.live/v1/forward/${awb}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const data = await res.json().catch(() => ({}));
      results.push({ awb, status: res.status, ...data });
    } catch(e) {
      results.push({ awb, error: e.message });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
