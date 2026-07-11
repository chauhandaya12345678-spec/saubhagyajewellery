/* ============================================================
 * SAUBHAGYA – shared layout components (Batch 2)
 * ------------------------------------------------------------
 * ONE source of truth for the header + footer of every static
 * page. Pages declare:
 *
 *   <head> … <script src="layout.js"></script>
 *            <script src="mpa.js" defer></script> … </head>
 *   <body>
 *     <x-layout page="about.html"></x-layout>   ← header (+active nav)
 *     <main>…page content…</main>
 *     <x-footer></x-footer>                     ← footer
 *
 * layout.js loads synchronously in <head> so the custom elements
 * upgrade while the body parses — header paints with the page,
 * no flash. mpa.js then hydrates the [data-mpa-*] hooks (cart
 * badge, Sign in / Hi <name>) from localStorage.
 *
 * Editing the header/footer? Change it HERE and in
 * build/site.js (header()/footer() emit these tags now).
 * index.html (the SPA) keeps its own header — do not add these
 * elements there.
 * ============================================================ */
(function () {
  'use strict';

  var APP = 'index.html';
  var SIGNIN = 'signin.html';
  var CART = 'cart.html';
  var WHATSAPP = 'https://wa.me/919987008435';

  /* Brand lotus mark (matches the gold logo) — inlined so it inherits page fonts/colors */
  var LOTUS = function (size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 64 52" fill="none" stroke="#C19A5B" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<g transform="translate(32,34)">' +
      '<path d="M0,-24 C8,-14 8,-3 0,6 C-8,-3 -8,-14 0,-24 Z"/>' +
      '<path d="M-20,-15 C-7,-11 -1,-2 0,6 C-12,4.8 -19,-4 -20,-15 Z"/>' +
      '<path d="M20,-15 C7,-11 1,-2 0,6 C12,4.8 19,-4 20,-15 Z"/>' +
      '<path d="M-32,-1 C-21,3 -8,6 0,6 C-10,13 -25,10 -32,-1 Z"/>' +
      '<path d="M32,-1 C21,3 8,6 0,6 C10,13 25,10 32,-1 Z"/>' +
      '</g><path d="M50,4 l2,5.5 5.5,2 -5.5,2 -2,5.5 -2,-5.5 -5.5,-2 5.5,-2 Z" fill="#C19A5B" stroke="none"/></svg>';
  };

  /* Head extras every page gets: favicon, theme color, brand/fx styles */
  (function injectHead() {
    var d = document;
    if (!d.querySelector('link[rel="icon"]')) {
      var fav = d.createElement('link');
      fav.rel = 'icon'; fav.type = 'image/svg+xml'; fav.href = 'favicon.svg';
      d.head.appendChild(fav);
    }
    if (!d.querySelector('meta[name="theme-color"]')) {
      var tc = d.createElement('meta');
      tc.name = 'theme-color'; tc.content = '#0B3C26';
      d.head.appendChild(tc);
    }
    var s = d.createElement('style');
    s.textContent = [
      /* ── professional 3-zone header (overrides site.css) ────────── */
      'header.site{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(197,160,89,.20)}',
      '.nav{display:flex;align-items:center;gap:24px;max-width:1280px;margin:0 auto;padding:14px 40px}',
      '.logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none;order:0}',
      /* Header brand SVG — scales cleanly at every breakpoint, no CSS blend hacks */
      '.brand-logo{display:block;max-height:60px;width:auto;height:auto;max-width:100%;overflow:visible;vertical-align:middle}',
      '@media(max-width:900px){.brand-logo{max-height:44px}}',
      '@media(max-width:480px){.brand-logo{max-height:36px}}',
      '.logo-stack{display:flex;flex-direction:column;align-items:flex-start}',
      '.logo-name{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:600;color:#0B3C26;letter-spacing:2px;line-height:1}',
      '.logo-sub{font-size:8px;letter-spacing:5px;color:#C5A059;margin-top:3px}',
      '.navlinks{order:1;flex:1;display:flex;justify-content:center;gap:26px;flex-wrap:nowrap;font-size:12px;letter-spacing:.6px;margin:0}',
      '.navlink{padding-bottom:3px;border-bottom:1px solid transparent;white-space:nowrap;color:#1A1A1A;text-decoration:none;transition:border-color .3s,color .3s}',
      '.navlink:hover,.navlink.is-active{border-bottom-color:#C5A059;color:#0B3C26}',
      '.nav-icons{order:2;flex:none;display:flex;align-items:center;gap:20px;font-size:11px;letter-spacing:1px}',
      '.nav-icons a{color:#1A1A1A;text-decoration:none;white-space:nowrap;transition:color .3s}',
      '.nav-icons a:hover{color:#0B3C26}',
      /* badge shows only when mpa.js clears the inline display:none (count>0) */
      '.nav-bag [data-mpa-cart-count]{align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;margin-left:4px;border-radius:9px;background:#0B3C26;color:#fff;font-size:10px;font-weight:600;line-height:1;vertical-align:middle}',
      '.nav-bag [data-mpa-cart-count]:not([style*="none"]){display:inline-flex}',
      '.nav-burger{order:0;display:none;flex-direction:column;justify-content:center;gap:5px;width:34px;height:34px;padding:0;background:none;border:none;cursor:pointer}',
      '.nav-burger span{display:block;height:2px;width:22px;background:#0B3C26;border-radius:2px;transition:transform .35s,opacity .25s}',
      '.nav-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
      '.nav-burger.open span:nth-child(2){opacity:0}',
      '.nav-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',
      /* slide-down drawer */
      '.nav-drawer{display:none;flex-direction:column;background:#fff;border-bottom:1px solid rgba(197,160,89,.2);overflow:hidden;max-height:0;transition:max-height .4s cubic-bezier(.22,1,.36,1)}',
      '.nav-drawer.open{max-height:70vh}',
      '.nav-drawer a{padding:15px 24px;font-size:14px;letter-spacing:.5px;color:#1A1A1A;text-decoration:none;border-top:1px solid #f0ece1}',
      '.nav-drawer a.is-active{color:#0B3C26}',
      '.nav-drawer a:first-child{border-top:none}',
      /* mobile layout */
      '@media(max-width:900px){',
      '  .nav{flex-direction:row;flex-wrap:nowrap;align-items:center;padding:11px 16px;gap:12px}',
      '  .navlinks,.nav-icons{flex:none}',
      '  .nav-burger{display:flex}',
      '  .logo{order:1;flex:1;justify-content:center}',
      '  .logo-name{font-size:19px;letter-spacing:1.5px}',
      '  .navlinks{display:none}',
      '  .nav-icons{order:2;gap:0}',
      '  .nav-icons .ni-hide{display:none}',
      '  .nav-drawer{display:flex}',
      '}',
      /* footer: gold brand on deep green */
      'footer.site .logo-name{color:#C9A75F!important}',
      'footer.site .logo-sub{color:rgba(201,167,95,.85)!important}',
      'footer.site .fbrand{display:flex;flex-direction:column;align-items:flex-start}',
      '@media(max-width:560px){footer.site .fbrand{align-items:center}}',
      /* Apple-TV 3D tilt (hover scale is guarded per-page under @media(hover:hover)) */
      '.fx-tilt{transform-style:preserve-3d;will-change:transform;transition:transform .45s cubic-bezier(.22,1,.36,1),box-shadow .45s cubic-bezier(.22,1,.36,1)}',
      '.fx-tilt.fx-active{transition:transform .06s linear,box-shadow .3s;box-shadow:0 24px 50px -18px rgba(6,40,26,.45),0 8px 20px -10px rgba(0,0,0,.3)}'
    ].join('');
    d.head.appendChild(s);
  })();
  var NAV = [
    { slug: 'index.html', label: 'Home' },
    { slug: 'south-indian-traditional.html', label: 'South Indian' },
    { slug: 'mumbai-modern.html', label: 'Mumbai Modern' },
    { slug: 'north-indian-bridal.html', label: 'North Indian Bridal' },
    { slug: 'about.html', label: 'About' },
    { slug: 'contact.html', label: 'Contact' }
  ];

  function headerHtml(active) {
    var links = NAV.map(function (n) {
      return '<a class="navlink' + (n.slug === active ? ' is-active' : '') + '" href="' + n.slug + '">' + n.label + '</a>';
    }).join('');
    var drawerLinks = links +
      '<a class="navlink" href="' + APP + '">Shop All</a>' +
      '<a class="navlink" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a class="navlink" href="track-orders.html">Track Orders</a>' +
      '<a class="navlink" href="account.html" data-mpa-onlyauth style="display:none">My Account</a>' +
      '<a class="navlink nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>';
    return '<header class="site">' +
      '<div class="nav">' +
      '<button class="nav-burger" id="nav-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '<a class="logo logo-real" href="index.html" aria-label="Saubhagya Jewellery home">' +
      '<img class="brand-logo" src="images/brand/saubhagya-logo.svg?v=3" alt="Saubhagya Jewellery"></a>' +
      '<nav class="navlinks">' + links + '</nav>' +
      '<div class="nav-icons">' +
      '<a class="ni-hide" href="' + APP + '" aria-label="Shop">Shop All</a>' +
      '<a class="ni-hide" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a class="ni-hide nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>' +
      '<a class="nav-bag" href="' + CART + '" aria-label="Bag">Bag <span data-mpa-cart-count style="display:none"></span></a>' +
      '</div></div>' +
      '<div class="nav-drawer" id="nav-drawer">' + drawerLinks + '</div>' +
      '</header>';
  }

  function footerHtml() {
    var company = [['About Us', 'about.html'], ['Locate Stores', 'contact.html'], ['Contact Us', 'contact.html'], ['Blogs', 'blogs.html']];
    var policy = [
      ['Track Orders', 'track-orders.html'], ['Shipping and Delivery', 'shipping-and-returns.html'],
      ['Return Policy', 'shipping-and-returns.html'], ['E & S Policy', 'es-policy.html'],
      ['Grievances', 'grievances.html'], ['Terms of Service', 'terms.html'],
      ['Offer T&C', 'offer-terms.html'], ['Privacy Policy', 'privacy-policy.html']
    ];
    var col = function (title, items) {
      return '<div class="fcol"><div class="fhead">' + title + '</div>' +
        items.map(function (i) { return '<a href="' + i[1] + '">' + i[0] + '</a>'; }).join('') + '</div>';
    };
    return '<div class="fwrap">' +
      '<div class="fbrand">' + LOTUS(40) + '<div class="logo-name" style="margin-top:8px">SAUBHAGYA</div><div class="logo-sub">FINE JEWELLERY</div>' +
      '<p>Premium designer imitation jewellery: temple, Kundan/Polki and American Diamond. High-quality artificial jewellery, handcrafted and dispatched insured across India.</p></div>' +
      col('COMPANY', company) + col('POLICY', policy) +
      '<div class="fcol"><div class="fhead">STORE LOCATION</div>' +
      '<p class="fatelier">Tanaji Nagar Rd, opp Vishwakarma Mandir<br>Hanuman Nagar, Kandivali East<br>Mumbai 400101<br>Phone: +91 99870 08435</p>' +
      '<a class="fwa" href="' + WHATSAPP + '">WhatsApp Support &rarr;</a></div></div>' +
      '<div class="fbar"><span>&copy; 2026 Saubhagya Jewellery &middot; High-quality imitation jewellery &middot; SSL secured</span>' +
      '<span class="fpay"><i>UPI</i><i>VISA</i><i>RuPay</i><i>EMI</i></span></div>';
  }

  var hydrate = function () { if (window.MPA) window.MPA.init(); };

  customElements.define('x-layout', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = headerHtml(this.getAttribute('page') || '');
      this.style.display = 'block';
      hydrate();
      // Sign-out delegation lives on the DOCUMENT, not on <x-layout>, so it
      // catches [data-mpa-signout] buttons anywhere on the page (account.html
      // has one in <main>). Guarded so multiple mounts don't rebind.
      if (!window.__mpaSignoutBound) {
        window.__mpaSignoutBound = true;
        document.addEventListener('click', function (e) {
          var s = e.target.closest('[data-mpa-signout]');
          if (!s) return;
          e.preventDefault();
          if (window.MPA) window.MPA.signOut();
          location.href = 'index.html';
        });
      }
      // Hamburger drawer
      var burger = this.querySelector('#nav-burger');
      var drawer = this.querySelector('#nav-drawer');
      if (burger && drawer) {
        var toggle = function (open) {
          burger.classList.toggle('open', open);
          drawer.classList.toggle('open', open);
          burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        burger.addEventListener('click', function () { toggle(!drawer.classList.contains('open')); });
        drawer.addEventListener('click', function (e) { if (e.target.closest('a')) toggle(false); });
        window.addEventListener('resize', function () { if (innerWidth > 900) toggle(false); });
      }
    }
  });

  customElements.define('x-footer', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<footer class="site">' + footerHtml() + '</footer>';
      this.style.display = 'block';
    }
  });

  /* ── Apple-TV style 3D tilt on cards ──────────────────────────────
   * Fine pointers (mouse/trackpad): tilt toward cursor on hover.
   * Touch: brief press-tilt while the finger is down, then a hard
   * reset on release. Exactly ONE card is ever tilted at a time —
   * `clearAll()` wipes any previous card so nothing stays "floating".*/
  (function tiltEngine() {
    var FINE = !!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
    var SELECTOR = '.card, .tr-card, .cat-tile, .her-tile, .product-card';
    var MAX = 7, raf = null, activeEl = null;

    function clear(el) {
      if (!el) return;
      el.classList.remove('fx-active', 'fx-tilt');
      el.style.transform = '';
      el.__pressed = false;
    }
    function clearAll() {
      var all = document.querySelectorAll('.fx-tilt');
      for (var i = 0; i < all.length; i++) clear(all[i]);
      activeEl = null;
    }
    function tilt(el, e, pressed) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      var s = pressed ? 0.985 : 1.035;
      el.style.transform = 'perspective(900px) rotateX(' + (-py * MAX).toFixed(2) + 'deg) rotateY(' + (px * MAX).toFixed(2) + 'deg) scale3d(' + s + ',' + s + ',' + s + ')';
    }

    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!FINE) { if (el && el.__pressed) tiltNow(el, e); return; }
      if (el !== activeEl) { clearAll(); activeEl = el; }
      if (!el) return;
      tiltNow(el, e);
    }, { passive: true });

    function tiltNow(el, e) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.classList.add('fx-tilt', 'fx-active');
        tilt(el, e, el.__pressed);
      });
    }

    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el) { clearAll(); return; }
      clearAll();
      activeEl = el; el.__pressed = true;
      el.classList.add('fx-tilt', 'fx-active');
      tilt(el, e, true);
    }, { passive: true });

    function release(e) {
      var el = e.target.closest(SELECTOR);
      if (FINE && el) { el.__pressed = false; tiltNow(el, e); return; }
      clearAll(); // touch: reset everything on lift/cancel
    }
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', clearAll, { passive: true });
    // Leaving a card with a fine pointer springs it back
    document.addEventListener('pointerout', function (e) {
      if (!FINE) return;
      var el = e.target.closest(SELECTOR);
      if (el && !el.contains(e.relatedTarget)) { clear(el); if (el === activeEl) activeEl = null; }
    });
    // Scrolling on touch cancels any press-tilt
    window.addEventListener('scroll', function () { if (!FINE) clearAll(); }, { passive: true });
  })();
})();
