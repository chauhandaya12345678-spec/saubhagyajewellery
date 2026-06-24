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
      { image: 'images/banners/Website_hero_banner_concept_art._202606221611.jpeg', tone: 'charcoal',  kicker: 'CHAUHAN\'S & CO',  title: 'Designer Earrings Collection' },
      { image: 'images/banners/Website_hero_image_for_Chauhan_202606221620.jpeg', tone: 'emerald',   kicker: 'CHAUHAN\'S & CO',  title: 'Where Tradition Meets Design' },
      { image: 'images/banners/gold necklacer._A_202606221636.jpeg',  tone: 'maroon',    kicker: 'CHAUHAN\'S & CO',  title: 'Gold Necklace Edit' }
    ];
    window.CHAUHAN_SETTINGS = {
      shippingNote: '',
      payments: ['UPI', 'Cards', 'Net Banking', 'Cash on Delivery', 'No-Cost EMI']
    };
    window.dispatchEvent(new CustomEvent('catalog-ready'));
  }

  // Block products from the catalog by exact SKU or exact name. Used to remove
  // items the owner does not want sold. Edit this list to hide more.
  var BLOCKED_SKUS = ['CC-NB-002'];
  var BLOCKED_NAMES = ['Regal Lakshmi Haaram', 'Regal Bridal Set', 'Antique Rani Haar'];

  function isBlocked(p) {
    if (BLOCKED_SKUS.indexOf(p.sku) !== -1) return true;
    if (BLOCKED_NAMES.indexOf(p.name) !== -1) return true;
    return false;
  }

  function applyOverrides(base, ov) {
    // products.json may be a flat map { 'CC-SI-001': {...}, ... } OR
    // wrapped as { products: { 'CC-SI-001': {...} }, _README: '...' }.
    var src = (!ov || typeof ov !== 'object') ? base : base.map(function (p) {
      var map = ov.products && typeof ov.products === 'object' ? ov.products : ov;
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
    return src.filter(function (p) { return !isBlocked(p); });
  }

  var base = buildBase();

  // Publish base immediately so home page never renders blank if products.json fetch is slow.
  // Re-publish later once overrides arrive — components re-listen on the catalog-ready event.
  publish(base.filter(function (p) { return !isBlocked(p); }));

  var url = 'products.json?t=' + Date.now();
  if (typeof fetch === 'function') {
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ov) { if (ov) publish(applyOverrides(base, ov)); })
      .catch(function () { /* base already published */ });
  }
})();
