/**
 * POST /api/admin/create-otp-template
 * Owner-only, one-shot. Submits the "login_otp" WhatsApp Authentication
 * template to Meta for approval (~1-3 days), so signin.html can move off
 * Firebase Phone Auth onto our own Turnstile-gated OTP delivered over
 * WhatsApp. Authentication-category templates use a fixed, Meta-generated
 * body ("{{1}} is your verification code...") — we don't write the copy.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

const WABA_ID = '2494051337735629';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const auth = await verifyAdminAccess(request, env, corsHeaders, { requireOwner: true });
  if (auth.response) return auth.response;

  const token = env.WHATSAPP_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'WHATSAPP_TOKEN not configured' }), {
      status: 501, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = {
    name: 'login_otp',
    language: 'en_US',
    category: 'AUTHENTICATION',
    components: [
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: 10 },
      { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
    ],
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${WABA_ID}/message_templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
