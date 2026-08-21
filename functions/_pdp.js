/**
 * Saubhagya — shared PDP SSR renderer.
 * Used by both the clean-URL route (functions/product/[sku].js) and, for
 * backward compatibility, referenced conceptually by functions/product.js
 * (which now 301-redirects the legacy ?sku= form to the clean path).
 *
 * Canonical is ALWAYS the clean /product/<sku> URL so Google indexes one
 * URL per product (query-string URLs are poorly indexed for e-commerce).
 */
import { seoSubtitle, productKeywords, seoTitle } from './_seo.js';

const SITE_URL = 'https://saubhagyajewellery.com';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function abs(url) {
  if (!url) return SITE_URL + '/images/banners/Website_hero_banner_concept_art._202606221611.webp';
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_URL + '/' + String(url).replace(/^\/+/, '');
}
/* PDP hero serves at up to 560px on desktop and opens in a 2.5x lightbox, so
   900px @ q80 is the sweet spot: ~60% lighter than the 1000px original while
   zoom still has enough pixels. Source is on the zone (R2 live / repo UAT),
   so /cdn-cgi/image shrinks it at the edge. */
function optImg(url) {
  if (!url) return url;
  if (url.indexOf('/cdn-cgi/image/') !== -1) return url;
  return '/cdn-cgi/image/width=900,quality=80,format=auto/' + url;
}
export function cleanProductUrl(sku) {
  return SITE_URL + '/product/' + encodeURIComponent(sku);
}

/**
 * Colour variants share one design; variants[0].sku is the "lead" that the
 * listing grids, the sitemap and the canonical URL all consolidate onto. A row
 * whose own sku IS the lead (or that has no variants) is its own canonical.
 * This collapses the near-duplicate colour pages — same description body, only
 * the colour word differs — onto one indexable URL per design, so Google stops
 * filing the siblings as "Duplicate / not indexed".
 */
export function leadSku(p) {
  let vs = p && p.variants;
  if (typeof vs === 'string' && vs) { try { vs = JSON.parse(vs); } catch (e) { vs = null; } }
  if (Array.isArray(vs) && vs.length && vs[0] && vs[0].sku) return vs[0].sku;
  return p.sku;
}

/**
 * Editorial pages worth sending a product page to, by category.
 * A product page used to have zero outbound links, which made all 44 of them
 * dead ends for both a crawler and a reader.
 */
const GUIDES = {
  Earring: [
    ['/blogs/kundan-vs-polki', 'Kundan vs Polki: how to tell them apart'],
    ['/blogs/punjabi-wedding-jewellery', 'Punjabi wedding jewellery, piece by piece'],
  ],
  Necklace: [
    ['/blogs/south-indian-temple-jewellery', 'A guide to South Indian temple jewellery'],
    ['/blogs/temple-jewellery-styling', 'How to style temple jewellery with a saree'],
  ],
};
const GUIDES_ALL = [
  ['/jewellery-guide', 'Make gold plating last for years'],
  ['/blogs/care-tips-imitation-jewellery', 'Care tips for imitation jewellery'],
];

/**
 * Six other products from the same category, starting just after this one in
 * SKU order and wrapping around. A fixed "first six" would have funnelled every
 * page in a category into the same six URLs; rotating spreads the internal
 * links evenly across the catalogue.
 */
async function relatedProducts(env, p) {
  try {
    const { results } = await Promise.race([
      env.DB.prepare('SELECT sku, name, price, image FROM products WHERE category = ? AND inStock = 1 ORDER BY sku').bind(p.category || '').all(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('d1 timeout')), 3000)),
    ]);
    const all = results || [];
    if (all.length < 2) return [];
    const i = all.findIndex(r => r.sku === p.sku);
    const start = i < 0 ? 0 : i + 1;
    const out = [];
    for (let k = 0; k < all.length - 1 && out.length < 6; k++) {
      const row = all[(start + k) % all.length];
      if (row.sku !== p.sku) out.push(row);
    }
    return out;
  } catch (e) { return []; }
}

/**
 * Thumbnail through Cloudflare image resizing. Works for both shapes the
 * `image` column takes: a repo-relative path on UAT and an absolute R2 URL on
 * live — /cdn-cgi/image accepts a full URL as its source as long as it is on
 * the same zone, which img.saubhagyajewellery.com is.
 */
