// ============================================================
//  CHAUHAN'S & CO - PRODUCT CATALOG
//  ------------------------------------------------------------
//  This file generates the base catalog (150 SKUs across the
//  three regions). To CHANGE A PRICE or ASSIGN AN IMAGE without
//  redeploying or touching this file, edit  products.json
//  instead - it is loaded at runtime and merged on top of every
//  product. See products.json for the format.
//
//  After editing products.json, just reload the website.
//  For the static SEO pages (south-indian-traditional.html etc),
//  also double-click rebuild.bat once so they pick up the
//  changes too.
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
  var ADJ = ['Royal', 'Heritage', 'Regal', 'Antique', 'Imperial', 'Maharani', 'Grand', 'Celestial',
             'Noble', 'Vintage', 'Lotus', 'Peacock', 'Divine', 'Padmini', 'Aurelia', 'Mughal'];
  var PREFIX = { south: 'SI', modern: 'MM', bridal: 'NB' };

  function rng(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }

  function buildBase() {
    var all = [];
    Object.keys(REGIONS).forEach(function (reg, ri) {
      var R = REGIONS[reg];
      for (var i = 1; i <= 50; i++) {
        var seed = ri * 1000 + i;
        var cat = R.cats[Math.floor(rng(seed) * R.cats.length)];
        var adj = ADJ[Math.floor(rng(seed * 1.7) * ADJ.length)];
        var price = Math.round((1200 + rng(seed * 2.3) * 8800) / 50) * 50;
        var mrp = Math.round(price * (1.18 + rng(seed * 3.1) * 0.24) / 50) * 50;
        var sku = 'CC-' + PREFIX[reg] + '-' + String(i).padStart(3, '0');
        var city = R.cities[Math.floor(rng(seed * 4.2) * R.cities.length)];
        var badges = ['', '', '', '', 'BESTSELLER', 'NEW', 'TRENDING'];
        var badge = badges[Math.floor(rng(seed * 5.5) * badges.length)];
        all.push({
          id: sku, sku: sku, name: adj + ' ' + cat,
          region: reg, regionLabel: R.label, category: cat,
          price: price, mrp: mrp, city: city, badge: badge,
          image: null, altImage: null
        });
      }
    });
    return all;
  }

  function publish(catalog) {
    window.CHAUHAN_CATALOG = catalog;
    window.CHAUHAN_HERO = [
      { image: 'images/necklace/necklace-05.webp', tone: 'emerald',  kicker: 'SOUTH INDIAN',  title: 'Temple & Antique Gold' },
      { image: 'images/choker/202606051335.webp',  tone: 'maroon',   kicker: 'NORTH INDIAN',  title: 'Kundan & Polki Bridal' },
      { image: 'images/pendant/pendant-05.webp',   tone: 'charcoal', kicker: 'MUMBAI MODERN', title: 'American Diamond Edit' }
    ];
    window.CHAUHAN_SETTINGS = {
      shippingNote: 'FREE INSURED SHIPPING ACROSS INDIA · GST INCLUDED ON EVERY ORDER',
      payments: ['UPI', 'Cards', 'Net Banking', 'Cash on Delivery', 'No-Cost EMI']
    };
    window.dispatchEvent(new CustomEvent('catalog-ready'));
  }

  function applyOverrides(base, ov) {
    // products.json may be a flat map { 'CC-SI-001': {...}, ... } OR
    // wrapped as { products: { 'CC-SI-001': {...} }, _README: '...' }.
    if (!ov || typeof ov !== 'object') return base;
    var map = ov.products && typeof ov.products === 'object' ? ov.products : ov;
    return base.map(function (p) {
      var o = map[p.sku];
      if (!o || typeof o !== 'object') return p;
      var merged = Object.assign({}, p);
      if (o.name) merged.name = o.name;
      if (typeof o.price === 'number') merged.price = o.price;
      if (typeof o.mrp === 'number') merged.mrp = o.mrp;
      if (o.image) merged.image = o.image;
      if (o.altImage) merged.altImage = o.altImage;
      if (o.badge !== undefined) merged.badge = o.badge;
      return merged;
    });
  }

  var base = buildBase();

  // Try to load runtime overrides (products.json). Cache-busting via timestamp
  // so newly-edited files show up on the next reload without manual cache clears.
  var url = 'products.json?t=' + Date.now();
  if (typeof fetch === 'function') {
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ov) { publish(applyOverrides(base, ov)); })
      .catch(function () { publish(base); });
  } else {
    publish(base);
  }
})();
