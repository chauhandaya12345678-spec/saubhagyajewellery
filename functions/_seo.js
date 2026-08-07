/**
 * Saubhagya — shared SEO keyword engine.
 *
 * ONE source of truth for the keyword "H2" line that drives every product's
 * <title>, meta description, on-page H2, and Google Shopping feed title.
 * Imported by functions/_pdp.js (SSR PDP) and functions/google-merchant.xml.js.
 * The client PDP (product.html) mirrors seoSubtitle() verbatim — keep the two
 * in sync (there is no build step to share code with the browser).
 *
 * Design goal: the owner uploads a product with just a NAME + CATEGORY, and the
 * copy auto-derives pan-India keywords — South Indian temple, North Indian
 * Kundan/Polki, Punjabi jhumki, Rajasthani, Bengali, Maharashtrian, American
 * Diamond, Meenakari, antique/oxidised — so the catalogue ranks for every
 * regional style, not just South. Zero per-product maintenance.
 */

/* Material / craft style — most specific first. Real keyword phrases people
   actually search ("kundan set", "polki necklace", "meenakari jhumka"). */
function detectMaterial(s) {
  if (/kundan/.test(s) && /polki/.test(s)) return 'Kundan & Polki';
  if (/kundan/.test(s)) return 'Kundan';
  if (/polki/.test(s)) return 'Polki';
  if (/jadau/.test(s)) return 'Jadau';
  if (/meenakari|meena/.test(s)) return 'Meenakari';
  if (/temple|lakshmi|laxmi|nagas|nakshi|peacock/.test(s)) return 'South Indian Temple';
  if (/antique|oxidis|oxidiz/.test(s)) return 'Antique Gold-Finish';
  if (/american diamond|\bad\b|\bcz\b|cubic|zircon/.test(s)) return 'American Diamond';
  if (/crystal/.test(s)) return 'Crystal-Studded';
  if (/pearl|moti/.test(s)) return 'Pearl';
  if (/stone|studded/.test(s)) return 'Stone-Studded';
  return '';
}

/* Regional style hint — widens keyword reach beyond the default South skew. */
function detectRegion(s) {
  if (/rajwadi|rajasthani|borla|rakhdi|aad/.test(s)) return 'Rajasthani';
  if (/punjabi|jhumki|pippal|tikka.?set/.test(s)) return 'Punjabi';
  if (/bengali|bangla|chik|ratanchur|sita ?haar/.test(s)) return 'Bengali';
  if (/maharashtrian|thushi|kolhapuri|saaj|\bnath\b/.test(s)) return 'Maharashtrian';
  if (/gujarati/.test(s)) return 'Gujarati';
  return '';
}

/* Piece type — drives both the noun and the occasion set. */
function detectType(s, cat) {
  if (/jhumka|jhumki/.test(s)) return 'Jhumka Earrings';
  if (/chandbali|chand ?bali/.test(s)) return 'Chandbali Earrings';
  if (/stud/.test(s)) return 'Stud Earrings';
  if (/drop|dangler/.test(s)) return 'Drop Earrings';
  if (/hoop|bali/.test(s) && cat === 'earring') return 'Hoop Earrings';
  if (cat === 'earring' || /earring/.test(s)) return 'Earrings';
  if (/choker/.test(s)) return 'Choker Necklace';
  if (/rani ?haar|haaram|long ?necklace|long ?haar|mala/.test(s)) return 'Long Necklace';
  if (/mangalsutra/.test(s)) return 'Mangalsutra';
  if (/pendant/.test(s)) return 'Pendant Set';
  if (/bangle|kada|kangan/.test(s)) return 'Bangles';
  if (/bracelet/.test(s)) return 'Bracelet';
  if (/maang ?tikka|matha ?patti|\btikka\b|borla|rakhdi/.test(s)) return 'Maang Tikka';
  if (/\bnath\b|nose ?ring|nathni/.test(s)) return 'Nath';
  if (/anklet|payal/.test(s)) return 'Anklets';
  if (/\bring\b/.test(s)) return 'Ring';
  if (/bridal ?set|full ?set|combo|\bset\b/.test(s)) return 'Bridal Jewellery Set';
  if (/short/.test(s)) return 'Short Necklace';
  if (cat === 'necklace' || /necklace/.test(s)) return 'Necklace';
  return 'Imitation Jewellery';
}

function detectOccasion(s, material, type) {
  if (/bridal|mangalsutra|rani ?haar|haaram/.test(s) || /Kundan|Polki|Jadau/.test(material)) {
    return 'Weddings, Receptions & Festive Wear';
  }
  if (type === 'Stud Earrings' || /office|daily|everyday|casual/.test(s)) {
    return 'Everyday, Office & Festive Wear';
  }
  return 'Weddings, Festive & Party Wear';
}

/**
 * The keyword H2 line. e.g.
 *  "Kundan Gold-Plated Punjabi Jhumka Earrings for Weddings, Festive & Party Wear"
 *  "South Indian Temple Gold-Plated Necklace for Weddings, Festive & Party Wear"
 *  "American Diamond Gold-Plated Choker Necklace for Weddings, Festive & Party Wear"
 */
export function seoSubtitle(p) {
  const s = ((p.name || '') + ' ' + (p.category || '')).toLowerCase();
  const cat = (p.category || '').toLowerCase();
  const material = detectMaterial(s);
  const region = detectRegion(s);
  const type = detectType(s, cat);
  const occ = detectOccasion(s, material, type);

  const parts = [];
  if (material) parts.push(material);
  else if (region) parts.push(region);
  parts.push('Gold-Plated');
  if (region && material) parts.push(region); // keep both as keywords when distinct
  parts.push(type);
  return parts.join(' ') + ' for ' + occ;
}

/**
 * A compact, per-product keyword string for <meta name="keywords">. Not a
 * ranking factor for Google, but harmless and used by some other engines /
 * internal search. Derived from the same signals.
 */
export function productKeywords(p) {
  const s = ((p.name || '') + ' ' + (p.category || '')).toLowerCase();
  const cat = (p.category || '').toLowerCase();
  const material = detectMaterial(s);
  const region = detectRegion(s);
  const type = detectType(s, cat);
  const base = [
    p.name,
    type + ' online India',
    (material ? material + ' ' + type : type),
    (region ? region + ' ' + type : ''),
    'gold plated ' + type.toLowerCase(),
    'imitation ' + type.toLowerCase(),
    'artificial jewellery',
    'bridal jewellery online',
    'wedding jewellery set',
    'party wear jewellery',
    'buy ' + type.toLowerCase() + ' online',
    'Saubhagya Jewellery',
  ];
  return base.filter(Boolean).join(', ');
}
