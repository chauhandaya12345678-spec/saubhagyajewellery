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
      '<a class="logo" href="index.html">' +
      '<span class="logo-name">SAUBHAGYA</span>' +
      '<span class="logo-sub">FINE JEWELLERY</span></a>' +
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
      '<div class="fbrand"><div class="logo-name">SAUBHAGYA</div><div class="logo-sub">FINE JEWELLERY</div>' +
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
})();
