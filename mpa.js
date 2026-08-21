/* ============================================================
 * SAUBHAGYA – MPA support foundation (Batch 1)
 * ------------------------------------------------------------
 * Self-contained hydration layer for every NON-SPA page
 * (about.html, contact.html, collection pages, track-orders…).
 * Zero dependencies - do NOT load support.js/React on these
 * pages; support.js is the generated DC runtime for index.html
 * only and must not be hand-edited.
 *
 * Shares state with the SPA through the same localStorage keys:
 *   cc_cart  = [{ id: <sku>, qty: n }, …]
 *   cc_user  = { id, name, email?, phone? }
 *   cc_token = session token issued by /api/auth/* or orders/save
 *
 * Page contract (Batch 2 layout component fills these in):
 *   <span  data-mpa-cart-count></span>   ← item count badge
 *   <a     data-mpa-auth href="…"></a>   ← "Sign in" / "Hi <name>"
 *   <a     data-mpa-cart-link></a>       ← cart link (badge parent)
 *
 * Public API: window.MPA
 *   .init()          re-run hydration (auto-runs on DOMContentLoaded)
 *   .getUser()       user object or null
 *   .getCart()       [{id, qty}]
 *   .setCart(items)  overwrite + persist + re-render badges
 *   .addToCart(id, qty=1)   merge + persist + re-render badges
 *   .cartCount()     total units
 *   .signOut()       clear session keys + re-render header
 *   .onChange(fn)    subscribe to cart/session changes (this tab + others)
 * ============================================================ */
(function () {
  'use strict';

  var K_CART = 'cc_cart', K_USER = 'cc_user', K_TOKEN = 'cc_token';
  var listeners = [];

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  /* ---- session -------------------------------------------------------- */

  // Verifies the locally persisted session. There is intentionally no
  // network call here: /api is frozen and has no /api/auth/session route.
  // When one exists, this is the single seam to swap in:
  //   fetch('/api/auth/session', {headers:{Authorization: token}}) …
  // A logged-in identity needs an email OR phone. `id` is optional so a guest
  // is "logged in" the moment they check out, before the server row exists.
  function getUser() {
    var u = read(K_USER, null);
    if (!u || typeof u !== 'object' || !(u.email || u.phone)) {
      if (u) { try { localStorage.removeItem(K_USER); } catch (e) {} } // corrupt row
      return null;
    }
    return u;
  }

  function signOut() {
    try {
      localStorage.removeItem(K_USER);
      localStorage.removeItem(K_TOKEN);
      sessionStorage.removeItem(K_USER);
      sessionStorage.removeItem(K_TOKEN);
    } catch (e) {}
    render();
    emit('auth');
  }

  /* ---- cart ------------------------------------------------------------ */

  function getCart() {
    var c = read(K_CART, []);
    if (!Array.isArray(c)) return [];
    return c.filter(function (i) { return i && i.id && (i.qty || 0) > 0; });
  }

  function setCart(items) {
    try { localStorage.setItem(K_CART, JSON.stringify(items || [])); } catch (e) {}
    render();
    emit('cart');
  }

  // Same shape the SPA writes: {id: sku, qty}. Every click persists
  // immediately, so the cart survives any cross-page navigation/reload.
  function addToCart(id, qty) {
    if (!id) return;
    var items = getCart();
    var hit = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) hit = items[i];
    if (hit) hit.qty += (qty || 1); else items.push({ id: id, qty: qty || 1 });
    setCart(items);
    toast('Added to bag');
  }

  /* Transient confirmation toast. Lives here (not per-page) so EVERY
     add-to-bag across the site gets the same feedback. Auto-dismisses. */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'mpa-toast';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        var css = document.createElement('style');
        css.textContent =
          '.mpa-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,14px);z-index:200;' +
          'display:flex;align-items:center;gap:9px;padding:13px 22px;border-radius:30px;' +
          'background:#0B291C;color:#fff;font:600 13px/1 "Montserrat",sans-serif;letter-spacing:.4px;' +
          'box-shadow:0 10px 30px rgba(11,41,28,.35);opacity:0;pointer-events:none;' +
          'transition:opacity .28s ease,transform .28s cubic-bezier(.25,1,.5,1)}' +
          '.mpa-toast.show{opacity:1;transform:translate(-50%,0)}' +
          '.mpa-toast .mt-ic{width:18px;height:18px;border-radius:50%;background:#C8901F;color:#241703;' +
          'display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:none}' +
          '@media(prefers-reduced-motion:reduce){.mpa-toast{transition:opacity .28s ease}}';
        document.head.appendChild(css);
        document.body.appendChild(toastEl);
      }
      toastEl.innerHTML = '<span class="mt-ic">&#10003;</span><span></span>';
      toastEl.lastChild.textContent = msg;
      // force reflow so the transition replays on repeat taps
      void toastEl.offsetWidth;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
    } catch (e) { /* never let UI feedback break an add-to-cart */ }
  }

  function cartCount() {
    return getCart().reduce(function (n, i) { return n + (i.qty || 0); }, 0);
  }

  /* ---- header hydration ------------------------------------------------ */

  function render() {
    var user = getUser();
    var count = cartCount();

    var badges = document.querySelectorAll('[data-mpa-cart-count]');
    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = count > 0 ? String(count) : '';
      badges[i].style.display = count > 0 ? '' : 'none';
    }

    var auths = document.querySelectorAll('[data-mpa-auth]');
    for (var j = 0; j < auths.length; j++) {
      var a = auths[j];
      var iconOnly = a.hasAttribute('data-mpa-auth-icon');
      if (user) {
        var first = String(user.name || 'Account').split(/\s+/)[0];
        if (!iconOnly) a.textContent = 'Hi, ' + first;
        a.setAttribute('href', a.getAttribute('data-mpa-account-href') || 'index.html');
        a.setAttribute('title', iconOnly ? ('Hi, ' + first) : (user.email || user.phone || ''));
        a.setAttribute('aria-label', iconOnly ? ('Account - Hi, ' + first) : (a.getAttribute('aria-label') || ''));
      } else {
        if (!iconOnly) a.textContent = 'Sign in';
        a.setAttribute('href', a.getAttribute('data-mpa-signin-href') || 'index.html');
        if (iconOnly) { a.setAttribute('title', 'Sign in'); a.setAttribute('aria-label', 'Sign in'); }
        else a.removeAttribute('title');
      }
    }
    // Sign-out + auth-only links (Account, Sign out): shown ONLY when logged in
    var outs = document.querySelectorAll('[data-mpa-signout],[data-mpa-onlyauth]');
    for (var k = 0; k < outs.length; k++) outs[k].style.display = user ? '' : 'none';
    // Inverse: shown ONLY when signed out (e.g. a mobile "Sign in" prompt that
    // shouldn't sit next to the already-signed-in profile icon).
    var guests = document.querySelectorAll('[data-mpa-onlyguest]');
    for (var m = 0; m < guests.length; m++) guests[m].style.display = user ? 'none' : '';
  }

  /* ---- change propagation ---------------------------------------------- */

  function emit(what) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](what); } catch (e) {}
    }
  }

  /* ---- orders (D1 backend) --------------------------------------------- */

  function fetchOrdersForUser() {
    var user = getUser();
    if (!user || !(user.email || user.phone)) return;
    var params = [];
    if (user.email) params.push('email=' + encodeURIComponent(user.email));
    if (user.phone) params.push('phone=' + encodeURIComponent(user.phone));
    if (!params.length) return;
    fetch('/api/orders/track?' + params.join('&'))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.success && d.orders) {
          window.MPA._orders = d.orders;
          emit('orders');
        }
      })
      .catch(function () { /* silent - network can fail on static pages */ });
  }

  function initMPA() {
    render();
    fetchOrdersForUser();
    return { user: getUser(), cart: getCart() };
  }

  window.MPA = {
    init: initMPA,
    getUser: getUser,
    getCart: getCart,
    setCart: setCart,
    addToCart: addToCart,
    cartCount: cartCount,
    toast: toast,
    signOut: signOut,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  // (b) re-hydrate immediately on DOMContentLoaded
  if (document.readyState !== 'loading') initMPA();
  else document.addEventListener('DOMContentLoaded', initMPA);

  // Another tab (or the SPA) changed the cart/session → refresh this header
  window.addEventListener('storage', function (e) {
    if (!e || e.key === K_CART || e.key === K_USER || e.key === null) {
      render();
      emit(e && e.key === K_USER ? 'auth' : 'cart');
    }
  });
})();

