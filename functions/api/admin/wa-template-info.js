/**
 * GET /api/admin/wa-template-info?name=confirm_order
 * Owner-only. Fetches the real approved template definition (components,
 * header type, body variable count, buttons) straight from Meta's Graph
 * API — for diagnosing "parameter format does not match" send failures
 * instead of guessing the template structure from screenshots.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

const WABA_ID = '2494051337735629';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = adminCorsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'GET') {
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

  const url = new URL(request.url);
  const name = url.searchParams.get('name') || '';

  try {
    const fields = 'name,status,category,language,components';
    const graphUrl = name
      ? `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates?name=${encodeURIComponent(name)}&fields=${fields}`
      : `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates?fields=${fields}&limit=50`;
    const res = await fetch(graphUrl, { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
