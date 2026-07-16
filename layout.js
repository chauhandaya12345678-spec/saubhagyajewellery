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
      'header.site{position:fixed;top:0;left:0;width:100%;z-index:1000;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(197,160,89,.20)}',
      '.nav{display:flex;align-items:center;gap:24px;max-width:1280px;margin:0 auto;padding:14px 40px}',
      '.logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none;order:0}',
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
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
      '.nav-drawer{display:none;flex-direction:column;background:#fff;border-bottom:1px solid rgba(197,160,89,.2);overflow:hidden;max-height:0;transition:max-height .45s cubic-bezier(.22,1,.36,1);padding-bottom:env(safe-area-inset-bottom);position:fixed;top:59px;left:0;right:0;z-index:70;isolation:isolate;box-shadow:0 12px 30px rgba(6,40,26,.12)}',
      '.nav-drawer.open{max-height:calc(100vh - 59px);overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.nav-drawer a{padding:17px 22px;font:500 14px "Montserrat",sans-serif;letter-spacing:.6px;color:#1A1A1A;text-decoration:none;border-top:1px solid #f0ece1;transition:background .2s,color .2s;display:flex;align-items:center;justify-content:space-between}',
      '.nav-drawer a::after{content:"›";color:#C5A059;font-size:20px;opacity:.6;transition:transform .25s}',
      '.nav-drawer a:hover,.nav-drawer a:active{background:#faf8f3;color:#0B3C26}',
      '.nav-drawer a:hover::after,.nav-drawer a:active::after{transform:translateX(4px);opacity:1}',
      '.nav-drawer a.is-active{color:#0B3C26;background:#faf8f3}',
      '.nav-drawer a:first-child{border-top:none}',
      '.nav-drawer-backdrop{position:fixed;inset:0;top:64px;background:rgba(6,40,26,.4);z-index:59;opacity:0;pointer-events:none;transition:opacity .35s}',
      '.nav-drawer-backdrop.on{opacity:1;pointer-events:auto}',
      /* header search sheet */
      '.nav-search-sheet{position:fixed;top:0;left:0;right:0;background:#fff;padding:18px 20px 22px;box-shadow:0 12px 40px rgba(6,40,26,.14);transform:translateY(-100%);transition:transform .45s cubic-bezier(.22,1,.36,1);z-index:80;padding-top:calc(18px + env(safe-area-inset-top))}',
      '.nav-search-sheet.on{transform:translateY(0)}',
      '.nav-search-wrap{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:10px}',
      '.nav-search-form{flex:1;display:flex;align-items:center;gap:8px;border:1px solid #d4cec0;border-radius:8px;background:#fff;padding:0 6px 0 14px;transition:border-color .25s,box-shadow .25s}',
      '.nav-search-form:focus-within{border-color:#C5A059;box-shadow:0 0 0 3px rgba(197,160,89,.15)}',
      '.nav-search-icon-l{width:18px;height:18px;stroke:#9a9a9a;stroke-width:2;fill:none;flex:none}',
      '.nav-search-input{flex:1;min-width:0;height:46px;border:none;background:transparent;font:400 15px "Montserrat",sans-serif;outline:none;color:#1A1A1A}',
      '.nav-search-input::-webkit-search-cancel-button{-webkit-appearance:none}',
      '.nav-search-go{height:38px;padding:0 18px;background:#0B3C26;color:#fff;border:none;border-radius:6px;font:600 11px "Montserrat",sans-serif;letter-spacing:1.5px;cursor:pointer;flex:none}',
      '.nav-search-go:hover{background:#06281a}',
      '.nav-search-close{background:none;border:none;font-size:26px;color:#6a6a6a;cursor:pointer;padding:4px 10px;line-height:1;flex:none}',
      '.nav-search-close:hover{color:#0B3C26}',
      '.nav-search-hits{max-width:720px;margin:12px auto 0;background:#fff;border:1px solid #eee5d6;border-radius:10px;overflow:hidden;max-height:min(60vh,420px);overflow-y:auto;display:none;-webkit-overflow-scrolling:touch}',
      '.nav-search-hits.on{display:block;animation:nshFade .25s ease}',
      '@keyframes nshFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',
      '.nav-search-hit{display:flex;align-items:center;gap:12px;padding:10px 12px;text-decoration:none;color:#1A1A1A;border-bottom:1px solid #f5f0e2;transition:background .2s}',
      '.nav-search-hit:hover,.nav-search-hit.active{background:#faf8f3}',
      '.nav-search-hit:last-child{border-bottom:none}',
      '.nav-search-hit-img{width:48px;height:60px;flex:none;border-radius:6px;background-size:cover;background-position:center;background-color:#f0ede5}',
      '.nav-search-hit-meta{flex:1;min-width:0}',
      '.nav-search-hit-name{font-family:"Cormorant Garamond",serif;font-size:15px;color:#1A1A1A;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nav-search-hit-cat{font-family:"Montserrat",sans-serif;font-size:11px;color:#9a9a9a;margin-top:2px;letter-spacing:.4px}',
      '.nav-search-hit-price{font-family:"Montserrat",sans-serif;font-size:13px;font-weight:500;color:#0B3C26;flex:none}',
      '.nav-search-more{display:block;padding:12px;text-align:center;font-family:"Montserrat",sans-serif;font-size:11px;letter-spacing:1.5px;color:#0B3C26;background:#faf8f3;text-decoration:none;border-top:1px solid #eee5d6}',
      '.nav-search-empty{padding:22px 16px;text-align:center;font-family:"Montserrat",sans-serif;font-size:12px;color:#9a9a9a}',
      '.nav-search-backdrop{position:fixed;inset:0;background:rgba(6,40,26,.4);z-index:79;opacity:0;pointer-events:none;transition:opacity .3s}',
      '.nav-search-backdrop.on{opacity:1;pointer-events:auto}',
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
      '@media(max-width:560px){footer.site .fbrand{align-items:center;text-align:center}footer.site .brand-logo-footer{width:170px}footer.site .fsocial{justify-content:center}}',
      'footer.site .fsocial{display:flex;flex-wrap:wrap;gap:14px;margin-top:4px}',
      'footer.site .fsocial a{font:500 12px "Montserrat",sans-serif;letter-spacing:.5px;color:#C5A059;text-decoration:none;border-bottom:1px solid rgba(197,160,89,.35);padding-bottom:2px;transition:color .3s,border-color .3s}',
      'footer.site .fsocial a:hover{color:#fff;border-bottom-color:#fff}',
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
      '<a class="logo logo-real" href="index.html" title="Saubhagya Jewellery — Home">' +
      '<img class="brand-logo" src="images/brand/saubhagya-logo.svg?v=4" alt="Saubhagya Jewellery" title="Saubhagya Jewellery" width="240" height="64">' +
      '<span class="sr-only">Saubhagya Jewellery — handcrafted imitation jewellery, Mumbai. Home.</span>' +
      '</a>' +
      '<nav class="navlinks">' + links + '</nav>' +
      '<div class="nav-icons">' +
      '<button type="button" id="nav-search-btn" aria-label="Search">' + searchIcon + '</button>' +
      '<a class="ni-hide" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '">Sign in</a>' +
      '<a class="ni-hide nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>' +
      '<a class="nav-bag" href="' + CART + '" aria-label="Bag">Bag <span data-mpa-cart-count style="display:none"></span></a>' +
      '</div></div>' +
      '<div class="nav-drawer" id="nav-drawer">' + drawerLinks + '</div>' +
      '<div class="nav-drawer-backdrop" id="nav-drawer-backdrop"></div>' +
      '<div class="nav-search-backdrop" id="nav-search-backdrop"></div>' +
      '<div class="nav-search-sheet" id="nav-search-sheet" role="search">' +
      '<div class="nav-search-wrap">' +
      '<form class="nav-search-form" id="nav-search-form" action="categories.html" method="get">' +
      '<svg class="nav-search-icon-l" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>' +
      '<input class="nav-search-input" id="nav-search-input" name="q" type="search" placeholder="Search jewellery: necklaces, earrings, bridal sets…" autocomplete="off" enterkeyhint="search" inputmode="search">' +
      '<button class="nav-search-go" type="submit" aria-label="Search">SEARCH</button>' +
      '</form>' +
      '<button class="nav-search-close" id="nav-search-close" type="button" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="nav-search-hits" id="nav-search-hits" role="listbox" aria-label="Search suggestions"></div>' +
      '</div>' +
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
    /* Mobile-friendly footer col: collapses on ≤560px via <details>; open on desktop via CSS */
    var col = function (title, items) {
      return '<details class="fcol"><summary class="fhead">' + title + '</summary>' +
        items.map(function (i) { return '<a href="' + i[1] + '">' + i[0] + '</a>'; }).join('') + '</details>';
    };
    var MAPS = 'https://maps.google.com/?q=Saubhagya+Jewellery+Kandivali+East+Mumbai';
    var INSTA = 'https://www.instagram.com/saubhagyajewellery';
    var FB = 'https://www.facebook.com/saubhagyajewellery';
    var social =
      '<div class="fsocial">' +
      '<a href="' + INSTA + '" rel="noopener" target="_blank" aria-label="Saubhagya Jewellery on Instagram">Instagram</a>' +
      '<a href="' + FB + '" rel="noopener" target="_blank" aria-label="Saubhagya Jewellery on Facebook">Facebook</a>' +
      '<a href="' + WHATSAPP + '" rel="noopener" target="_blank" aria-label="WhatsApp Saubhagya Jewellery">WhatsApp</a>' +
      '<a href="' + MAPS + '" rel="noopener" target="_blank" aria-label="Saubhagya Jewellery on Google Maps">Google Maps</a>' +
      '</div>';
    return '<div class="fwrap">' +
      '<div class="fbrand">' +
      '<img class="brand-logo brand-logo-footer" src="images/brand/saubhagya-logo.svg?v=4" alt="Saubhagya Jewellery">' +
      '<p>Handcrafted premium imitation jewellery from our Mumbai warehouse. Every piece is manufactured in-house, inspected and dispatched insured across India.</p>' +
      social + '</div>' +
      col('COMPANY', company) + col('POLICY', policy) +
      '<details class="fcol fcol-support"><summary class="fhead">SELLER &amp; SUPPORT</summary>' +
      '<p class="fatelier"><strong>Saubhagya Jewellery</strong><br>Tanaji Nagar Rd, opp Vishwakarma Mandir<br>Hanuman Nagar, Kandivali East<br>Mumbai 400101, Maharashtra, India<br>Care: +91 99870 08435<br>care@saubhagyajewellery.com<br><br>Grievance Officer: see <a href="grievances.html" style="color:#C5A059">Grievances</a><br>Ack. 48 hrs · Resolve within 30 days</p>' +
      '<a class="fwa" href="' + WHATSAPP + '" rel="noopener" target="_blank">WhatsApp Support &rarr;</a>' +
      '<a class="fwa" href="' + MAPS + '" rel="noopener" target="_blank" style="margin-top:8px;display:inline-block">Get Directions (Google Maps) &rarr;</a>' +
      '</details></div>' +
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
      var drawBack = this.querySelector('#nav-drawer-backdrop');
      if (burger && drawer) {
        var toggle = function (open) {
          burger.classList.toggle('open', open);
          drawer.classList.toggle('open', open);
          if (drawBack) drawBack.classList.toggle('on', open);
          burger.setAttribute('aria-expanded', open ? 'true' : 'false');
          document.body.style.overflow = open ? 'hidden' : '';
        };
        burger.addEventListener('click', function () { toggle(!drawer.classList.contains('open')); });
        drawer.addEventListener('click', function (e) { if (e.target.closest('a')) toggle(false); });
        drawBack && drawBack.addEventListener('click', function () { toggle(false); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) toggle(false); });
        window.addEventListener('resize', function () { if (innerWidth > 900) toggle(false); });
      }
      /* header search sheet + typeahead */
      var sBtn = this.querySelector('#nav-search-btn');
      var sSheet = this.querySelector('#nav-search-sheet');
      var sBack = this.querySelector('#nav-search-backdrop');
      var sIn = this.querySelector('#nav-search-input');
      var sClose = this.querySelector('#nav-search-close');
      var sForm = this.querySelector('#nav-search-form');
      var sHits = this.querySelector('#nav-search-hits');
      if (sBtn && sSheet && sForm) {
        var activeIdx = -1;
        var openSheet = function () {
          sSheet.classList.add('on');
          if (sBack) sBack.classList.add('on');
          setTimeout(function () { sIn && sIn.focus(); }, 120);
        };
        var closeSheet = function () {
          sSheet.classList.remove('on');
          if (sBack) sBack.classList.remove('on');
          if (sHits) { sHits.classList.remove('on'); sHits.innerHTML = ''; }
          if (sIn) sIn.value = '';
          activeIdx = -1;
        };
        sBtn.addEventListener('click', openSheet);
        sClose && sClose.addEventListener('click', closeSheet);
        sBack && sBack.addEventListener('click', closeSheet);

        function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

        function renderHits(q) {
          var cat = window.CHAUHAN_CATALOG || [];
          if (!cat.length || !q) { sHits.classList.remove('on'); sHits.innerHTML = ''; return; }
          var lc = q.toLowerCase();
          var hits = cat.filter(function (p) {
            if (p.inStock === 0 || p.inStock === false) return false;
            var hay = ((p.name || '') + ' ' + (p.category || '') + ' ' + (p.regionLabel || '')).toLowerCase();
            return hay.indexOf(lc) !== -1;
          }).slice(0, 6);
          if (!hits.length) {
            sHits.innerHTML = '<div class="nav-search-empty">No pieces match "' + esc(q) + '". Hit Search for full results.</div>';
            sHits.classList.add('on');
            return;
          }
          var rows = hits.map(function (p, i) {
            return '<a class="nav-search-hit" role="option" data-idx="' + i + '" href="product?sku=' + encodeURIComponent(p.sku || p.id) + '">' +
              '<div class="nav-search-hit-img" style="background-image:url(\'' + esc(p.image || '') + '\')"></div>' +
              '<div class="nav-search-hit-meta">' +
                '<div class="nav-search-hit-name">' + esc(p.name) + '</div>' +
                '<div class="nav-search-hit-cat">' + esc(p.category || '') + '</div>' +
              '</div>' +
              '<div class="nav-search-hit-price">' + fmt(p.price) + '</div>' +
            '</a>';
          }).join('') +
            '<a class="nav-search-more" href="categories.html?q=' + encodeURIComponent(q) + '">SEE ALL RESULTS &rarr;</a>';
          sHits.innerHTML = rows;
          sHits.classList.add('on');
          activeIdx = -1;
        }

        var debounce = null;
        sIn.addEventListener('input', function () {
          clearTimeout(debounce);
          var v = (sIn.value || '').trim();
          debounce = setTimeout(function () { renderHits(v); }, 140);
        });

        sIn.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { closeSheet(); return; }
          if (!sHits.classList.contains('on')) return;
          var items = sHits.querySelectorAll('.nav-search-hit');
          if (!items.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % items.length;
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = (activeIdx - 1 + items.length) % items.length;
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            items[activeIdx].click();
            return;
          } else { return; }
          for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', i === activeIdx);
        });

        sForm.addEventListener('submit', function (e) {
          var q = (sIn.value || '').trim();
          if (!q) { e.preventDefault(); sIn.focus(); return; }
        });
      }
    }
  });

  customElements.define('x-footer', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<footer class="site">' + footerHtml() + '</footer>';
      this.style.display = 'block';
      /* Desktop: force footer <details> open. Mobile: leave collapsed. */
      var syncFooterDetails = function () {
        var isDesktop = window.innerWidth > 560;
        var all = document.querySelectorAll('footer.site details.fcol');
        for (var i = 0; i < all.length; i++) {
          if (isDesktop) all[i].setAttribute('open', '');
          else all[i].removeAttribute('open');
        }
      };
      syncFooterDetails();
      window.addEventListener('resize', syncFooterDetails);
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
