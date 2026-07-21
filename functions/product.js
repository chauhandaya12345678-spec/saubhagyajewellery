/**
 * Saubhagya — Product PDP SSR (Cloudflare Pages Function)
 * ------------------------------------------------------------
 * Intercepts every /product request (with or without ?sku=…) and
 * rewrites the static product.html shell so the first byte crawlers +
 * WhatsApp/Facebook share bots see contains the REAL product title,
 * description, canonical URL, OG image and JSON-LD Product schema.
 *
 * How this preserves the zero-deploy D1 flow:
 *   • Every request reads the current row from D1 (5-min edge cache
 *     via Cache-Control below). Price / image / stock edits in D1 go
 *     live within 5 minutes — same envelope as /api/products (60 s).
 *     No git push required.
 *
 * How it stays out of the way:
 *   • No JS on the page is touched. product.html's client-side
 *     hydration keeps running (reviews, favourites, cart, buy-now,
 *     PIN checker, sticky mobile CTA, view transitions).
 *   • Razorpay is a modal — unaffected.
 *   • Shiprocket is server-side webhook — unaffected.
 *   • Missing sku or unknown SKU → serves the untouched fallback HTML
 *     (which shows the "Product Not Found" screen client-side).
 */

const SITE_URL = 'https://saubhagyajewellery.com';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function abs(url) {
  if (!url) return SITE_URL + '/images/banners/Website_hero_banner_concept_art._202606221611.webp';
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_URL + '/' + String(url).replace(/^\/+/, '');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku');

  // No sku → let the static file serve as-is (shows "Loading…" then falls
  // through to Product Not Found via client JS). next() continues Pages'
  // own asset resolution for this exact request — using env.ASSETS.fetch()
  // with a re-pointed '/product.html' URL instead causes an infinite 308
  // (Pages' clean-URL layer redirects /product.html → /product → here).
  if (!sku) return next();

  // Get the raw shell HTML via the same asset-resolution path (see above).
  const shellRes = await next();
  if (!shellRes.ok) return shellRes;
  let html = await shellRes.text();

  // Look up the product live from D1.
  let p = null;
  try {
    p = await env.DB.prepare('SELECT * FROM products WHERE sku = ?').bind(sku).first();
  } catch (e) { /* fall through to fallback shell */ }

  if (!p) {
    // Unknown or out-of-stock (products query filters inStock=1 elsewhere;
    // here we serve the shell so the client can show the correct empty state).
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  }

  const title = `${p.name} | Saubhagya Jewellery`;
  const desc = `${p.name} — handcrafted ${p.category || 'imitation jewellery'} at ₹${p.price}. Made in Mumbai, free insured shipping across India.`;
  const canonical = `${SITE_URL}/product?sku=${encodeURIComponent(p.sku)}`;
  const image = abs(p.image);
  const inStock = (p.inStock === 0 || p.inStock === false) ? false : true;

  // Review stats for AggregateRating (best-effort — table may be empty for new SKUs)
  let reviewStats = null;
  try {
    const rs = await env.DB.prepare(
      'SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_sku = ?'
    ).bind(p.sku).first();
    if (rs && rs.count > 0) reviewStats = { count: rs.count, average: Math.round(rs.average * 10) / 10 };
  } catch (e) { /* reviews table not reachable — skip aggregateRating */ }

  // Product JSON-LD (rich-result eligible on Google Search)
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    image: [image],
    description: desc,
    brand: { '@type': 'Brand', name: 'Saubhagya Jewellery' },
    category: p.category || 'Imitation Jewellery',
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'INR',
      price: String(p.price),
      priceValidUntil: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Saubhagya Jewellery' },
    },
  };
  if (reviewStats) {
    productLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(reviewStats.average),
      reviewCount: String(reviewStats.count),
    };
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: SITE_URL + '/categories' },
      { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
    ],
  };

  // Patch the shell. Uses exact-string replace so it's stable + fast.
  html = html
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
    // Inject Product + BreadcrumbList JSON-LD just before </head>
    .replace(
      '</head>',
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
    );

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 5-min edge cache. D1 price/image edits live within this window.
      // Match /api/products cache to keep pages + API in sync.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-SSR-Source': 'd1',
    },
  });
}
