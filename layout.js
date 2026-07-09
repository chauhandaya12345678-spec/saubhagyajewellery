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
    s.textContent =
      '.logo{display:flex;align-items:center;gap:10px;text-decoration:none}' +
      '.logo-stack{display:flex;flex-direction:column;align-items:flex-start}' +
      /* footer: gold brand on deep green (header colors were invisible there) */
      'footer.site .logo-name{color:#C9A75F!important}' +
      'footer.site .logo-sub{color:rgba(201,167,95,.85)!important}' +
      'footer.site .fbrand{display:flex;flex-direction:column;align-items:flex-start}' +
      '@media(max-width:560px){footer.site .fbrand{align-items:center}}' +
      /* Apple-TV style 3D tilt */
      '.fx-tilt{transform-style:preserve-3d;will-change:transform;transition:transform .45s cubic-bezier(.22,1,.36,1),box-shadow .45s cubic-bezier(.22,1,.36,1)}' +
      '.fx-tilt.fx-active{transition:transform .06s linear,box-shadow .3s}' +
      '.fx-tilt.fx-active{box-shadow:0 24px 50px -18px rgba(6,40,26,.45),0 8px 20px -10px rgba(0,0,0,.3)}';
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
    return '<header class="site"><div class="nav">' +
      '<nav class="navlinks">' + links + '</nav>' +
      '<a class="logo" href="index.html" aria-label="Saubhagya Jewellery home">' + LOTUS(34) +
      '<span class="logo-stack"><span class="logo-name">SAUBHAGYA</span>' +
      '<span class="logo-sub">FINE JEWELLERY</span></span></a>' +
      '<div class="nav-icons">' +
      '<a href="' + APP + '" aria-label="Shop">Shop All</a>' +
      '<a data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="track-orders.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a href="' + CART + '" aria-label="Bag">Bag <span data-mpa-cart-count style="display:none"></span></a>' +
      '</div></div></header>';
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
      '<div class="fcol"><div class="fhead">THE ATELIER</div>' +
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
    }
  });

  customElements.define('x-footer', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<footer class="site">' + footerHtml() + '</footer>';
      this.style.display = 'block';
    }
  });

  /* ── Apple-TV style 3D tilt on cards ──────────────────────────────
   * Cards tilt toward the cursor (max ~7°), lift slightly and deepen
   * their shadow; springs back on leave, presses down on click.
   * Desktop pointers only — touch devices skip it entirely.           */
  (function tiltEngine() {
    if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var SELECTOR = '.card, .tr-card, .cat-tile, .her-tile, .product-card';
    var MAX = 7, raf = null;

    function apply(el, e, pressed) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      var s = pressed ? 0.985 : 1.035;
      el.style.transform = 'perspective(900px) rotateX(' + (-py * MAX).toFixed(2) + 'deg) rotateY(' + (px * MAX).toFixed(2) + 'deg) scale3d(' + s + ',' + s + ',' + s + ')';
    }

    document.addEventListener('pointerover', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el || el.__fx) return;
      el.__fx = true;
      el.classList.add('fx-tilt');
    });

    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.classList.add('fx-active');
        apply(el, e, el.__pressed);
      });
    }, { passive: true });

    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el) return;
      el.__pressed = true;
      apply(el, e, true);
    }, { passive: true });

    document.addEventListener('pointerup', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el) return;
      el.__pressed = false;
      apply(el, e, false);
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      var el = e.target.closest(SELECTOR);
      if (!el) return;
      if (el.contains(e.relatedTarget)) return;
      el.__pressed = false;
      el.classList.remove('fx-active');
      el.style.transform = '';
    });
  })();
})();
