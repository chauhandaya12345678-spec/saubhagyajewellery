/**
 * Saubhagya — shared PDP SSR renderer.
 * Used by both the clean-URL route (functions/product/[sku].js) and, for
 * backward compatibility, referenced conceptually by functions/product.js
 * (which now 301-redirects the legacy ?sku= form to the clean path).
 *
 * Canonical is ALWAYS the clean /product/<sku> URL so Google indexes one
 * URL per product (query-string URLs are poorly indexed for e-commerce).
 */
import { seoSubtitle, productKeywords } from './_seo.js';

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
  const subtitle = seoSubtitle(p);        // shared region/style-aware engine
  const keywords = productKeywords(p);

  const title = `${p.name} - ${subtitle} | Saubhagya Jewellery`;
  const desc = `Buy ${p.name} online at ₹${p.price}. ${subtitle}, handcrafted in Mumbai from skin-friendly Zamak alloy. Free insured shipping across India.`;
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
        returnPolicyCategory: 'https://schema.org/MerchantReturnUnspecified',
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
        `<p class="pdp-pre-dots">LOADING DETAILS&hellip;</p>` +
      `</div>`
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
