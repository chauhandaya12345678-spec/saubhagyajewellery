/**
 * Saubhagya — shared SSR for the LISTING grids (homepage rail + /categories).
 *
 * WHY THIS EXISTS
 * `/` and `/categories` shipped an EMPTY product grid in their raw HTML — the
 * cards were built client-side by catalog.js after a fetch of /api/products.
 * Googlebot reads raw HTML first and does not run that JS, so it saw ZERO
 * internal links to any product on the two most-crawled pages of the site.
 * Every product was therefore discoverable only through sitemap.xml, which is
 * why Search Console filed most of them as "Discovered — currently not indexed"
 * and left the colour-variant SKUs fully orphaned (no internal link at all).
 *
 * These helpers inject the SAME cards catalog.js would build, straight into the
 * grid container, so the links exist in the served HTML. catalog.js then
 * overwrites the container on `catalog-ready` with the identical interactive
 * grid — no flicker, no duplicate — and price/stock still come live from D1.
 *
 * ZERO MAINTENANCE: cards are read from D1 on every request, so a product added
 * in admin appears in the crawlable HTML the moment it is in stock. Nothing to
 * regenerate, nothing to keep in sync.
 */

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Cards display at ~303–400 CSS px, so 400w q78 through Cloudflare image
   resizing is visually identical at a fraction of the bytes. Mirrors optImg()
   in index.html / categories.html. Skip URLs that already carry the prefix. */
function optImg(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (s.indexOf('/cdn-cgi/image/') !== -1) return s;
  return '/cdn-cgi/image/width=400,quality=78,format=auto/' +
    (/^https?:\/\//i.test(s) ? s : s.replace(/^\/+/, ''));
}

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function parseVariants(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { return JSON.parse(v); } catch (e) { return null; } }
  return null;
}

/**
 * A design's lead SKU is variants[0].sku. A row whose own sku is NOT that lead
 * is a colour sibling that listings collapse into the lead card — exactly the
 * isVariantDup flag catalog.js computes. Both grids and the sitemap hide these:
 * the lead SKU is the canonical URL (see functions/_pdp.js leadSku), so linking
 * a sibling would point at a URL Google is told not to index.
 */
export function isVariantDup(p) {
  const vs = parseVariants(p.variants);
  return !!(Array.isArray(vs) && vs.length && vs[0].sku && vs[0].sku !== p.sku);
}

/**
 * One catalogue card. `cls` is the page's card prefix ('tr' on the homepage,
 * 'p' on /categories) so the SSR markup reuses the existing CSS untouched — the
 * two pages already share parallel class names (tr-card/p-card, tr-name/p-name…).
 * Intentionally leaner than the client card (no QUICK ADD button, no colour
 * rotator): this is the crawlable / no-JS layer, and catalog.js replaces it with
 * the full interactive card the instant it hydrates.
 */
export function productCard(p, cls) {
  const sku = p.sku;
  const name = p.name || sku;
  const alt = esc(name + ' - ' + (p.category || 'handcrafted imitation jewellery') + ' from Saubhagya Jewellery');
  const hasOff = p.mrp && p.mrp > p.price;
  return `<a class="${cls}-card" href="/product/${encodeURIComponent(sku)}" title="${esc(name)}">` +
      `<div class="${cls}-img"><img class="im" src="${esc(optImg(p.image))}" alt="${alt}" ` +
        `loading="lazy" decoding="async" width="400" height="500"></div>` +
      `<h3 class="${cls}-name">${esc(name)}</h3>` +
      `<div class="${cls}-price">${fmt(p.price)}` +
        (hasOff
          ? `<span class="${cls}-mrp">${fmt(p.mrp)}</span>` +
            `<span class="${cls}-off">${Math.round((1 - p.price / p.mrp) * 100)}% OFF</span>`
          : '') +
      `</div>` +
    `</a>`;
}

/**
 * All in-stock rows, id order — matches /api/products (ORDER BY id ASC) so the
 * SSR order is identical to the order catalog.js renders, and the swap on
 * hydration is invisible. Throws if D1 is unreachable; callers catch and serve
 * the un-injected shell so the client fetch still populates the grid.
 */
export async function fetchProducts(env) {
  const { results } = await env.DB.prepare(
    'SELECT sku, name, price, mrp, image, category, variants, inStock FROM products WHERE inStock = 1 ORDER BY id ASC'
  ).all();
  return results || [];
}
