/**
 * Saubhagya — homepage SSR ( / ).
 *
 * Injects the "trending" rail's product cards into the raw HTML so Googlebot (and
 * any no-JS client) sees real /product/<sku> links on the highest-authority page
 * of the site, instead of an empty <div id="tr-grid"> that only catalog.js fills.
 * See functions/_listing.js for the full why.
 *
 * The 8 picks mirror renderTrending() in index.html exactly: in-stock, colour
 * siblings collapsed, first 8 in catalogue order — so the card catalog.js paints
 * on hydration is byte-for-byte what was already in the HTML (no flicker, no
 * layout shift).
 *
 * This function IS the `next()` target that functions/_middleware.js awaits for
 * '/', so the middleware's edge cache stores the INJECTED html. env.ASSETS.fetch
 * bypasses Functions, so loading the shell here can never re-enter this handler.
 */
import { fetchProducts, isVariantDup, productCard } from './_listing.js';

const EDGE_TTL = 60;    // matches /api/products + the homepage middleware cache
const BROWSER_TTL = 60;

async function loadShell(request, env) {
  const shellUrl = new URL('/', request.url).toString();
  try {
    const res = await env.ASSETS.fetch(shellUrl);
    const html = await res.text();
    if (html && html.length > 500) return html;
  } catch (e) { /* fall through to the network path */ }
  return (await fetch(shellUrl)).text();
}

export async function onRequest(context) {
  const { request, env } = context;
  let html = await loadShell(request, env);

  try {
    const all = await fetchProducts(env);
    const picks = all.filter(p => !isVariantDup(p)).slice(0, 8);
    if (picks.length) {
      const cards = picks.map(p => productCard(p, 'tr')).join('');
      html = html
        .replace(
          '<div class="tr-grid" id="tr-grid"></div>',
          `<div class="tr-grid" id="tr-grid">${cards}</div>`
        )
        // Hide the "LOADING PIECES…" placeholder for the no-JS view; catalog.js
        // hides it too the moment it renders, so JS users see no difference.
        .replace(
          /<div class="tr-loading" id="tr-loading">[\s\S]*?<\/div>/,
          '<div class="tr-loading" id="tr-loading" style="display:none">LOADING PIECES&hellip;</div>'
        );
    }
  } catch (e) { /* D1 unreachable → serve the shell unchanged; catalog.js still hydrates */ }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`,
      'X-SSR-Source': 'd1-listing',
    },
  });
}
