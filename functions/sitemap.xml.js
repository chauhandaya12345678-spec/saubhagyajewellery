/**
 * Saubhagya — Dynamic sitemap.xml (Cloudflare Pages Function)
 * Maps to /sitemap.xml (see _routes.json include list).
 * Static pages + every in-stock product SKU straight from D1 — no
 * more manually re-generating sitemap.xml after a catalog change.
 */
import { isVariantDup } from './_listing.js';

const SITE_URL = 'https://saubhagyajewellery.com';

// [path, lastmod] — lastmod is the real date that file was last edited (git
// log), NOT today's date. Google explicitly downweights/ignores <lastmod> it
// catches lying (every URL "changed" on every crawl teaches Google the tag
// is noise, which makes it re-crawl on its own heuristics instead — slower
// to pick up real changes, not faster). When you actually edit one of these
// pages, update its date here too — that's the whole point of the tag.
const STATIC_PAGES = [
  ['/', '2026-08-17'], ['/categories', '2026-08-18'], ['/gifting', '2026-08-17'],
  ['/track-orders', '2026-08-17'], ['/about', '2026-08-17'], ['/contact', '2026-08-17'],
  ['/faq', '2026-08-17'], ['/jewellery-guide', '2026-08-17'],
  ['/trust', '2026-08-17'], ['/blogs', '2026-08-17'], ['/shipping-and-returns', '2026-08-17'],
  ['/es-policy', '2026-08-17'], ['/grievances', '2026-08-17'],
  ['/terms', '2026-08-17'], ['/offer-terms', '2026-08-17'], ['/privacy-policy', '2026-08-17'],
  ['/cookie-policy', '2026-08-17'], ['/review', '2026-08-19'],
  ['/blogs/temple-jewellery-styling', '2026-08-17'], ['/blogs/kundan-vs-polki', '2026-08-17'],
  ['/blogs/caring-matte-gold', '2026-08-17'], ['/blogs/bridal-set-6-hour-event', '2026-08-17'],
  ['/blogs/real-vs-fake-gold-plated', '2026-08-17'], ['/blogs/indian-bridal-jewellery-guide', '2026-08-17'],
  ['/blogs/care-tips-imitation-jewellery', '2026-08-17'],
  ['/blogs/punjabi-wedding-jewellery', '2026-08-17'], ['/blogs/bengali-bride-jewellery', '2026-08-17'],
  ['/blogs/maharashtrian-jewellery', '2026-08-17'], ['/blogs/south-indian-temple-jewellery', '2026-08-17'],
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
      'SELECT sku, name, image, updated_at, variants FROM products WHERE inStock = 1 ORDER BY sku'
    ).all();
    // Only canonical URLs belong in a sitemap. Colour siblings canonicalize onto
    // their design's lead SKU (see functions/_pdp.js leadSku), so listing them
    // here would just feed Google URLs it is told not to index.
    skus = (results || []).filter(r => !isVariantDup(r));
  } catch (e) { /* DB unreachable — ship static pages only, never 500 */ }

  const urls = STATIC_PAGES.map(([p, lastmod]) =>
    `  <url><loc>${esc(SITE_URL + p)}</loc><lastmod>${lastmod}</lastmod></url>`
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
      return `  <url><loc>${SITE_URL}/product/${encodeURIComponent(p.sku)}</loc><lastmod>${lastmod}</lastmod>${imageTag}</url>`;
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
