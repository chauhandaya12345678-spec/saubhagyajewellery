/* ============================================================
 * SAUBHAGYA – shared layout components
 * ONE source of truth for the header + footer of every static
 * page. Change here + in build/site.js.
 * ============================================================ */
(function () {
  'use strict';

  var APP = 'index.html';
  var SIGNIN = 'signin.html';
  var CART = 'cart.html';
  var WHATSAPP = 'https://wa.me/919987008435';

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
      '.brand-logo{display:block;max-height:64px;width:auto;height:auto;max-width:100%;overflow:visible;vertical-align:middle}',
      '@media(max-width:900px){.brand-logo{max-height:48px}}',
      '@media(max-width:480px){.brand-logo{max-height:38px}}',
      '.logo-stack{display:flex;flex-direction:column;align-items:flex-start}',
      '.logo-name{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:600;color:#0B3C26;letter-spacing:2px;line-height:1}',
      '.logo-sub{font-size:8px;letter-spacing:5px;color:#C5A059;margin-top:3px}',
      '.navlinks{order:1;flex:1;display:flex;justify-content:center;gap:24px;flex-wrap:nowrap;font-size:12px;letter-spacing:.6px;margin:0}',
      '.navlink{padding-bottom:3px;border-bottom:1px solid transparent;white-space:nowrap;color:#1A1A1A;text-decoration:none;transition:border-color .3s,color .3s}',
      '.navlink:hover,.navlink.is-active{border-bottom-color:#C5A059;color:#0B3C26}',
      '.nav-icons{order:2;flex:none;display:flex;align-items:center;gap:18px;font-size:11px;letter-spacing:1px}',
      '.nav-icons a,.nav-icons button{color:#1A1A1A;text-decoration:none;white-space:nowrap;transition:color .3s;background:none;border:none;padding:0;font:inherit;letter-spacing:inherit;cursor:pointer}',
      '.nav-icons a:hover,.nav-icons button:hover{color:#0B3C26}',
      '.nav-search-icon{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none}',
      '.nav-bag [data-mpa-cart-count]{align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;margin-left:4px;border-radius:9px;background:#0B3C26;color:#fff;font-size:10px;font-weight:600;line-height:1;vertical-align:middle}',
      '.nav-bag [data-mpa-cart-count]:not([style*="none"]){display:inline-flex}',
      '.nav-burger{order:0;display:none;flex-direction:column;justify-content:center;gap:5px;width:34px;height:34px;padding:0;background:none;border:none;cursor:pointer}',
      '.nav-burger span{display:block;height:2px;width:22px;background:#0B3C26;border-radius:2px;transition:transform .35s,opacity .25s}',
      '.nav-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
      '.nav-burger.open span:nth-child(2){opacity:0}',
      '.nav-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',
      /* slide-down drawer */
      '.nav-drawer{display:none;flex-direction:column;background:#fff;border-bottom:1px solid rgba(197,160,89,.2);overflow:hidden;max-height:0;transition:max-height .4s cubic-bezier(.22,1,.36,1)}',
      '.nav-drawer.open{max-height:80vh;overflow-y:auto}',
      '.nav-drawer a{padding:15px 24px;font-size:14px;letter-spacing:.5px;color:#1A1A1A;text-decoration:none;border-top:1px solid #f0ece1}',
      '.nav-drawer a.is-active{color:#0B3C26}',
      '.nav-drawer a:first-child{border-top:none}',
      /* header search sheet */
      '.nav-search-sheet{position:fixed;top:0;left:0;width:100%;background:#fff;padding:22px 24px;box-shadow:0 4px 24px rgba(0,0,0,.08);transform:translateY(-100%);transition:transform .4s cubic-bezier(.22,1,.36,1);z-index:80}',
      '.nav-search-sheet.open{transform:translateY(0)}',
      '.nav-search-wrap{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:14px}',
      '.nav-search-input{flex:1;height:44px;padding:0 14px;border:1px solid #d4cec0;border-radius:4px;font:400 15px "Montserrat",sans-serif;outline:none;color:#1A1A1A;background:#fff}',
      '.nav-search-input:focus{border-color:#C5A059}',
      '.nav-search-close{background:none;border:none;font-size:22px;color:#6a6a6a;cursor:pointer;padding:4px 8px}',
      /* mobile layout */
      '@media(max-width:900px){',
      '  .nav{flex-direction:row;flex-wrap:nowrap;align-items:center;padding:11px 16px;gap:12px}',
      '  .navlinks,.nav-icons{flex:none}',
      '  .nav-burger{display:flex}',
      '  .logo{order:1;flex:1;justify-content:center}',
      '  .logo-name{font-size:19px;letter-spacing:1.5px}',
      '  .navlinks{display:none}',
      '  .nav-icons{order:2;gap:10px}',
      '  .nav-icons .ni-hide{display:none}',
      '  .nav-drawer{display:flex}',
      '}',
      /* footer: same brand SVG as header, sized down for the column,
         and a light brightness bump so the gold pops on deep green */
      'footer.site .fbrand{display:flex;flex-direction:column;align-items:flex-start;gap:14px}',
      'footer.site .brand-logo-footer{max-height:none;height:auto;width:200px;max-width:100%;filter:brightness(1.2) saturate(1.15) contrast(1.05)}',
      '@media(max-width:560px){footer.site .fbrand{align-items:center}footer.site .brand-logo-footer{width:170px}}',
      /* cookie consent banner */
      '.ck-banner{position:fixed;left:16px;right:16px;bottom:16px;background:#fff;border:1px solid #C5A059;border-radius:8px;box-shadow:0 12px 40px rgba(6,40,26,.18);padding:18px 22px;z-index:120;display:none;font-family:"Montserrat",sans-serif;font-size:12.5px;line-height:1.55;color:#3a3a3a;max-width:640px;margin:0 auto}',
      '.ck-banner.on{display:block;animation:ckSlide .5s cubic-bezier(.22,1,.36,1) both}',
      '@keyframes ckSlide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '.ck-banner p{margin:0 0 12px}',
      '.ck-banner a{color:#0B3C26;text-decoration:underline}',
      '.ck-btns{display:flex;gap:10px;flex-wrap:wrap}',
      '.ck-btn{border:none;padding:10px 18px;font:600 11px "Montserrat",sans-serif;letter-spacing:1.5px;cursor:pointer;border-radius:4px}',
      '.ck-btn.primary{background:#0B3C26;color:#fff}',
      '.ck-btn.ghost{background:transparent;color:#0B3C26;border:1px solid #C5A059}',
      /* Apple-TV 3D tilt */
      '.fx-tilt{transform-style:preserve-3d;will-change:transform;transition:transform .45s cubic-bezier(.22,1,.36,1),box-shadow .45s cubic-bezier(.22,1,.36,1)}',
      '.fx-tilt.fx-active{transition:transform .06s linear,box-shadow .3s;box-shadow:0 24px 50px -18px rgba(6,40,26,.45),0 8px 20px -10px rgba(0,0,0,.3)}'
    ].join('');
    d.head.appendChild(s);
  })();

  var NAV = [
    { slug: 'index.html', label: 'Home' },
    { slug: 'categories.html', label: 'Categories' },
    { slug: 'gifting.html', label: 'Gifting' },
    { slug: 'track-orders.html', label: 'Track Order' },
    { slug: 'about.html', label: 'About' },
    { slug: 'contact.html', label: 'Contact' }
  ];

  function headerHtml(active) {
    var links = NAV.map(function (n) {
      return '<a class="navlink' + (n.slug === active ? ' is-active' : '') + '" href="' + n.slug + '">' + n.label + '</a>';
    }).join('');
    var drawerLinks = links +
      '<a class="navlink" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a class="navlink" href="account.html" data-mpa-onlyauth style="display:none">My Account</a>' +
      '<a class="navlink nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>';
    var searchIcon =
      '<svg class="nav-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>';
    return '<header class="site">' +
      '<div class="nav">' +
      '<button class="nav-burger" id="nav-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '<a class="logo logo-real" href="index.html" aria-label="Saubhagya Jewellery home">' +
      '<img class="brand-logo" src="images/brand/saubhagya-logo.svg?v=4" alt="Saubhagya Jewellery"></a>' +
      '<nav class="navlinks">' + links + '</nav>' +
      '<div class="nav-icons">' +
      '<button type="button" id="nav-search-btn" aria-label="Search">' + searchIcon + '</button>' +
      '<a class="ni-hide" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a class="ni-hide nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>' +
      '<a class="nav-bag" href="' + CART + '" aria-label="Bag">Bag <span data-mpa-cart-count style="display:none"></span></a>' +
      '</div></div>' +
      '<div class="nav-drawer" id="nav-drawer">' + drawerLinks + '</div>' +
      '<div class="nav-search-sheet" id="nav-search-sheet">' +
      '<div class="nav-search-wrap">' +
      '<input class="nav-search-input" id="nav-search-input" type="search" placeholder="Search jewellery: necklaces, earrings, bridal sets…" autocomplete="off">' +
      '<button class="nav-search-close" id="nav-search-close" aria-label="Close">×</button>' +
      '</div></div>' +
      '</header>';
  }

  function footerHtml() {
    var company = [['About Us', 'about.html'], ['Contact Us', 'contact.html'], ['Categories', 'categories.html'], ['Gifting', 'gifting.html'], ['Blogs', 'blogs.html']];
    var policy = [
      ['Track Orders', 'track-orders.html'], ['Shipping and Delivery', 'shipping-and-returns.html'],
      ['Return Policy', 'shipping-and-returns.html'], ['E & S Policy', 'es-policy.html'],
      ['Grievances', 'grievances.html'], ['Terms of Service', 'terms.html'],
      ['Offer T&C', 'offer-terms.html'], ['Cookie Policy', 'cookie-policy.html'], ['Privacy Policy', 'privacy-policy.html']
    ];
    var col = function (title, items) {
      return '<div class="fcol"><div class="fhead">' + title + '</div>' +
        items.map(function (i) { return '<a href="' + i[1] + '">' + i[0] + '</a>'; }).join('') + '</div>';
    };
    return '<div class="fwrap">' +
      '<div class="fbrand">' +
      '<img class="brand-logo brand-logo-footer" src="images/brand/saubhagya-logo.svg?v=4" alt="Saubhagya Jewellery">' +
      '<p>Handcrafted premium imitation jewellery from our Mumbai warehouse. Every piece is manufactured in-house, inspected and dispatched insured across India.</p></div>' +
      col('COMPANY', company) + col('POLICY', policy) +
      '<div class="fcol"><div class="fhead">SELLER &amp; SUPPORT</div>' +
      '<p class="fatelier"><strong>Saubhagya Jewellery</strong><br>Proprietor: Dayasingh Chauhan<br>Tanaji Nagar Rd, opp Vishwakarma Mandir<br>Hanuman Nagar, Kandivali East<br>Mumbai 400101, Maharashtra, India<br>Care: +91 99870 08435<br>care@saubhagyajewellery.com<br><br><strong>Grievance Officer:</strong><br>Dayasingh Chauhan<br>care@saubhagyajewellery.com<br>+91 99870 08435<br>Ack. 48 hrs · Resolve within 30 days</p>' +
      '<a class="fwa" href="' + WHATSAPP + '">WhatsApp Support &rarr;</a></div></div>' +
      '<div class="fbar"><span>&copy; 2026 Saubhagya Jewellery &middot; Manufacturer &amp; direct seller &middot; SSL secured</span>' +
      '<span class="fpay"><i>UPI</i><i>VISA</i><i>RuPay</i><i>EMI</i></span></div>';
  }

  var hydrate = function () { if (window.MPA) window.MPA.init(); };

  customElements.define('x-layout', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = headerHtml(this.getAttribute('page') || '');
      this.style.display = 'block';
      hydrate();
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
      /* header search sheet */
      var sBtn = this.querySelector('#nav-search-btn');
      var sSheet = this.querySelector('#nav-search-sheet');
      var sIn = this.querySelector('#nav-search-input');
      var sClose = this.querySelector('#nav-search-close');
      if (sBtn && sSheet) {
        var openSheet = function () { sSheet.classList.add('on'); setTimeout(function () { sIn && sIn.focus(); }, 100); };
        var closeSheet = function () { sSheet.classList.remove('on'); if (sIn) sIn.value = ''; };
        sBtn.addEventListener('click', openSheet);
        sClose && sClose.addEventListener('click', closeSheet);
        sIn && sIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            var q = (sIn.value || '').trim();
            if (q) location.href = 'categories.html?q=' + encodeURIComponent(q);
          } else if (e.key === 'Escape') { closeSheet(); }
        });
      }
    }
  });

  customElements.define('x-footer', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<footer class="site">' + footerHtml() + '</footer>';
      this.style.display = 'block';
    }
  });

  /* ── Cookie consent banner (DPDPA 2023) ─────────────────────────── */
  (function cookieConsent() {
    function ready(fn) {
      if (document.readyState !== 'loading') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }
    ready(function () {
      var choice = null;
      try { choice = localStorage.getItem('cc_cookie_consent'); } catch (e) {}
      if (choice) return;
      var el = document.createElement('div');
      el.className = 'ck-banner';
      el.innerHTML =
        '<p><strong>We value your privacy.</strong> We use cookies to remember your cart, sign-in and to measure site usage. You can accept all or use only essential cookies. See our <a href="cookie-policy.html">Cookie Policy</a> and <a href="privacy-policy.html">Privacy Policy</a>.</p>' +
        '<div class="ck-btns">' +
        '<button class="ck-btn primary" id="ck-accept">ACCEPT ALL</button>' +
        '<button class="ck-btn ghost" id="ck-essential">ESSENTIAL ONLY</button>' +
        '</div>';
      document.body.appendChild(el);
      setTimeout(function () { el.classList.add('on'); }, 400);
      var save = function (v) {
        try { localStorage.setItem('cc_cookie_consent', v); } catch (e) {}
        el.classList.remove('on');
        setTimeout(function () { el.remove(); }, 400);
      };
      el.querySelector('#ck-accept').addEventListener('click', function () { save('all'); });
      el.querySelector('#ck-essential').addEventListener('click', function () { save('essential'); });
    });
  })();

  /* ── Apple-TV style 3D tilt on cards ────────────────────────────── */
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
      clearAll();
    }
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', clearAll, { passive: true });
    document.addEventListener('pointerout', function (e) {
      if (!FINE) return;
      var el = e.target.closest(SELECTOR);
      if (el && !el.contains(e.relatedTarget)) { clear(el); if (el === activeEl) activeEl = null; }
    });
    window.addEventListener('scroll', function () { if (!FINE) clearAll(); }, { passive: true });
  })();
})();