function thumb(src, w) {
  const s = String(src || '').trim();
  if (!s) return '';
  return `/cdn-cgi/image/width=${w},quality=78,format=auto/` +
    (/^https?:\/\//i.test(s) ? s : s.replace(/^\/+/, ''));
}

function renderMore(related, p) {
  const guides = (GUIDES[p.category] || []).concat(GUIDES_ALL);
  let h = '';
  if (related.length) {
    h += `<h2>More ${esc(p.category === 'Earring' ? 'earrings' : 'necklaces')}</h2><ul class="pm-grid">` +
      related.map(r => {
        // The rail card shows the photo at ~150 CSS px in a 4:5 box; 320 covers
        // it on a 2x screen. width/height reserve the box so the rail does not
        // reflow as the lazy images land.
        const t = thumb(r.image, 320);
        return `<li><a href="/product/${encodeURIComponent(r.sku)}">` +
          (t ? `<img class="pm-th" src="${esc(t)}" alt="" width="150" height="188" loading="lazy" decoding="async">` : '') +
          `<span class="n">${esc(r.name)}</span><span class="p">&#8377;${esc(r.price)}</span></a></li>`;
      }).join('') + '</ul>';
  }
  // Folded shut. These guides are useful but they are not why anyone opened a
  // product page, and an open list of six competed with the buy button. A
  // closed <details> is still crawled, so the outbound links survive.
  h += '<details class="pm-next"><summary class="pm-sum">' +
      '<span class="pm-sum-t"><b>Read next</b>' +
      `<em>${guides.length} short guides on buying and caring for these pieces.</em></span>` +
      '<span class="pm-chev" aria-hidden="true">+</span>' +
    '</summary><ul class="pm-links">' +
    guides.map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('') +
    '</ul></details>';
  return h;
}

/** Trim to n chars on a word boundary, for the <meta description> budget. */
function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}

