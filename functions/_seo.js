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

/* Piece type — drives both the noun and the occasion set.
   The earring shapes are gated on the category because a NECKLACE SET is
   legitimately named "... Necklace Set with Jhumkas" and "... Pearl Drops";
   without the gate those necklaces come back typed as earrings. */
function detectType(s, cat, catLabel) {
  if (cat !== 'necklace') {
    if (/jhumka|jhumki/.test(s)) return 'Jhumka Earrings';
    if (/chandbali|chand ?bali/.test(s)) return 'Chandbali Earrings';
    if (/stud/.test(s)) return 'Stud Earrings';
    if (/drop|dangler/.test(s)) return 'Drop Earrings';
    if (/hoop|bali/.test(s) && cat === 'earring') return 'Hoop Earrings';
    if (cat === 'earring' || /earring/.test(s)) return 'Earrings';
  }
  // Category-authoritative: once the owner files a piece under Pendant or Bridal
  // Set, that wins over words in the NAME. A "Pendant Pearl Mala Necklace" is a
  // Pendant — without this it fell through to /mala|necklace/ below and typed as
  // a necklace. The four site categories are Bridal Set / Necklace / Earring /
  // Pendant, so this only pins the two that used to leak into necklace/earring.
  if (cat === 'pendant') return /\bset\b/.test(s) ? 'Pendant Set' : 'Pendant';
  if (cat === 'bridal set' || cat === 'bridal') return 'Bridal Jewellery Set';
  // ANY other category the owner created (Bracelet, Bangles, Maang Tika, Anklet,
  // Nath, Choker…): the CATEGORY is the type. Only Necklace + blank category fall
  // through to the name-based refinement below. This is what makes "add a new
  // category" give its products a correct type with zero extra config.
  if (cat && cat !== 'necklace' && catLabel) return catLabel;
  if (/choker/.test(s)) return 'Choker Necklace';
  if (/rani ?haar|haaram|\bharam\b|long ?necklace|long ?haar|mala/.test(s)) return 'Long Necklace';
  if (/temple|lakshmi|laxmi/.test(s) && /\bset\b/.test(s)) return 'Temple Jewellery Set';
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
  const type = detectType(s, cat, p.category);
  const occ = detectOccasion(s, material, type);

  const parts = [];
  if (material) parts.push(material);
  else if (region) parts.push(region);
  // "Antique Gold-Finish" + "Gold-Plated" read as two finishes in a row. The
  // material already names the finish, so skip the generic one.
  if (!/gold/i.test(material)) parts.push('Gold-Plated');
  if (region && material) parts.push(region); // keep both as keywords when distinct
  parts.push(dedupeType(type, material));
  return parts.join(' ') + ' for ' + occ;
}

/**
 * "South Indian Temple" + "Temple Jewellery Set" read as "South Indian Temple
 * Gold-Plated Temple Jewellery Set" on every temple product - the same word
 * twice in one line. Both halves are derived from the same trigger word in the
 * name, so drop it from the type when the material has already said it.
 * Keeps the keyword, loses the stutter.
 */
function dedupeType(type, material) {
  if (!material) return type;
  const mat = material.toLowerCase().split(/\s+/);
  const words = type.split(/\s+/);
  return (words.length > 1 && mat.indexOf(words[0].toLowerCase()) !== -1)
    ? words.slice(1).join(' ')
    : type;
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
  const type = detectType(s, cat, p.category);
  const base = [
    p.name,
    type + ' online India',
    // Same stutter as the subtitle had: "South Indian Temple" + "Temple
    // Jewellery Set" gave "South Indian Temple Temple Jewellery Set".
    (material ? material + ' ' + dedupeType(type, material) : type),
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

/**
 * SERP <title> for a product page — target <= 60 characters.
 *
 * The full product name is deliberately NOT shortened in the database: Google
 * Shopping and Meta match on the feed title, so the long descriptive form earns
 * impressions there, and past orders keep the name they were bought under. Only
 * the <title> tag is compressed, because that is the one place a long string is
 * actively harmful — Google truncates the SERP link at roughly 600px (~60
 * chars) and the tail is wasted.
 *
 * Two lossless cuts do almost all the work:
 *   - " with Jhumkas" is implied by "Necklace Set" and repeats a word already
 *     in the H1 and the feed title.
 *   - "Bead Drops" -> "Beads" keeps the colour, which is what distinguishes
 *     one variant page from its siblings and must survive.
 * The " | Saubhagya Jewellery" suffix is dropped entirely: it cost 22 chars on
 * every page to repeat a brand already shown as the SERP domain.
 */
export function seoTitle(p) {
  let t = String((p && p.name) || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+with\s+(jhumkas?|jhumkis?|earrings)\b/i, '');
  t = t.replace(/\bBead Drops\b/i, 'Beads');
  if (t.length <= 60) return t;

  // Over-long names keep their trailing " - Colour" and lose words off the
  // FRONT. Slicing the first 60 characters instead dropped the colour, which
  // is the only thing separating one variant page's title from its siblings.
  const dash = t.lastIndexOf(' - ');
  if (dash > 0) {
    const tail = t.slice(dash);
    const room = 60 - tail.length;
    if (room > 12) {
      const cut = t.slice(0, dash).slice(0, room);
      const sp = cut.lastIndexOf(' ');
      return tidyTail(sp > 8 ? cut.slice(0, sp) : cut) + tail;
    }
  }
  const cut = t.slice(0, 60);
  const sp = cut.lastIndexOf(' ');
  return tidyTail(sp > 40 ? cut.slice(0, sp) : cut);
}

/** Truncation must not leave trailing punctuation or a dangling connector. */
function tidyTail(s) {
  return s
    .replace(/[\s,\-–—]+$/, '')
    .replace(/\s+(and|with|for|the|of|in|a|&)$/i, '');
}
