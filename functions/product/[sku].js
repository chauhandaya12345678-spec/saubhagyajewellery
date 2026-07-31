/**
 * Saubhagya — clean product URL: /product/<SKU>
 * SSR-renders product.html with real title/desc/canonical/OG/JSON-LD from D1,
 * so Google indexes one clean URL per product (query-string ?sku= URLs are
 * poorly indexed for e-commerce). New products added in admin work with zero
 * config: the URL is derived from the SKU, the meta from the live D1 row.
 */
import { renderProductShell } from '../_pdp.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const sku = decodeURIComponent(params.sku || '').trim();
  if (!sku) return Response.redirect(new URL('/categories', request.url).toString(), 302);

  // Get the product.html shell. A same-origin subrequest to /product hits
  // functions/product.js (no sku → next()) which serves the static shell,
  // sidestepping the /product.html → /product clean-URL 308 loop.
  const shellRes = await fetch(new URL('/product', request.url).toString());
  let html = await shellRes.text();

  let p = null;
  try {
    p = await env.DB.prepare('SELECT * FROM products WHERE sku = ?').bind(sku).first();
  } catch (e) { /* fall through to the client "Product Not Found" state */ }

  if (!p) {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  }

  html = await renderProductShell(html, p, env);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-SSR-Source': 'd1-clean',
    },
  });
}