/* ── Web push opt-in ─────────────────────────────────────────────────────────
 * Registers the service worker and, only after the shopper has shown intent,
 * offers notifications.
 *
 * The prompt is deliberately NOT shown on first paint. A permission request
 * fired on page load is the single fastest way to get permanently blocked by
 * a browser (Chrome auto-denies sites with low accept rates), and a denial is
 * unrecoverable without the visitor digging through site settings. So: the
 * bar appears only on a repeat visit, and the real browser prompt is raised
 * only from the click on our own button.
 */
(function () {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  var VISITS = 'sj_visits', ASKED = 'sj_push_asked';
  var reg = null;

  function b64ToU8(base64) {
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }

  navigator.serviceWorker.register('/sw.js').then(function (r) {
    reg = r;
    maybeOffer();
  }).catch(function () { /* push simply stays unavailable */ });

  function bumpVisits() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(VISITS) || '0', 10) || 0; } catch (e) { return 0; }
    n++;
    try { localStorage.setItem(VISITS, String(n)); } catch (e) {}
    return n;
  }

  function maybeOffer() {
    var visits = bumpVisits();
    if (Notification.permission !== 'default') return;   // already granted or blocked
    try { if (localStorage.getItem(ASKED)) return; } catch (e) { return; }
    if (visits < 2) return;                              // not on the very first visit
    showBar();
  }

  function showBar() {
    var bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Get notified about new arrivals');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
      'background:#0B291C;color:#fff;border-radius:14px;padding:14px 16px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.28);display:flex;gap:12px;align-items:center;' +
      'font-size:13.5px;line-height:1.5;max-width:520px;margin:0 auto;';
    bar.innerHTML =
      '<div style="flex:1">Want to hear about new arrivals and festive offers?</div>' +
      '<button type="button" data-no style="background:none;border:none;color:#C5A880;font:inherit;cursor:pointer;padding:6px">Not now</button>' +
      '<button type="button" data-yes style="background:#C5A880;border:none;color:#0B291C;font:inherit;font-weight:700;border-radius:9px;padding:8px 14px;cursor:pointer">Yes</button>';

    function close() { try { localStorage.setItem(ASKED, '1'); } catch (e) {} bar.remove(); }
    bar.querySelector('[data-no]').addEventListener('click', close);
    bar.querySelector('[data-yes]').addEventListener('click', function () {
      close();
      subscribe();
    });
    document.body.appendChild(bar);
  }

  function subscribe() {
    if (!reg) return;
    fetch('/api/push/subscribe').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.publicKey) throw new Error('push not configured');
      // Raised from a user gesture, so the browser shows the real prompt.
      return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(d.publicKey),
      });
    }).then(function (sub) {
      var j = sub.toJSON();
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
      });
    }).catch(function () { /* denied or unsupported — nothing to do */ });
  }
})();
