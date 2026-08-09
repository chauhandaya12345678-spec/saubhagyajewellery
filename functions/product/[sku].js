/**
 * Saubhagya — clean product URL: /product/<SKU>
 * SSR-renders product.html with real title/desc/canonical/OG/JSON-LD from D1,
 * so Google indexes one clean URL per product (query-string ?sku= URLs are
 * poorly indexed for e-commerce). New products added in admin work with zero
 * config: the URL is derived from the SKU, the meta from the live D1 row.
 *
 * Perf contract (why this route is not a plain next()):
 *  • The rendered HTML is identical for every visitor, so it is stored in the
 *    colo cache (caches.default) — without that, every PDP hit re-ran two D1
 *    queries and measured ~630 ms TTFB with cf-cache-status: DYNAMIC.
 *  • The shell comes from env.ASSETS (the Pages asset store) instead of a
 *    same-origin fetch(), which used to cost a full extra edge round-trip
 *    back through functions/_middleware.js on every single product view.
 */
import { renderProductShell } from '../_pdp.js';

// Deliberately matched to /api/products (_headers: max-age=60). The visible price
// and stock on the PDP always come from that API, so capping the SSR shell at the
// same 60s means this cache introduces ZERO staleness the site didn't already have
// — an admin price edit still lands within a minute, exactly as before.
const EDGE_TTL = 60;    // seconds the colo keeps the rendered PDP
const BROWSER_TTL = 60; // seconds the browser keeps it

/**
 * The static product.html shell.
 * env.ASSETS bypasses Functions entirely, so there is no middleware re-entry
 * and no /product.html -> /product clean-URL redirect loop. The same-origin
 * fetch() is kept only as a last-resort fallback so an asset-store hiccup
 * degrades to the old (slower) behaviour instead of serving an empty page.
 */
async function loadShell(request, env) {
  const shellUrl = new URL('/product', request.url).toString();
  try {
    let res = await env.ASSETS.fetch(shellUrl);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location');
      if (loc) res = await env.ASSETS.fetch(new URL(loc, request.url).toString());
    }
    const html = await res.text();
    if (html && html.length > 500) return html;
  } catch (e) { /* fall through to the network path */ }
  return (await fetch(shellUrl)).text();
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const sku = decodeURIComponent(params.sku || '').trim();
  if (!sku) return Response.redirect(new URL('/categories', request.url).toString(), 302);

  // Cache key is the canonical path only — no query string, so ?fbclid= / utm_*
  // from Instagram, Facebook and ads all share one cached entry instead of
  // forcing a cold render per click.
  const canonicalUrl = new URL('/product/' + encodeURIComponent(sku), request.url).toString();
  const cacheable = request.method === 'GET';
  const cache = caches.default;
  const cacheKey = new Request(canonicalUrl, { method: 'GET' });

  // Every cache touch is best-effort. A cache fault must degrade to a normal
  // render, never to an error page.
  if (cacheable) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch (e) { /* render fresh */ }
  }

  let html = await loadShell(request, env);

  let p = null;
  try {
    p = await env.DB.prepare('SELECT * FROM products WHERE sku = ?').bind(sku).first();
  } catch (e) { /* fall through to the client "Product Not Found" state */ }

  // Unknown SKU: serve the un-rendered shell and do NOT cache it, so a product
  // added in admin a second later isn't shadowed by a stale negative entry.
  if (!p) {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  }

  html = await renderProductShell(html, p, env);
  const res = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`,
      'CDN-Cache-Control': `public, s-maxage=${EDGE_TTL}`,
      'X-SSR-Source': 'd1-clean',
    },
  });
  if (cacheable) {
    try { waitUntil(cache.put(cacheKey, res.clone()).catch(() => {})); } catch (e) { /* serve anyway */ }
  }
  return res;
}
