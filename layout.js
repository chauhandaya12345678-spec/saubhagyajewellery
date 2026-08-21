/* ============================================================
 * SAUBHAGYA – shared layout components
 * ONE source of truth for the header + footer of every static
 * page. Change here + in build/site.js.
 * ============================================================ */
(function () {
  'use strict';

  var APP = '/';
  var SIGNIN = 'signin.html';
  var CART = 'cart.html';
  var WHATSAPP = 'https://wa.me/919987008435';

  /* Head extras every page gets: favicon, theme color, brand/fx styles */
  (function injectHead() {
    var d = document;
    if (!d.querySelector('link[rel="icon"]')) {
      var fav = d.createElement('link');
      fav.rel = 'icon'; fav.type = 'image/png'; fav.href = 'images/brand/favicon-mark.png?v=1';
      d.head.appendChild(fav);
    }
    /* Google Analytics (gtag.js) - was homepage-only before; every page needs
       it or product/category/checkout views never reach GA at all. */
    if (!window.__gtagLoaded) {
      window.__gtagLoaded = true;
      var gtagScript = d.createElement('script');
      gtagScript.async = true;
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-MQQ74M9SPR';
      d.head.appendChild(gtagScript);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', 'G-MQQ74M9SPR');
    }
    if (!d.querySelector('meta[name="theme-color"]')) {
      var tc = d.createElement('meta');
      tc.name = 'theme-color'; tc.content = '#0B291C';
      d.head.appendChild(tc);
    }
    var s = d.createElement('style');
    s.textContent = [
      /* ── professional 3-zone header (overrides site.css) ────────── */
      'header.site{position:fixed;top:0;left:0;width:100%;z-index:1000;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(90,136,0,.20)}',
      'body{padding-top:118px}',
      '@media(max-width:900px){body{padding-top:70px}}',
      '.nav{display:flex;align-items:center;gap:24px;max-width:1440px;margin:0 auto;padding:14px 40px}',
      '.logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none;order:0}',
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '.brand-logo{height:44px;width:auto;object-fit:contain;display:block;background:none}',
      '@media(max-width:480px){.brand-logo{height:40px}}',
      '@media(max-width:480px){body{padding-top:82px}}',
      '.logo-stack{display:flex;flex-direction:column;align-items:flex-start;line-height:1}',
      '.logo-name{font-family:"Cormorant Garamond",serif;font-size:25px;font-weight:600;color:#0B291C;letter-spacing:1.5px;line-height:1}',
      '.logo-sub{font-size:9px;letter-spacing:4.5px;color:#C5A880;margin-top:4px}',
      '.navlinks{order:1;flex:1;display:flex;justify-content:center;gap:24px;flex-wrap:nowrap;font-size:12px;letter-spacing:.6px;margin:0}',
      '.navlink{padding-bottom:3px;border-bottom:1px solid transparent;white-space:nowrap;color:#1A1A1A;text-decoration:none;transition:border-color .3s,color .3s}',
      '.navlink:hover,.navlink.is-active{border-bottom-color:#C5A880;color:#0B291C}',
      '.nav-icons{order:2;flex:none;display:flex;align-items:center;gap:18px;font-size:13px;letter-spacing:1px}',
      '.nav-icons a,.nav-icons button{color:#1A1A1A;text-decoration:none;white-space:nowrap;transition:color .3s;background:none;border:none;padding:0;font:inherit;letter-spacing:inherit;cursor:pointer}',
      '.nav-icons a:hover,.nav-icons button:hover{color:#0B291C}',
      '#nav-search-btn{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;flex:none}',
      '.nav-search-icon{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none}',
      '.nav-profile-btn{display:none;align-items:center;justify-content:center;width:34px;height:34px;color:#1A1A1A}',
      '.nav-profile-icon{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none}',
      '.nav-bag{position:relative;display:inline-flex;align-items:center;color:#1A1A1A;text-decoration:none;padding:2px}',
      '.nav-bag-icon{width:26px;height:26px;stroke:currentColor;stroke-width:1.6;fill:none;flex:none}',
      /* badge hangs off the bag\'s top-right corner (half on, half off) instead of floating beside it as a bare number */
      '.nav-bag [data-mpa-cart-count]{position:absolute;top:-4px;right:-6px;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#0B291C;color:#fff;font-size:10px;font-weight:700;line-height:1;box-shadow:0 0 0 2px #fff}',
      '.nav-bag [data-mpa-cart-count]:not([style*="none"]){display:inline-flex}',
      '.nav-bag{flex:none}',
      /* Desktop: invisible grouping wrapper, search/"Hi, Name"/"Sign out" lay out exactly as before. */
      '.nav-account{display:contents}',
      /* "›" signals the greeting is a link to the profile, not just a label. */
      '.nav-hi::after,.nav-hi-mobile::after,.nav-signin-mobile::after{content:"›";margin-left:3px;color:#C5A880;font-size:15px;font-weight:700}',
      /* Mobile-only versions - desktop keeps using "Hi, Name"/"Sign in" on .nav-hi.
         Mobile needs its own copies (not just CSS-hiding .nav-hi) because a
         signed-in user must show "Hi, Name", never the icon, never "Sign in". */
      '.nav-signin-mobile{display:none}',
      '.nav-hi-mobile{display:none}',
      '.nav-burger{order:0;display:none;flex-direction:column;justify-content:center;gap:5px;width:34px;height:34px;padding:0;background:none;border:none;cursor:pointer}',
      '.nav-burger span{display:block;height:2px;width:22px;background:#0B291C;border-radius:2px;transition:transform .35s,opacity .25s}',
      '.nav-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
      '.nav-burger.open span:nth-child(2){opacity:0}',
      '.nav-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',
      /* slide-down drawer */
      /* CRITICAL: when closed, this box must paint NOTHING. max-height:0 does
         NOT clip padding, border or box-shadow - a collapsed drawer with
         padding-bottom (safe-area inset) + white bg + shadow rendered as a
         big white bar pinned under the header on every scroll. So padding,
         border and shadow are ALL moved to .open, and visibility:hidden makes
         it bulletproof. */
      '.nav-drawer{display:none;flex-direction:column;background:#fff;overflow:hidden;max-height:0;padding:0;border:0;box-shadow:none;visibility:hidden;transition:max-height .45s cubic-bezier(.25,1,.5,1),visibility 0s linear .45s;position:fixed;top:70px;left:0;right:0;z-index:70;isolation:isolate}',
      '.nav-drawer.open{visibility:visible;max-height:calc(100vh - 70px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom);border-bottom:1px solid rgba(90,136,0,.2);box-shadow:0 12px 30px rgba(11,41,28,.12);transition:max-height .45s cubic-bezier(.25,1,.5,1),visibility 0s}',
      '.nav-drawer a{padding:17px 22px;font:500 14px "Montserrat",sans-serif;letter-spacing:.6px;color:#1A1A1A;text-decoration:none;border-top:1px solid #f0ece1;transition:background .2s,color .2s;display:flex;align-items:center;justify-content:space-between}',
      '.nav-drawer a::after{content:"›";color:#C5A880;font-size:20px;opacity:.6;transition:transform .25s}',
      '.nav-drawer a:hover,.nav-drawer a:active{background:#faf8f3;color:#0B291C}',
      '.nav-drawer a:hover::after,.nav-drawer a:active::after{transform:translateX(4px);opacity:1}',
      '.nav-drawer a.is-active{color:#0B291C;background:#faf8f3}',
      '.nav-drawer a:first-child{border-top:none}',
      '.nav-drawer-backdrop{position:fixed;inset:0;top:64px;background:rgba(11,41,28,.4);z-index:59;opacity:0;pointer-events:none;transition:opacity .35s}',
      '.nav-drawer-backdrop.on{opacity:1;pointer-events:auto}',
      /* header search sheet */
      '.nav-search-sheet{position:fixed;top:0;left:0;right:0;background:#fff;padding:18px 20px 22px;box-shadow:0 12px 40px rgba(11,41,28,.14);transform:translateY(-100%);transition:transform .45s cubic-bezier(.25,1,.5,1);z-index:80;padding-top:calc(18px + env(safe-area-inset-top))}',
      '.nav-search-sheet.on{transform:translateY(0)}',
      '.nav-search-wrap{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:10px}',
      '.nav-search-form{flex:1;display:flex;align-items:center;gap:8px;border:1px solid #d4cec0;border-radius:8px;background:#fff;padding:0 6px 0 14px;transition:border-color .25s,box-shadow .25s}',
      '.nav-search-form:focus-within{border-color:#C5A880;box-shadow:0 0 0 3px rgba(90,136,0,.15)}',
      '.nav-search-icon-l{width:18px;height:18px;stroke:#3a3a3a;stroke-width:2;fill:none;flex:none}',
      '.nav-search-input{flex:1;min-width:0;height:46px;border:none;background:transparent;font:400 15px "Montserrat",sans-serif;outline:none;color:#1A1A1A}',
      '.nav-search-input::-webkit-search-cancel-button{-webkit-appearance:none}',
      '.nav-search-go{height:38px;padding:0 18px;background:#0B291C;color:#fff;border:none;border-radius:6px;font:600 11px "Montserrat",sans-serif;letter-spacing:1.5px;cursor:pointer;flex:none}',
      '.nav-search-go:hover{background:#071B12}',
      '.nav-search-close{background:none;border:none;font-size:26px;color:#2b2b2b;cursor:pointer;padding:4px 10px;line-height:1;flex:none}',
      '.nav-search-close:hover{color:#0B291C}',
      '.nav-search-hits{max-width:720px;margin:12px auto 0;background:#fff;border:1px solid #eee5d6;border-radius:10px;overflow:hidden;max-height:min(60vh,420px);overflow-y:auto;display:none;-webkit-overflow-scrolling:touch}',
      '.nav-search-hits.on{display:block;animation:nshFade .25s ease}',
      '@keyframes nshFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',
      '.nav-search-hit{display:flex;align-items:center;gap:12px;padding:10px 12px;text-decoration:none;color:#1A1A1A;border-bottom:1px solid #f5f0e2;transition:background .2s}',
      '.nav-search-hit:hover,.nav-search-hit.active{background:#faf8f3}',
      '.nav-search-hit:last-child{border-bottom:none}',
      '.nav-search-hit-img{width:48px;height:60px;flex:none;border-radius:6px;background-size:cover;background-position:center;background-color:#f0ede5}',
      '.nav-search-hit-meta{flex:1;min-width:0}',
      '.nav-search-hit-name{font-family:"Playfair Display",serif;font-size:15px;color:#1A1A1A;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nav-search-hit-cat{font-family:"Montserrat",sans-serif;font-size:13px;color:#3a3a3a;margin-top:2px;letter-spacing:.4px}',
      '.nav-search-hit-price{font-family:"Montserrat",sans-serif;font-size:13px;font-weight:500;color:#0B291C;flex:none}',
      '.nav-search-more{display:block;padding:12px;text-align:center;font-family:"Montserrat",sans-serif;font-size:13px;letter-spacing:1.5px;color:#0B291C;background:#faf8f3;text-decoration:none;border-top:1px solid #eee5d6}',
      '.nav-search-empty{padding:22px 16px;text-align:center;font-family:"Montserrat",sans-serif;font-size:12px;color:#3a3a3a}',
      '.nav-search-backdrop{position:fixed;inset:0;background:rgba(11,41,28,.4);z-index:79;opacity:0;pointer-events:none;transition:opacity .3s}',
      '.nav-search-backdrop.on{opacity:1;pointer-events:auto}',
      /* mobile layout */
      '@media(max-width:900px){',
      '  .nav{flex-direction:row;flex-wrap:nowrap;align-items:center;padding:10px 24px 10px 10px;gap:6px}',
      '  .navlinks,.nav-icons{flex:none}',
      '  .nav-burger{display:flex}',
      '  .logo{order:1;flex:1 1 auto;min-width:0;justify-content:flex-start;margin-right:auto;margin-left:-4px}',
      '  .logo{gap:7px}',
      '  .logo-name{font-size:19px;letter-spacing:.4px}',
      '  .logo-sub{font-size:8px;letter-spacing:3px;margin-top:3px}',
      /* Ellipsis safety net for extreme cases, but the cap is generous now -
         the icon row is 3 plain small icons, not the wider pill buttons this
         was originally sized against, so "SAUBHAGYA" was clipping for no reason. */
      '  .logo-stack{min-width:0;max-width:190px;overflow:hidden}',
      '  .logo-name,.logo-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '  .navlinks{display:none}',
      '  .nav-icons{order:2;gap:6px;min-width:0}',
      '  .nav-icons .ni-hide{display:inline-flex;font-size:12px;letter-spacing:.3px;font-weight:700}',
      /* Sign out lives on account.html + the drawer only now, not the header.
         Plain icons on mobile, same minimal style as the bag - no borders,
         no pills. "Hi, Name" text (desktop) swaps for a plain "Sign in" link
         (guests) or the profile icon (signed in) on mobile - never both, so
         it's still obvious whether you're signed in. Search sits first. */
      '  .nav-account{display:flex;flex-direction:row;align-items:center;gap:10px;min-width:0}',
      '  .nav-account .nav-hi{display:none}',
      /* Search moves out of the header into a floating button (below, near the
         bag corner) - a long name was squeezing both the logo and the search
         icon out of a too-narrow row. This alone frees most of the width back. */
      /* Mobile shows a fixed-width "My Profile" instead of "Hi, <Name>": a long
         name is unbounded and was pushing the logo out. This label never grows. */
      '  .nav-account .nav-signin-mobile{display:inline-flex;order:1;font-family:"Montserrat",sans-serif;font-size:12px;font-weight:400;letter-spacing:.2px;color:#1A1A1A;white-space:nowrap}',
      '  .nav-account .nav-hi-mobile{display:inline-block;order:1;font-family:"Montserrat",sans-serif;font-size:12px;font-weight:400;letter-spacing:.2px;color:#1A1A1A;white-space:nowrap;vertical-align:middle}',
      '  .nav-hi-mobile::after{font-size:12px}',
      /* Search back inline, sitting BETWEEN the name and the bag. All three
         header controls share one 22px icon size so nothing looks oversized. */
      '  #nav-search-btn{order:2;position:static;width:26px;height:26px;background:none;border:none;border-radius:0;box-shadow:none}',
      '  #nav-search-btn .nav-search-icon{width:22px;height:22px;stroke:#1A1A1A;stroke-width:1.6}',
      '  .nav-account .nav-profile-btn{width:26px;height:26px}',
      '  .nav-account .nav-profile-icon{width:22px;height:22px;stroke-width:1.6}',
      '  .nav-bag{display:inline-flex;align-items:center;height:26px;padding:9px 10px}',
      '  .nav-bag-icon{width:22px;height:22px;stroke-width:1.6}',
      '  .nav-bag [data-mpa-cart-count]{top:-6px;right:-7px;min-width:15px;height:15px;font-size:9px}',
      '  .nav-drawer{display:flex;top:70px}',
      '  .nav-drawer.open{max-height:calc(100vh - 70px)}',
      '  .nav-drawer-backdrop{top:70px}',
      '  .nav-search-sheet{padding:14px 14px 18px}',
      '  .nav-search-wrap{gap:6px}',
      '  .nav-search-go{padding:0 12px;font-size:10px}',
      '  .nav-search-close{width:34px;height:34px;flex:0 0 34px;display:inline-flex;align-items:center;justify-content:center;padding:0}',
      '}',
      '@media(max-width:480px){',
      '  .logo-name{font-size:18px;letter-spacing:.3px}',
      '  .logo-sub{font-size:8px;letter-spacing:2.8px;margin-top:4px}',
      '  .nav-drawer{top:82px}',
      '  .nav-drawer.open{max-height:calc(100vh - 82px)}',
      '  .nav-drawer-backdrop{top:82px}',
      '}',
      /* ── Breadcrumbs ───────────────────────────────────────────────────
         Plain "Home / Categories / Name" text reads like a file path. This
         turns every trail on the site into raised chips with gold chevrons.
         Markup is normalised by normalizeCrumbs() below, so pages keep their
         existing <a>/<i>/<span> HTML and still get the new look. */
      '.crumb{max-width:1440px;margin:0 auto;padding:16px 40px 0}',
      '.crumb-trail{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0;padding:0;list-style:none}',
      '.crumb-trail li{display:flex;align-items:center;min-width:0}',
      /* chevron between items - drawn, never a literal "/" character */
      '.crumb-trail li+li::before{content:"";flex:none;width:6px;height:6px;margin:0 7px;' +
        'border-right:1.6px solid #C5A880;border-bottom:1.6px solid #C5A880;transform:rotate(-45deg);opacity:.85}',
      '.crumb-trail a,.crumb-trail span{display:inline-block;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'font-family:"Montserrat",sans-serif;font-size:12px;letter-spacing:.4px;line-height:1;text-decoration:none}',
      '.crumb-trail a{padding:7px 13px;border-radius:20px;color:#0B291C;background:linear-gradient(160deg,#ffffff,#f6f2e9);' +
        'border:1px solid rgba(197,168,128,.55);box-shadow:0 2px 5px rgba(11,41,28,.10),inset 0 1px 0 rgba(255,255,255,.9);' +
        'transition:transform .28s cubic-bezier(.25,1,.5,1),box-shadow .28s,background .28s}',
      '.crumb-trail a:hover{transform:translateY(-2px);background:linear-gradient(160deg,#ffffff,#fbf7ee);' +
        'box-shadow:0 6px 14px rgba(11,41,28,.18),inset 0 1px 0 rgba(255,255,255,.95);border-color:#C5A880}',
      '.crumb-trail a:active{transform:translateY(0);box-shadow:0 2px 5px rgba(11,41,28,.14)}',
      /* current page: deep green, clearly the end of the trail */
      '.crumb-trail li[aria-current="page"] span{padding:7px 14px;border-radius:20px;color:#fff;font-weight:600;' +
        'background:linear-gradient(160deg,#134a34,#0B291C);box-shadow:0 3px 10px rgba(11,41,28,.28),inset 0 1px 0 rgba(255,255,255,.12)}',
      '.crumb-home-ic{width:11px;height:11px;margin-right:6px;vertical-align:-1px;stroke:currentColor;stroke-width:1.9;fill:none}',
      '@media(max-width:760px){',
      '  .crumb{padding-top:12px}',
      '  .crumb-trail a,.crumb-trail span{font-size:11px;max-width:42vw}',
      '  .crumb-trail a{padding:6px 11px}',
      '  .crumb-trail li[aria-current="page"] span{padding:6px 12px}',
      '  .crumb-trail li+li::before{margin:0 5px;width:5px;height:5px}',
      '}',
      /* footer: same brand SVG as header, sized down for the column,
         and a light brightness bump so the gold pops on deep green */
      'footer.site .fbrand{display:flex;flex-direction:column;align-items:flex-start;gap:14px}',
      /* Footer now uses the SAME clean lotus mark as the header (green-safe,
         transparent) + wordmark text, instead of a separate white wordmark image. */
      'footer.site .flogo{display:inline-flex;align-items:center;gap:12px;text-decoration:none}',
      'footer.site .flogo-mark{height:52px;width:auto;object-fit:contain;display:block}',
      'footer.site .flogo-stack{display:flex;flex-direction:column;align-items:flex-start;line-height:1}',
      'footer.site .flogo-name{font-family:"Cormorant Garamond",serif;font-size:30px;font-weight:600;color:#fff;letter-spacing:2px;line-height:1}',
      'footer.site .flogo-sub{font-size:11px;letter-spacing:6px;color:#C5A880;margin-top:6px}',
      'footer.site .flogo-tm{font-size:11px;letter-spacing:0;color:#C5A880;vertical-align:super;margin-left:2px;font-family:"Montserrat",sans-serif}',
      '@media(max-width:560px){footer.site .fbrand{align-items:center;text-align:center}footer.site .flogo{justify-content:center}footer.site .fsocial{justify-content:center}}',
      'footer.site .fsocial{display:flex;flex-wrap:wrap;gap:14px;margin-top:4px}',
      'footer.site .fsocial a{font:500 12px "Montserrat",sans-serif;letter-spacing:.5px;color:#C5A880;text-decoration:none;border-bottom:1px solid rgba(90,136,0,.35);padding-bottom:2px;transition:color .3s,border-color .3s}',
      'footer.site .fsocial a:hover{color:#fff;border-bottom-color:#fff}',
      /* cookie consent banner */
      '.ck-banner{position:fixed;left:16px;right:16px;bottom:16px;background:#fff;border:1px solid #C5A880;border-radius:8px;box-shadow:0 12px 40px rgba(11,41,28,.18);padding:18px 22px;z-index:120;display:none;font-family:"Montserrat",sans-serif;font-size:12.5px;line-height:1.55;color:#3a3a3a;max-width:640px;margin:0 auto}',
      '.ck-banner.on{display:block;animation:ckSlide .5s cubic-bezier(.25,1,.5,1) both}',
      '@keyframes ckSlide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '.ck-banner p{margin:0 0 12px}',
      '.ck-banner a{color:#0B291C;text-decoration:underline}',
      '.ck-btns{display:flex;gap:10px;flex-wrap:wrap}',
      '.ck-btn{border:none;padding:10px 18px;font:600 11px "Montserrat",sans-serif;letter-spacing:1.5px;cursor:pointer;border-radius:4px}',
      '.ck-btn.primary{background:#0B291C;color:#fff}',
      '.ck-btn.ghost{background:transparent;color:#0B291C;border:1px solid #C5A880}',
      /* Apple-TV 3D tilt */
      '.fx-tilt{transform-style:preserve-3d;will-change:transform;transition:transform .45s cubic-bezier(.25,1,.5,1),box-shadow .45s cubic-bezier(.25,1,.5,1)}',
      '.fx-tilt.fx-active{transition:transform .06s linear,box-shadow .3s;box-shadow:0 24px 50px -18px rgba(11,41,28,.45),0 8px 20px -10px rgba(0,0,0,.3)}'
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
      '<a class="navlink" data-mpa-onlyauth href="account.html" style="display:none">My Profile</a>' +
      '<a class="navlink nav-signout" data-mpa-signout href="#" style="display:none">Sign out</a>';
    var searchIcon =
      '<svg class="nav-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>';
    var profileIcon =
      '<svg class="nav-profile-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c0-3.9 3.4-6.2 7-6.2s7 2.3 7 6.2" stroke-linecap="round"/></svg>';
    var bagIcon =
      '<svg class="nav-bag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8h11l.9 12.2a1 1 0 0 1-1 1.1H6.6a1 1 0 0 1-1-1.1L6.5 8z"/><path d="M9 10.5V6.7a3 3 0 0 1 6 0v3.8" stroke-linecap="round"/></svg>';
    return '<header class="site">' +
      '<div class="nav">' +
      '<button class="nav-burger" id="nav-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '<a class="logo logo-real" href="index.html" title="Saubhagya Jewellery - Home">' +
      '<img class="brand-logo" src="images/brand/logo-mark-clean.webp?v=4" alt="" width="347" height="257">' +
      '<span class="logo-stack"><span class="logo-name">SAUBHAGYA</span><span class="logo-sub">JEWELLERY</span></span>' +
      '<span class="sr-only">Saubhagya Jewellery - handcrafted imitation jewellery, Mumbai. Home.</span>' +
      '</a>' +
      '<nav class="navlinks">' + links + '</nav>' +
      '<div class="nav-icons">' +
      '<div class="nav-account">' +
      '<a class="ni-hide nav-hi" data-mpa-auth data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '" title="View profile">Sign in</a>' +
      '<a class="nav-signin-mobile" data-mpa-onlyguest href="' + SIGNIN + '">Sign in</a>' +
      /* No data-mpa-auth here on purpose: that would overwrite the label with
         "Hi, <Name>", whose width is unbounded and pushed the logo off-screen.
         Fixed "My Profile" label instead; only visibility is auth-driven. */
      '<a class="nav-hi-mobile" data-mpa-onlyauth href="account.html" title="View your profile">My Profile</a>' +
      '<button type="button" id="nav-search-btn" aria-label="Search">' + searchIcon + '</button>' +
      '<a class="nav-profile-btn" data-mpa-auth data-mpa-auth-icon data-mpa-signin-href="' + SIGNIN + '" data-mpa-account-href="account.html" href="' + SIGNIN + '" aria-label="Account">' + profileIcon + '</a>' +
      '</div>' +
      '<a class="nav-bag" href="' + CART + '" aria-label="Bag">' + bagIcon + '<span data-mpa-cart-count style="display:none"></span></a>' +
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
    var company = [['About Us', 'about.html'], ['Contact Us', 'contact.html'], ['Categories', 'categories.html'], ['Gifting', 'gifting.html'], ['Blogs', 'blogs.html'], ['FAQ', 'faq.html'], ['Jewellery Care Guide', 'jewellery-guide.html']];
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
    var INSTA = 'https://www.instagram.com/saubhagyajewellery_';
    var FB = 'https://www.facebook.com/profile.php?id=61591767526538';
    var social =
      '<div class="fsocial">' +
      '<a href="' + INSTA + '" rel="noopener" target="_blank" aria-label="Saubhagya Jewellery on Instagram">Instagram</a>' +
      '<a href="' + FB + '" rel="noopener" target="_blank" aria-label="Saubhagya Jewellery on Facebook">Facebook</a>' +
      '<a href="' + WHATSAPP + '" rel="noopener" target="_blank" aria-label="WhatsApp Saubhagya Jewellery">WhatsApp</a>' +
      '</div>';
    return '<div class="fwrap">' +
      '<div class="fbrand">' +
      '<a class="flogo" href="index.html" aria-label="Saubhagya Jewellery">' +
      '<img class="flogo-mark" src="images/brand/logo-mark-clean.webp?v=4" alt="" width="347" height="257">' +
      '<span class="flogo-stack"><span class="flogo-name">SAUBHAGYA<sup class="flogo-tm">&trade;</sup></span><span class="flogo-sub">JEWELLERY</span></span>' +
      '</a>' +
      '<p>Handcrafted premium imitation jewellery from our Mumbai warehouse. Every piece is manufactured in-house, inspected and dispatched insured across India.</p>' +
      social + '</div>' +
      col('COMPANY', company) + col('POLICY', policy) +
      '<details class="fcol fcol-support"><summary class="fhead">REGISTERED OFFICE &amp; DISPATCH</summary>' +
      /* Registered office and dispatch, NOT a shop. Saubhagya is online only,
         so this must never read as an address a customer can walk into. */
      '<p class="fatelier"><strong>Saubhagya Jewellery</strong><br>Kandivali East, Mumbai 400101<br>Maharashtra, India<br><br><a href="contact.html" style="color:#C5A880">Full address &rarr;</a><br><br>GSTIN: 27BKBPC3154K1ZC<br><br>Care: +91 99870 08435<br>care@saubhagyajewellery.com<br><br>Grievance Officer: see <a href="grievances.html" style="color:#C5A880">Grievances</a><br>Ack. 48 hrs &middot; Resolve within 30 days</p>' +
      '<a class="fwa" href="' + WHATSAPP + '" rel="noopener" target="_blank">WhatsApp Support &rarr;</a>' +
      '</details></div>' +
      '<div class="fbar"><span>&copy; 2026 Saubhagya Jewellery &middot; SSL secured</span>' +
      '<span class="fpay"><i>UPI</i><i>VISA</i><i>RuPay</i><i>EMI</i></span></div>';
  }

  var hydrate = function () { if (window.MPA) window.MPA.init(); };

  /* ── Breadcrumb normaliser ────────────────────────────────────────────
     Pages write their trails three different ways (<i>/</i> separators,
     <span>/</span> separators, and the PDP builds one at runtime). Rather
     than edit every page, rebuild them all here into one structure that the
     chevron CSS above styles.

     The ORIGINAL element nodes are MOVED, never recreated - page scripts
     hold references to them (e.g. categories.html updates #crumb-here), so
     cloning would silently break those updates. */
  var CRUMB_SEPS = /^[\/›»>|→–-]+$/;
  var HOME_IC = '<svg class="crumb-home-ic" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3 11l9-7 9 7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5.5 9.6V20h13V9.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function normalizeCrumbs(root) {
    var crumbs = (root || document).querySelectorAll('.crumb');
    for (var c = 0; c < crumbs.length; c++) {
      var nav = crumbs[c];
      if (nav.querySelector('.crumb-trail')) continue;      // already done
      var kids = Array.prototype.slice.call(nav.childNodes);
      var items = [];
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3) continue;                      // bare text = separator/whitespace
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toLowerCase();
        var txt = (n.textContent || '').trim();
        if (tag === 'i') continue;                           // "<i>/</i>" separator
        if (!txt || CRUMB_SEPS.test(txt)) continue;          // "<span>/</span>" separator
        if (tag === 'a' || tag === 'span') items.push(n);
      }
      if (!items.length) continue;

      var ol = document.createElement('ol');
      ol.className = 'crumb-trail';
      for (var j = 0; j < items.length; j++) {
        var li = document.createElement('li');
        var el = items[j];
        if (j === items.length - 1 && el.tagName.toLowerCase() === 'span') {
          li.setAttribute('aria-current', 'page');
        }
        li.appendChild(el);                                   // MOVE, keeps identity
        ol.appendChild(li);
      }
      // Small house icon on the leading "Home" link - reads as a trail start.
      var first = ol.querySelector('li:first-child a');
      if (first && /^home$/i.test((first.textContent || '').trim())) {
        first.innerHTML = HOME_IC + first.textContent;
      }
      nav.innerHTML = '';
      nav.appendChild(ol);
      if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
    }
  }
  window.SJNormalizeCrumbs = normalizeCrumbs;

  /* The PDP replaces #pdp-crumb.innerHTML after its fetch resolves, which
     wipes the normalised markup - re-run whenever a .crumb's children change. */
  function watchCrumbs() {
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        var nav = t.closest ? t.closest('.crumb') : null;
        if (nav && !nav.querySelector('.crumb-trail')) { normalizeCrumbs(nav.parentNode || document); break; }
      }
    });
    var list = document.querySelectorAll('.crumb');
    for (var i = 0; i < list.length; i++) obs.observe(list[i], { childList: true });
  }

  customElements.define('x-layout', class extends HTMLElement {
    connectedCallback() {
      this.innerHTML = headerHtml(this.getAttribute('page') || '');
      this.style.display = 'block';
      hydrate();
      // Breadcrumbs live in page markup, not in this component, so run once
      // the document is parsed (and again on later DOM changes).
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { normalizeCrumbs(); watchCrumbs(); });
      } else { normalizeCrumbs(); watchCrumbs(); }
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
          var cat = window.SAUBHAGYA_CATALOG || [];
          if (!cat.length || !q) { sHits.classList.remove('on'); sHits.innerHTML = ''; return; }
          var lc = q.toLowerCase();
          var hits = cat.filter(function (p) {
            if (p.inStock === 0 || p.inStock === false) return false;
            if (p.isVariantDup) return false;
            var hay = ((p.name || '') + ' ' + (p.category || '') + ' ' + (p.regionLabel || '')).toLowerCase();
            return hay.indexOf(lc) !== -1;
          }).slice(0, 6);
          if (!hits.length) {
            sHits.innerHTML = '<div class="nav-search-empty">No pieces match "' + esc(q) + '". Hit Search for full results.</div>';
            sHits.classList.add('on');
            return;
          }
          var rows = hits.map(function (p, i) {
            return '<a class="nav-search-hit" role="option" data-idx="' + i + '" href="/product/' + encodeURIComponent(p.sku || p.id) + '">' +
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
