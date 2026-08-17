/**
 * Saubhagya — /categories SSR.
 *
 * Injects the full product grid into the raw HTML so every product has a real
 * /product/<sku> link that Googlebot can crawl on its first (no-JS) pass. This
 * is the page that fixes the orphans: it renders EVERY in-stock row, colour
 * siblings INCLUDED (no isVariantDup filter), so all 44 sitemap URLs get at
 * least one internal link. catalog.js then overwrites #cat-grid on hydration
 * with its de-duped interactive grid (one card per design + colour switching on
 * the PDP) — real users see the curated grid, the crawler already saw them all.
 *
 * env.ASSETS.fetch bypasses Functions, so loading the categories.html shell here
 * can never re-enter this handler. Rendered HTML is identical for every visitor
 * (client applies ?cat=/?q= filters after hydration), so it is edge-cached on
 * the bare /categories path exactly like the PDP route.
 */
import { fetchProducts, productCard } from './_listing.js';

const EDGE_TTL = 60;
const BROWSER_TTL = 60;

async function loadShell(request, env) {
  const shellUrl = new URL('/categories', request.url).toString();
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
  const { request, env, waitUntil } = context;

  const cacheable = request.method === 'GET';
  const cache = caches.default;
  const cacheKey = new Request(new URL('/categories', request.url).toString(), { method: 'GET' });
  if (cacheable) {
    try { const hit = await cache.match(cacheKey); if (hit) return hit; } catch (e) { /* render fresh */ }
  }

  let html = await loadShell(request, env);

  try {
    const all = await fetchProducts(env);   // ALL in-stock rows, no dedup
    if (all.length) {
      const cards = all.map(p => productCard(p, 'p')).join('');
      html = html
        .replace(
          '<div class="cat-grid" id="cat-grid"></div>',
          `<div class="cat-grid" id="cat-grid">${cards}</div>`
        )
        .replace(
          /<div class="cat-loading" id="cat-loading">[\s\S]*?<\/div>/,
          '<div class="cat-loading" id="cat-loading" style="display:none">LOADING PIECES&hellip;</div>'
        );
    }
  } catch (e) { /* D1 unreachable → serve the shell unchanged; catalog.js still hydrates */ }

  const res = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`,
      'CDN-Cache-Control': `public, s-maxage=${EDGE_TTL}`,
      'X-SSR-Source': 'd1-listing',
    },
  });
  if (cacheable) {
    try { waitUntil(cache.put(cacheKey, res.clone()).catch(() => {})); } catch (e) { /* serve anyway */ }
  }
  return res;
}
