/* Saubhagya Jewellery — service worker.
 *
 * Scope: push notifications only. It deliberately does NOT cache pages or
 * intercept fetches. A caching service worker on a storefront is the classic
 * way to serve a customer a stale price or a sold-out product, and Cloudflare
 * already handles edge caching properly one layer up.
 *
 * Push messages arrive with no payload (see functions/api/_push.js), so the
 * handler fetches the current broadcast and renders that.
 */

self.addEventListener('install', (event) => {
  // Take over straight away rather than waiting for every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let n = { title: 'Saubhagya Jewellery', body: '', url: '/' };
    try {
      // Some browsers do deliver a payload; prefer it when present.
      if (event.data) {
        try { n = Object.assign(n, event.data.json()); }
        catch { n.body = event.data.text() || n.body; }
      }
      if (!n.body) {
        const res = await fetch('/api/push/latest', { cache: 'no-store' });
        if (res.ok) n = Object.assign(n, await res.json());
      }
    } catch (e) {
      // Fall through and show the generic notification — a push that resolves
      // to nothing at all is worse than a plain one.
    }
    if (!n.body) return;   // nothing to say; stay silent rather than spam
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: n.icon || '/images/brand/favicon-mark.png',
      badge: '/images/brand/favicon-mark.png',
      data: { url: n.url || '/' },
      tag: 'saubhagya-' + (n.id || 'broadcast'),   // collapse duplicates
      renotify: false,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an open tab on our origin instead of piling up new windows.
    for (const c of all) {
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        try { await c.navigate(target); } catch (e) { /* navigate can be blocked; focus anyway */ }
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
