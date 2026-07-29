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

export async function onRequest(context) {
  const { request, next, env } = context;
  try {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname;

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
