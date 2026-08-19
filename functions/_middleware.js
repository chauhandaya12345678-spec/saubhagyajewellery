/**
 * Hostname router for the one Pages project:
 *  - admin.saubhagyajewellery.com  → the original DESKTOP admin (admin.html +
 *    admin-orders/inventory/customers.html). Root ('/') serves admin.html.
 *  - saubhagyajewellery.com (+ www) → the storefront, unchanged. The admin
 *    pages (/admin, /admin.html, /admin-*.html) do NOT exist on this host.
 *
 * The mobile app (Android APK) is separate and just uses /api/* on this host.
 * Runs before every request (see _routes.json include "/*"). Wrapped so a bug
 * here can never take the store down — on error, fall through to next().
 */
const ADMIN_HOST = 'admin.saubhagyajewellery.com';

// Repo-only files (dev docs / DB scripts / deploy config) — belong in git,
// not served publicly. Pages deploys the whole repo since there's no build
// step, so these are otherwise reachable at yourdomain.com/<filename> with
// no auth. _redirects can't block them (Cloudflare Pages always lets a real
// static asset win over a _redirects rule at the same path — unlike Netlify,
// there's no override syntax for it), so this has to happen in a Function,
// which runs before static-asset serving.
const BLOCKED_PATHS = new Set([
  '/wrangler.toml', '/CLAUDE.md', '/HANDOVER.md', '/README.md', '/.gitignore',
  '/build/schema-d1.sql', '/build/seed-d1.sql',
]);

// Matched to /api/products (_headers: max-age=60). The homepage rail hydrates from
// that API, so capping the shell at the same 60s adds no staleness the site didn't
// already have, and a deploy reaches everyone within a minute.
const HOME_TTL = 60;

/**
 * Query-string-independent edge cache for the homepage.
 *
 * '/' is byte-identical for every visitor — the cart badge and sign-in state are
 * hydrated client-side from localStorage by mpa.js — but a Pages Function fronts
 * every route (_routes.json include "/*"), so Cloudflare marks the response
 * DYNAMIC and never caches it. Caching it here on the BARE path means the
 * ?fbclid= / ?utm_* that Instagram and ads append all share one entry instead of
 * forcing a cold render per click, while the browser URL keeps those params
 * intact so the Meta pixel still gets its attribution.
 *
 * Every step is best-effort: any fault degrades to a normal uncached render.
 * Returns a Response, or null if this request should fall through to the
 * regular routing below.
 */
async function homepageFromCache(context, url) {
  const { request, next, waitUntil } = context;
  const cache = caches.default;
  const key = new Request(new URL('/', url).toString(), { method: 'GET' });

  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch (e) { /* cache fault → render fresh */ }

  let upstream;
  try {
    upstream = await next();
  } catch (e) {
    return null; // next() never ran to completion; let the caller retry normally
  }

  try {
    const type = upstream.headers.get('Content-Type') || '';
    if (upstream.status !== 200 || !type.includes('text/html')) return upstream;

    const res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', `public, max-age=${HOME_TTL}, s-maxage=${HOME_TTL}`);
    res.headers.set('CDN-Cache-Control', `public, s-maxage=${HOME_TTL}`);
    try { waitUntil(cache.put(key, res.clone()).catch(() => {})); } catch (e) { /* serve anyway */ }
    return res;
  } catch (e) {
    return upstream; // headers/body untouched — serve exactly what the asset store gave us
  }
}

export async function onRequest(context) {
  const { request, next, env } = context;
  try {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname;

    if (request.method === 'GET' && BLOCKED_PATHS.has(path)) {
      return new Response('Not found', { status: 404 });
    }

    // ── Admin subdomain: the desktop admin ──
    if (host === ADMIN_HOST) {
      if (path === '/' || path === '') {
        // Serve admin.html at the root (clean-URL form avoids a 308).
        const idx = new URL(url);
        idx.pathname = '/admin';
        return env.ASSETS.fetch(new Request(idx.toString(), request));
      }
      return next(); // admin-*.html, /api/*, assets — served normally
    }

    // ── Legacy deep links → canonical URLs ─────────────────────────────────
    // The old site opened a product ON the homepage as /?product=<sku>, and
    // /index.html served a second copy of the homepage. Both still answered
    // 200 with homepage content, so Search Console filed them as soft 404s —
    // and as one duplicate of the homepage per SKU crawled.
    //
    // 301 both onto the canonical shape. A SKU that still exists lands on its
    // real PDP and keeps whatever equity the old URL had; a retired one (the
    // CC-* catalogue) gets an honest 404 from functions/product/[sku].js,
    // which is what makes Google drop it instead of re-crawling it forever.
    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      const legacySku = (url.searchParams.get('product') || '').trim();
      if (legacySku) {
        const to = new URL('/product/' + encodeURIComponent(legacySku), url);
        return Response.redirect(to.toString(), 301);
      }
      if (path === '/index.html') {
        const to = new URL('/', url);
        to.search = url.search;   // keep utm_*, fbclid, gclid on the way through
        return Response.redirect(to.toString(), 301);
      }
    }

    // ── Homepage edge cache (store host; the admin host returned above) ──
    if (request.method === 'GET' && path === '/') {
      const cached = await homepageFromCache(context, url);
      if (cached) return cached;
    }

    // ── Main store: admin is not reachable here ──
    if (path === '/admin' || path === '/admin.html' ||
        path.startsWith('/admin/') || path.startsWith('/admin-')) {
      return new Response('Not found', { status: 404 });
    }

    return next();
  } catch (e) {
    return next();
  }
}
