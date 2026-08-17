/**
 * Saubhagya — /categories SSR.
 *
 * Injects the product grid into the raw HTML so every design has a real
 * /product/<sku> link that Googlebot can crawl on its first (no-JS) pass — the
 * page that fixes the orphans. One card per design (colour siblings collapse
 * onto their lead SKU, which is the canonical — see functions/_pdp.js), so every
 * link here is a canonical URL and matches the sitemap and the client grid.
 * catalog.js overwrites #cat-grid on hydration with the identical interactive
 * grid; colour switching happens on the PDP. Also injects ItemList JSON-LD.
 *
 * env.ASSETS.fetch bypasses Functions, so loading the categories.html shell here
 * can never re-enter this handler. Rendered HTML is identical for every visitor
 * (client applies ?cat=/?q= filters after hydration), so it is edge-cached on
 * the bare /categories path exactly like the PDP route.
 */
import { fetchProducts, productCard, isVariantDup } from './_listing.js';

const SITE_URL = 'https://saubhagyajewellery.com';
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
    const all = await fetchProducts(env);
    // One card per design (colour siblings canonicalize onto their lead — see
    // functions/_pdp.js). This matches both the client grid (catalog.js hides
    // isVariantDup) and the sitemap, so every SSR link is a canonical URL.
    const leads = all.filter(p => !isVariantDup(p));
    if (leads.length) {
      const cards = leads.map(p => productCard(p, 'p')).join('');
      // ItemList tells Google the grid is a ranked list of these products, and
      // links each one — a second crawlable path on top of the <a> cards.
      const itemLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: leads.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/product/${encodeURIComponent(p.sku)}`,
          name: p.name,
        })),
      }).replace(/</g, '\\u003c');   // never let a stray '<' break out of the script tag
      html = html
        .replace(
          '<div class="cat-grid" id="cat-grid"></div>',
          `<div class="cat-grid" id="cat-grid">${cards}</div>`
        )
        .replace(
          /<div class="cat-loading" id="cat-loading">[\s\S]*?<\/div>/,
          '<div class="cat-loading" id="cat-loading" style="display:none">LOADING PIECES&hellip;</div>'
        )
        .replace('</head>', `<script type="application/ld+json">${itemLd}</script></head>`);
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
