/* ============================================================
 *  Seed products.json - one-shot helper.
 *
 *  Assigns every SKU a primary image from the matching category
 *  pool. If a pool has more images than its SKUs, the leftovers
 *  are assigned as altImage (the on-hover photo) on the same
 *  pool's SKUs, cycling. Net effect: every image is used at
 *  least once, no orphans.
 *
 *  Re-running this REPLACES products.json (backs the old one up
 *  to products.json.bak first). Manual edits in products.json
 *  are NOT preserved by re-seeding - keep a copy of any you care
 *  about.
 *
 *  Run:  node build/seed-products.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'images');
const OUT_FILE = path.join(ROOT, 'products.json');

const IMG_EXT = /\.(jpe?g|webp|png|gif)$/i;
function listImages(sub) {
  const dir = path.join(IMG_DIR, sub);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => IMG_EXT.test(f)).map(f => 'images/' + sub + '/' + f);
}
const POOLS = {
  Earrings: listImages('Earrings'),
  choker:   listImages('choker'),
  necklace: listImages('necklace'),
  pendant:  listImages('pendant'),
  waist:    listImages('waist-chain')
};
const COUNTS = Object.fromEntries(Object.entries(POOLS).map(([k, v]) => [k, v.length]));
console.log('Image pools:', COUNTS);

/* Category -> primary image pool. Each piece is mapped to the pool it
   visually resembles. Necklace pool is the largest and the safest fallback. */
const CAT_TO_POOL = {
  // South
  'Temple Necklace': 'necklace', 'Lakshmi Haaram': 'necklace', 'Matte Jhumkas': 'Earrings',
  'Vanki': 'waist', 'Maang Tikka': 'Earrings', 'Kasu Mala': 'necklace', 'Bridal Set': 'necklace',
  // Modern
  'AD Necklace': 'necklace', 'Bridal Pendant': 'pendant', 'Solitaire Studs': 'Earrings',
  'Designer Drop': 'pendant', 'Pendant Set': 'pendant', 'Statement Choker': 'choker',
  // Bridal
  'Kundan Set': 'necklace', 'Polki Choker': 'choker', 'Rani Haar': 'necklace',
  'Nath': 'Earrings', 'Passa': 'Earrings', 'Meenakari Set': 'necklace'
};

/* Same deterministic catalog as catalog.js / build/site.js. */
function buildCatalog() {
  const REGIONS = {
    south:  { cats: ['Temple Necklace', 'Lakshmi Haaram', 'Matte Jhumkas', 'Vanki', 'Maang Tikka', 'Kasu Mala', 'Bridal Set'] },
    modern: { cats: ['AD Necklace', 'Bridal Pendant', 'Solitaire Studs', 'Designer Drop', 'Pendant Set', 'Statement Choker'] },
    bridal: { cats: ['Kundan Set', 'Polki Choker', 'Rani Haar', 'Nath', 'Passa', 'Bridal Set', 'Meenakari Set'] }
  };
  const PREFIX = { south: 'SI', modern: 'MM', bridal: 'NB' };
  const rng = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  const all = [];
  Object.keys(REGIONS).forEach((reg, ri) => {
    const R = REGIONS[reg];
    for (let i = 1; i <= 50; i++) {
      const seed = ri * 1000 + i;
      const cat = R.cats[Math.floor(rng(seed) * R.cats.length)];
      const sku = 'CC-' + PREFIX[reg] + '-' + String(i).padStart(3, '0');
      all.push({ sku, category: cat });
    }
  });
  return all;
}

const catalog = buildCatalog();

/* Group SKUs by pool. */
const skusByPool = { Earrings: [], choker: [], necklace: [], pendant: [], waist: [] };
catalog.forEach(p => {
  const pool = CAT_TO_POOL[p.category] || 'necklace';
  skusByPool[pool].push(p.sku);
});

const products = {};

