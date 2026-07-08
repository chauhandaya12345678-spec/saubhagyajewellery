/* ============================================================
 * SAUBHAGYA – MPA support foundation (Batch 1)
 * ------------------------------------------------------------
 * Self-contained hydration layer for every NON-SPA page
 * (about.html, contact.html, collection pages, track-orders…).
 * Zero dependencies — do NOT load support.js/React on these
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
  function getUser() {
    var u = read(K_USER, null);
    if (!u || typeof u !== 'object' || !u.id || !(u.email || u.phone)) {
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
      if (user) {
        var first = String(user.name || 'Account').split(/\s+/)[0];
        a.textContent = 'Hi, ' + first;
        a.setAttribute('href', a.getAttribute('data-mpa-account-href') || 'index.html');
        a.setAttribute('title', user.email || user.phone || '');
      } else {
        a.textContent = 'Sign in';
        a.setAttribute('href', a.getAttribute('data-mpa-signin-href') || 'index.html');
        a.removeAttribute('title');
      }
    }
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
      .catch(function () { /* silent — network can fail on static pages */ });
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
