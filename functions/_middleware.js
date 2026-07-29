/**
 * Hostname router for the one Pages project:
 *  - admin.saubhagyajewellery.com  → serves the Saubhagya Manager web app
 *    (the same UI as the Android app), a SPA hosted under /_admin/. Its /api/*
 *    calls fall through to the normal Pages Functions.
 *  - saubhagyajewellery.com (+ www) → the storefront, unchanged. The old HTML
 *    admin (/admin, /admin.html, /admin-*.html) no longer exists here.
 *
 * Runs before every request (see _routes.json include "/*"). Anything not
 * explicitly handled calls next(), so the storefront behaves exactly as before.
 * Wrapped so a bug here can never take the store down — on error, fall through.
 */
const ADMIN_HOST = 'admin.saubhagyajewellery.com';

export async function onRequest(context) {
  const { request, next, env } = context;
  try {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname;

    // ── Admin subdomain: serve the admin SPA ──
    if (host === ADMIN_HOST) {
      if (path.startsWith('/api/')) return next();      // API → Pages Functions
      if (path.startsWith('/_admin/')) return next();   // real SPA asset
      // SPA route (/, /orders, /logs, …) → serve the app shell.
      // Use the trailing-slash form: Pages clean-URLs 308 /_admin/index.html → /_admin/.
      const idxUrl = new URL(url);
      idxUrl.pathname = '/_admin/';
      return env.ASSETS.fetch(new Request(idxUrl.toString(), request));
    }

    // ── Main store: the HTML admin is gone from this host ──
    if (path === '/admin' || path === '/admin.html' ||
        path.startsWith('/admin/') || path.startsWith('/admin-')) {
      return new Response('Not found', { status: 404 });
    }
    // Don't expose the raw admin bundle on the storefront host either.
    if (path === '/_admin' || path.startsWith('/_admin/')) {
      return new Response('Not found', { status: 404 });
    }

    return next();
  } catch (e) {
    // Never break the site because of the router.
    return next();
  }
}
