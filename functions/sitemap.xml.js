/**
 * Saubhagya — Dynamic sitemap.xml (Cloudflare Pages Function)
 * Maps to /sitemap.xml (see _routes.json include list).
 * Static pages + every in-stock product SKU straight from D1 — no
 * more manually re-generating sitemap.xml after a catalog change.
 */
const SITE_URL = 'https://saubhagyajewellery.com';

const STATIC_PAGES = [
  '/', '/categories', '/gifting', '/track-orders', '/about', '/contact',
  '/trust', '/blogs', '/shipping-and-returns', '/es-policy', '/grievances',
  '/terms', '/offer-terms', '/privacy-policy', '/cookie-policy',
];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;');
}
function absImg(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}/${String(url).replace(/^\/+/, '')}`;
}

export async function onRequest(context) {
  const { env } = context;
  const today = new Date().toISOString().slice(0, 10);

  let skus = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT sku, name, image, updated_at FROM products WHERE inStock = 1 ORDER BY sku'
    ).all();
    skus = results || [];
  } catch (e) { /* DB unreachable — ship static pages only, never 500 */ }

  const urls = STATIC_PAGES.map(p => `${SITE_URL}${p}`).map(loc =>
    `  <url><loc>${esc(loc)}</loc><lastmod>${today}</lastmod></url>`
  ).concat(
    skus.map(p => {
      const lastmod = p.updated_at ? String(p.updated_at).slice(0, 10) : today;
      // <image:image> lets Google Images index the product photo alongside
      // the page — a real traffic source for ecommerce that a plain <url>
      // entry doesn't get you.
      const img = absImg(p.image);
      const imageTag = img
        ? `<image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(p.name || '')}</image:title></image:image>`
        : '';
      return `  <url><loc>${SITE_URL}/product?sku=${encodeURIComponent(p.sku)}</loc><lastmod>${lastmod}</lastmod>${imageTag}</url>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
