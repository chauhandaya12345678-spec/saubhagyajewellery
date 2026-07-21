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

export async function onRequest(context) {
  const { env } = context;
  const today = new Date().toISOString().slice(0, 10);

  let skus = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT sku, updated_at FROM products WHERE inStock = 1 ORDER BY sku'
    ).all();
    skus = results || [];
  } catch (e) { /* DB unreachable — ship static pages only, never 500 */ }

  const urls = STATIC_PAGES.map(p => `${SITE_URL}${p}`).map(loc =>
    `  <url><loc>${esc(loc)}</loc><lastmod>${today}</lastmod></url>`
  ).concat(
    skus.map(p => {
      const lastmod = p.updated_at ? String(p.updated_at).slice(0, 10) : today;
      return `  <url><loc>${SITE_URL}/product?sku=${encodeURIComponent(p.sku)}</loc><lastmod>${lastmod}</lastmod></url>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