export async function renderProductShell(html, p, env) {
  const subtitle = seoSubtitle(p);        // shared region/style-aware engine
  const keywords = productKeywords(p);

  // Per-SKU copy from D1. Before this column existed every product page carried
  // the same generated sentence with only the name and price swapped, so 44
  // pages read as one page to a crawler. `body` is the real description; the
  // template below is kept only for a SKU that has not been written yet.
  const body = String(p.description || '').replace(/\s+/g, ' ').trim();

  // Compressed for the SERP only — p.name stays full everywhere else (H1,
  // meta description, Shopping/Meta feeds, order lines). See seoTitle().
  const title = seoTitle(p);
  // The name has to lead the meta description. Colour variants share the same
  // description body and differ only in its last sentence, so clipping the body
  // alone produced one identical meta description for all three variants of a
  // design — the exact duplication this work exists to remove.
  const desc = body
    ? `${p.name}: ${clip(body, Math.max(60, 148 - p.name.length))} ₹${p.price}.`
    : `Buy ${p.name} online at ₹${p.price}. ${subtitle}, handcrafted in Mumbai from skin-friendly Zamak alloy. Free insured shipping across India.`;
  const canonical = cleanProductUrl(p.sku);
  // Colour siblings consolidate onto the design's lead SKU for indexing; a lead
  // or single-colour product is its own canonical (canonicalUrl === canonical).
  const canonicalUrl = cleanProductUrl(leadSku(p));
  const image = abs(p.image);
  const inStock = (p.inStock === 0 || p.inStock === false) ? false : true;

  const related = await relatedProducts(env, p);

  let reviewStats = null;
  try {
    const rs = await Promise.race([
      env.DB.prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_sku = ?').bind(p.sku).first(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('d1 timeout')), 3000)),
    ]);
    if (rs && rs.count > 0) reviewStats = { count: rs.count, average: Math.round(rs.average * 10) / 10 };
  } catch (e) { /* reviews table not reachable */ }

  const productLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    // Schema gets the FULL description, not the clipped meta one.
    name: p.name, sku: p.sku, image: [image], description: body || desc,
    brand: { '@type': 'Brand', name: 'Saubhagya Jewellery' },
    category: p.category || 'Imitation Jewellery',
    offers: {
      '@type': 'Offer', url: canonical, priceCurrency: 'INR', price: String(p.price),
      // Google's Merchant listing spec wants the window the price is valid FOR,
      // not just when it expires. validFrom is the date this price last changed
      // (the row's updated_at), so it is a real statement rather than a guess.
      validFrom: String(p.updated_at || p.created_at || '').slice(0, 10)
        || new Date().toISOString().slice(0, 10),
      priceValidUntil: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Saubhagya Jewellery' },
      merchantReturnLink: SITE_URL + '/shipping-and-returns',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        // MerchantReturnUnspecified is valid schema.org but Google does NOT
        // accept it for Merchant listings — hence "invalid enum value". It also
        // contradicted merchantReturnDays: stating a 7-day window and calling
        // the policy unspecified cannot both be true. A finite window is what
        // the returns page actually promises.
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
  };
  if (reviewStats) {
    productLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(reviewStats.average), reviewCount: String(reviewStats.count),
    };
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: SITE_URL + '/categories' },
      { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
    ],
  };

  return html
    .replace('<title>Handcrafted Imitation Jewellery | Saubhagya Jewellery</title>', `<title>${esc(title)}</title>`)
    .replace(
      '<meta name="description" content="Handcrafted premium imitation jewellery from our Mumbai workshop. Free insured shipping across India.">',
      `<meta name="description" content="${esc(desc)}">`
    )
    .replace(
      '<link rel="canonical" href="https://saubhagyajewellery.com/product">',
      `<link rel="canonical" href="${esc(canonicalUrl)}">`
    )
    .replace(
      '<meta property="og:title" content="Saubhagya Jewellery">',
      `<meta property="og:title" content="${esc(title)}">`
    )
    .replace(
      '<meta property="og:description" content="Handcrafted premium imitation jewellery from our Mumbai workshop.">',
      `<meta property="og:description" content="${esc(desc)}">`
    )
    .replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="${esc(image)}">`
    )
    .replace(
      /<meta name="twitter:image" content="[^"]*">/,
      `<meta name="twitter:image" content="${esc(image)}">`
    )
    .replace(
      '</head>',
      `<link rel="preload" as="image" href="${esc(optImg(image))}" fetchpriority="high">` +
      `<meta property="og:url" content="${esc(canonicalUrl)}">` +
      `<meta property="product:price:amount" content="${p.price}">` +
      `<meta property="product:price:currency" content="INR">` +
      `<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}">` +
      `<meta name="twitter:title" content="${esc(title)}">` +
      `<meta name="twitter:description" content="${esc(desc)}">` +
      `<meta name="keywords" content="${esc(keywords)}">` +
      `<script type="application/ld+json">${JSON.stringify(productLd)}</script>` +
      `<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>` +
      `</head>`
    )
    // SSR body: prevent soft-404 by removing misleading text Googlebot sees in raw HTML.
    // pdp-error / oos-stamp are client-side managed via JS — but Googlebot doesn't
    // execute JS, so it reads "Product Not Found" + "OUT OF STOCK" from source.
    // When we've confirmed the product EXISTS in D1, scrub those strings from the shell.
    //
    // #pdp-loading is deliberately LEFT VISIBLE. It used to be hidden here, which
    // meant the served HTML had zero visible content until the client fetch of
    // /api/products resolved — a blank page for seconds on cold in-app browsers
    // (Instagram/Facebook WebView). "LOADING…" is not a soft-404 signal; instead we
    // fill it with the real name + price so the first paint is already useful.
    // Regex (not a literal) so a copy tweak in product.html can never silently
    // turn this into a no-op — worst case the shell keeps its own "LOADING…".
    .replace(
      /<div class="pdp-loading" id="pdp-loading">[\s\S]*?<\/div>/,
      `<div class="pdp-loading" id="pdp-loading">` +
        `<p class="pdp-pre-name">${esc(p.name)}</p>` +
        `<p class="pdp-pre-price">&#8377;${esc(p.price)}</p>` +
        (body ? `<p class="pdp-pre-desc">${esc(clip(body, 240))}</p>` : '') +
        `<p class="pdp-pre-dots">LOADING DETAILS&hellip;</p>` +
      `</div>`
    )
    .replace(
      '<img class="pdp-img" id="pdp-image" src="" alt="" fetchpriority="high" decoding="async">',
      `<img class="pdp-img" id="pdp-image" src="${esc(optImg(image))}" alt="${esc(p.name)}" fetchpriority="high" decoding="async">`
    )
    // Necklaces are shot tall; frame the hero to a 3:4 cover window (product.html
    // .is-necklace CSS). Emit the class in SSR too so the first paint is already
    // framed — the client toggles the same class on render, so no flash.
    .replace(
      '<div class="pdp-img-wrap">',
      p.category === 'Necklace' ? '<div class="pdp-img-wrap is-necklace">' : '<div class="pdp-img-wrap">'
    )
    // the client fills both from /api/products, but the raw HTML shipped an
    // EMPTY <h1> — so a crawler that does not run JS saw a product page with no
    // heading and no prose at all.
    .replace(
      '<h1 class="pdp-name" id="pdp-name"></h1>',
      `<h1 class="pdp-name" id="pdp-name">${esc(p.name)}</h1>`
    )
    .replace(
      '<div class="pdp-desc" id="pdp-desc"></div>',
      `<div class="pdp-desc" id="pdp-desc">${esc(body)}</div>`
    )
    // Same reason as the H1: the keyword H2 shipped empty and was written by
    // JS, so a crawler saw the page's only keyword heading as blank. The client
    // recomputes and rewrites the identical string (product.html mirrors
    // seoSubtitle from _seo.js), so this never flickers into different copy.
    .replace(
      '<h2 class="pdp-sub-seo" id="pdp-sub-seo"></h2>',
      `<h2 class="pdp-sub-seo" id="pdp-sub-seo">${esc(subtitle)}</h2>`
    )
    .replace(
      '<section class="pdp-more" id="pdp-more"></section>',
      `<section class="pdp-more" id="pdp-more">${renderMore(related, p)}</section>`
    )
    .replace(
      '<p class="pdp-error-title">Product Not Found</p>',
      '<p class="pdp-error-title" style="display:none"></p>'
    )
    .replace(
      '<div class="pdp-oos-stamp" id="pdp-oos-stamp" style="display:none">OUT OF STOCK</div>',
      inStock
        ? '<div class="pdp-oos-stamp" id="pdp-oos-stamp" style="display:none"></div>'   // in stock → scrub text from raw HTML (no soft-404 signal)
        : '<div class="pdp-oos-stamp" id="pdp-oos-stamp">OUT OF STOCK</div>'           // out of stock → visible, honest signal
    );
}
