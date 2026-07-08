'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const overrides = j.products || j;
const usedPrimary = new Set();
const usedAlt = new Set();
Object.values(overrides).forEach(p => {
  if (p.image) usedPrimary.add(p.image);
  if (p.altImage) usedAlt.add(p.altImage);
});
const hero = [
  'images/necklace/necklace-05.webp',
  'images/choker/202606051335.webp',
  'images/pendant/pendant-05.webp',
  'images/choker/202606051333.webp',
  'images/pendant/pendant-01.webp',
  'images/necklace/20260605_111058.webp'
];
hero.forEach(h => usedPrimary.add(h));
const allUsed = new Set([...usedPrimary, ...usedAlt]);

const exts = /\.(jpe?g|webp|png|gif)$/i;
const allImgs = [];
['Earrings', 'choker', 'necklace', 'pendant', 'waist-chain'].forEach(cat => {
  const dir = path.join(ROOT, 'images', cat);
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => exts.test(f)).forEach(f => {
    allImgs.push('images/' + cat + '/' + f);
  });
});

const unused = allImgs.filter(i => !allUsed.has(i));
console.log('Total images:', allImgs.length);
console.log('Used as primary:', usedPrimary.size);
console.log('Used as altImage:', usedAlt.size);
console.log('UNUSED (orphan) images:', unused.length);
const byCat = {};
unused.forEach(u => { const k = u.split('/')[1]; byCat[k] = (byCat[k] || 0) + 1; });
console.log('  by category:', byCat);
console.log('  first 6 orphans:', unused.slice(0, 6));