/* Pass 1 (primary): every SKU gets one image, cycling through its pool. */
for (const pool of Object.keys(POOLS)) {
  const images = POOLS[pool];
  const skus = skusByPool[pool] || [];
  if (!images.length || !skus.length) continue;
  skus.forEach((sku, i) => {
    products[sku] = { image: images[i % images.length] };
  });
}

/* Pass 2 (altImage): assign leftover (unused) images as altImage on SKUs
   that don't have one yet. Prefer same-pool SKUs first, then fall back to
   visually-compatible pools (chain-like waist photos -> Tennis Bracelet /
   Cocktail Ring; necklace overflow -> any other gold-piece SKU). This
   guarantees every image is used at least once. */
const fallbackPools = {
  waist:    ['waist', 'pendant', 'choker'],
  necklace: ['necklace', 'choker', 'pendant'],
  choker:   ['choker', 'necklace'],
  pendant:  ['pendant', 'Earrings'],
  Earrings: ['Earrings', 'pendant']
};
const usedImages = new Set();
Object.values(products).forEach(p => { if (p.image) usedImages.add(p.image); });

for (const pool of Object.keys(POOLS)) {
  const leftovers = POOLS[pool].filter(img => !usedImages.has(img));
  if (!leftovers.length) continue;
  const order = fallbackPools[pool] || [pool];
  let cursor = 0;
  for (const img of leftovers) {
    let placed = false;
    for (const targetPool of order) {
      const targetSkus = skusByPool[targetPool] || [];
      if (!targetSkus.length) continue;
      for (let i = 0; i < targetSkus.length; i++) {
        const sku = targetSkus[(cursor + i) % targetSkus.length];
        if (!products[sku].altImage) {
          products[sku].altImage = img;
          usedImages.add(img);
          placed = true;
          cursor++;
          break;
        }
      }
      if (placed) break;
    }
  }
}

/* Verify: every image used at least once (primary or alt)? */
const used = new Set();
Object.values(products).forEach(p => {
  if (p.image) used.add(p.image);
  if (p.altImage) used.add(p.altImage);
});
const allImages = Object.values(POOLS).flat();
const orphans = allImages.filter(i => !used.has(i));

const README = [
  'Edit this file to change prices, images and names. After editing, commit and push - Cloudflare deploys in ~30 seconds.',
  '',
  'Each SKU can have any of these keys: image, altImage, price, mrp, name, badge.',
  '  - image:    main product photo (path like "images/necklace/necklace-05.webp")',
  '  - altImage: a second photo shown on hover (optional)',
  '  - price:    selling price in rupees, e.g. 5200',
  '  - mrp:      struck-through original price, e.g. 7200',
  '  - name:     override the auto-generated product name',
  '  - badge:    "BESTSELLER" | "NEW" | "TRENDING" | "" (empty to hide)',
  '',
  'SKU map: CC-SI-001..050 (South Indian), CC-MM-001..050 (Mumbai Modern), CC-NB-001..050 (North Indian Bridal).',
  '',
  'To add a NEW image: drop it into images/<category>/ (Earrings, choker, necklace, pendant, waist-chain) and reference it here.',
  'To re-seed from scratch from the current /images contents, run: node build/seed-products.js'
].join(' ');

const output = { _README: README, products };

if (fs.existsSync(OUT_FILE)) {
  fs.copyFileSync(OUT_FILE, OUT_FILE + '.bak');
  console.log('Backed up existing products.json -> products.json.bak');
}
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

const withImg = Object.values(products).filter(o => o.image).length;
const withAlt = Object.values(products).filter(o => o.altImage).length;
console.log('Wrote products.json: ' + Object.keys(products).length + ' SKUs (' + withImg + ' with primary, ' + withAlt + ' with altImage).');
console.log('Images used: ' + used.size + ' of ' + allImages.length + '. Orphans: ' + orphans.length + '.');
if (orphans.length) console.log('  Orphan files:', orphans);
