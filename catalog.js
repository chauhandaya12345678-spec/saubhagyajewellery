// ============================================================
//  SAUBHAGYA - PRODUCT CATALOG
//  ------------------------------------------------------------
//  Products come from D1 database via /api/products.
//  Zero-deploy architecture — update prices, stock, images
//  directly in D1, no push required.
//
//  For static SEO page regeneration, see build/site.js.
// ============================================================
(function () {
  "use strict";

  var REGIONS = {
    south: {
      label: 'South Indian Traditional',
      cities: ['Chennai', 'Madurai', 'Coimbatore', 'Bengaluru', 'Hyderabad'],
      cats: ['Temple Necklace', 'Lakshmi Haaram', 'Matte Jhumkas', 'Vanki', 'Maang Tikka', 'Kasu Mala', 'Bridal Set']
    },
    modern: {
      label: 'Mumbai Modern',
      cities: ['Mumbai', 'Pune', 'Ahmedabad', 'Surat'],
      cats: ['AD Necklace', 'Bridal Pendant', 'Solitaire Studs', 'Designer Drop', 'Pendant Set', 'Statement Choker']
    },
    bridal: {
      label: 'North Indian Bridal',
      cities: ['Delhi', 'Jaipur', 'Lucknow', 'Chandigarh', 'Amritsar'],
      cats: ['Kundan Set', 'Polki Choker', 'Rani Haar', 'Nath', 'Passa', 'Bridal Set', 'Meenakari Set']
    }
  };

  function publish(catalog) {
    // Canonical product id = sku. D1 rows carry a numeric id while the static
    // fallback JSON has none, and SEO deep links (?product=CC-SI-001) use the
    // sku — without this, links and carts break depending on data source.
    catalog = (catalog || []).map(function (p) {
      var q = {};
      for (var k in p) q[k] = p[k];
      q.id = p.sku || p.id;
      return q;
    });
    window.SAUBHAGYA_CATALOG = catalog;
    window.SAUBHAGYA_HERO = [
      { image: 'images/banners/Website_hero_banner_concept_art._202606221611.webp', tone: 'charcoal',  kicker: "SAUBHAGYA",  title: 'Earrings Collection' },
      { image: 'images/banners/Website_hero_image_for_Saubhagya_202606221620.webp', tone: 'emerald',   kicker: "SAUBHAGYA",  title: 'Where Tradition Meets Design' },
      { image: 'images/banners/gold necklacer._A_202606221636.webp',  tone: 'maroon',    kicker: "SAUBHAGYA",  title: 'Gold Necklace Edit' }
    ];
    window.SAUBHAGYA_SETTINGS = {
      shippingNote: '',
      payments: ['UPI', 'Cards', 'Net Banking', 'No-Cost EMI']
    };
    window.dispatchEvent(new CustomEvent('catalog-ready'));
  }

  // Fallback to static catalog if API fails (degraded mode)
  function loadFallback() {
    // If complete-catalog.json exists on the server, fetch it
    var url = 'build/complete-catalog.json?t=' + Date.now();
    if (typeof fetch === 'function') {
      fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (data) { if (data && data.length) publish(data); })
        .catch(function () { /* no fallback available */ });
    }
  }

  // Fetch products from D1-backed API (localhost: skip, not available)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    loadFallback(); return;
  }
  var apiUrl = '/api/products?t=' + Date.now();
  if (typeof fetch === 'function') {
    var _didLoad = false;
    var _timer = setTimeout(function () {
      if (!_didLoad) { _didLoad = true; loadFallback(); }
    }, 3000);
    fetch(apiUrl, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (_didLoad) return;
        clearTimeout(_timer); _didLoad = true;
        if (data && Array.isArray(data) && data.length) {
          publish(data);
        } else {
          loadFallback();
        }
      })
      .catch(function () {
        if (_didLoad) return;
        clearTimeout(_timer); _didLoad = true;
        loadFallback();
      });
  }
})();
