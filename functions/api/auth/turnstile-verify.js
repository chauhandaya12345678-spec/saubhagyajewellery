/**
 * POST /api/auth/turnstile-verify
 * Body: { token }
 * Server-side Turnstile check used as a pre-gate in front of the Firebase
 * phone-auth sign-in flow (temporary fallback while the WhatsApp OTP
 * template awaits Meta approval). Real bot-check, not just UI friction.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { token } = await request.json();
    if (!token) return json({ success: false, error: 'Missing token' }, 400);

    const secret = env.TURNSTILE_SECRET_KEY;
    if (!secret) return json({ success: false, error: 'Not configured' }, 501);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json().catch(() => ({}));
    return json({ success: !!data.success });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
