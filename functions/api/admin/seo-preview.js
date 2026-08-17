/**
 * POST /api/admin/seo-preview   { name, category }  → { title, subtitle, keywords }
 *
 * Shows what the website AUTO-GENERATES for a product's SEO from its NAME +
 * CATEGORY, using the exact same engine the live product page uses
 * (functions/_seo.js). Lets the owner confirm the Google title + keyword line
 * are good WITHOUT filling any SEO field — there are none to fill. A good
 * product name is the whole input; title/description/material/keywords all
 * derive from it.
 */
import { seoSubtitle, productKeywords } from '../../_seo.js';
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: false });
  if (auth.response) return auth.response;

  let b; try { b = await request.json(); } catch { b = {}; }
  const p = { name: String(b.name || '').trim(), category: String(b.category || '').trim() };
  if (!p.name) return json({ error: 'name required' }, 400);

  return json({
    success: true,
    title: `${p.name} | Saubhagya Jewellery`,
    subtitle: seoSubtitle(p),      // the keyword H2 that actually ranks
    keywords: productKeywords(p),
  });
}
