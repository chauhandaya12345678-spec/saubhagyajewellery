/**
 * Saubhagya — shared PDP SSR renderer.
 * Used by both the clean-URL route (functions/product/[sku].js) and, for
 * backward compatibility, referenced conceptually by functions/product.js
 * (which now 301-redirects the legacy ?sku= form to the clean path).
 *
 * Canonical is ALWAYS the clean /product/<sku> URL so Google indexes one
 * URL per product (query-string URLs are poorly indexed for e-commerce).
 */
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
export function cleanProductUrl(sku) {
  return SITE_URL + '/product/' + encodeURIComponent(sku);
}

export async function renderProductShell(html, p, env) {
  const seoSubtitle = (() => {
    const n = p.name || '';
    if (/jhumka/i.test(n)) return 'Traditional Gold-Plated Jhumka Earrings for Weddings & Festive Wear';
    if (p.category === 'Earring') return 'Handcrafted Gold-Plated Earrings for Everyday & Festive Wear';
    if (/crystal/i.test(n)) return 'Crystal-Studded High Gold-Plated Necklace for Weddings & Party Wear';
    if (/short/i.test(n)) return 'High Gold-Plated Short Necklace for Festive & Party Wear';
    if (p.category === 'Necklace') return 'Handcrafted High Gold-Plated Necklace for Weddings & Festive Wear';
    return 'Handcrafted Gold-Plated Imitation Jewellery, Made in India';
  })();

  const title = `${p.name} - ${seoSubtitle} | Saubhagya Jewellery`;
  const desc = `Buy ${p.name} online at ₹${p.price}. ${seoSubtitle}, handcrafted in Mumbai from skin-friendly Zamak alloy. Free insured shipping across India.`;
  const canonical = cleanProductUrl(p.sku);
  const image = abs(p.image);
  const inStock = (p.inStock === 0 || p.inStock === false) ? false : true;

  let reviewStats = null;
  try {
    const rs = await env.DB.prepare(
      'SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_sku = ?'
    ).bind(p.sku).first();
    if (rs && rs.count > 0) reviewStats = { count: rs.count, average: Math.round(rs.average * 10) / 10 };
  } catch (e) { /* reviews table not reachable */ }

  const productLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, sku: p.sku, image: [image], description: desc,
    brand: { '@type': 'Brand', name: 'Saubhagya Jewellery' },
    category: p.category || 'Imitation Jewellery',
    offers: {
      '@type': 'Offer', url: canonical, priceCurrency: 'INR', price: String(p.price),
      priceValidUntil: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Saubhagya Jewellery' },
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
      `<link rel="canonical" href="${esc(canonical)}">`
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
      '</head>',
      `<link rel="preload" as="image" href="${esc(image)}" fetchpriority="high">` +
      `<meta property="og:url" content="${esc(canonical)}">` +
      `<meta property="product:price:amount" content="${p.price}">` +
      `<meta property="product:price:currency" content="INR">` +
      `<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}">` +
      `<meta name="twitter:title" content="${esc(title)}">` +
      `<meta name="twitter:description" content="${esc(desc)}">` +
      `<meta name="twitter:image" content="${esc(image)}">` +
      `<script type="application/ld+json">${JSON.stringify(productLd)}</script>` +
      `<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>` +
      `</head>`
    )
    // SSR body: prevent soft-404 by removing misleading text Googlebot sees in raw HTML.
    // pdp-loading / pdp-error / oos-stamp are client-side managed via JS — but Googlebot
    // doesn't execute JS, so it reads "Product Not Found" + "OUT OF STOCK" from source.
    // When we've confirmed the product EXISTS in D1, scrub those strings from the shell.
    .replace('id="pdp-loading"', 'id="pdp-loading" style="display:none"')
    .replace(
      '<p class="pdp-error-title">Product Not Found</p>',
      '<p class="pdp-error-title" style="display:none"></p>'
    )
    .replace(
      'id="pdp-oos-stamp" style="display:none"',
      inStock
        ? 'id="pdp-oos-stamp" style="display:none"'   // in stock → hidden OK, text still "OUT OF STOCK" but hidden
        : 'id="pdp-oos-stamp"'                         // out of stock → keep visible for Google
    );
}
