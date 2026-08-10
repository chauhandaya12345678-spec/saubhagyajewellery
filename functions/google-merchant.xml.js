/**
 * Saubhagya — Google Shopping product feed (Cloudflare Pages Function)
 * Maps to /google-merchant.xml (see _routes.json include list).
 *
 * Submit this URL in Google Merchant Center → Products → Feeds. It powers
 * free Google Shopping listings + the Shopping tab + (optionally) paid
 * Shopping ads. Regenerated live from D1 on every fetch, so catalog/price/
 * stock changes flow through within the cache window — no manual re-upload.
 *
 * Spec: https://support.google.com/merchant/answer/7052112
 */
import { seoSubtitle } from './_seo.js';   // shared region/style-aware engine

const SITE_URL = 'https://saubhagyajewellery.com';
const BRAND = 'Saubhagya Jewellery';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function absImg(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}/${String(url).replace(/^\/+/, '')}`;
}

const GOOGLE_CATEGORY = {
  Necklace: 'Apparel & Accessories > Jewelry > Necklaces',
  Earring: 'Apparel & Accessories > Jewelry > Earrings',
};

const COLOR_BY_SUFFIX = { GL: 'Gold', SGL: 'Gold', GR: 'Green', WH: 'White', MR: 'Maroon', MH: 'Mehndi Green' };

export async function onRequest(context) {
  const { env } = context;

  let rows = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT sku, name, category, price, mrp, image, inStock, stock_count, variants, description FROM products WHERE inStock = 1 AND sku != \'TEST-RS1\' ORDER BY sku'
    ).all();
    rows = results || [];
  } catch (e) { /* DB down — return an empty but valid feed, never 500 */ }

  const items = rows.map(p => {
    let variants = null;
    if (typeof p.variants === 'string' && p.variants) {
      try { variants = JSON.parse(p.variants); } catch (e) { variants = null; }
    }
    const isMulti = Array.isArray(variants) && variants.length > 1;

    // Product names now carry the keywords themselves, so only append the
    // generated subtitle when it still fits inside Google's 150-char title —
    // truncating mid-word looked worse than simply shipping the name.
    const subtitle = seoSubtitle(p);
    const longTitle = `${p.name} — ${subtitle}`;
    const title = longTitle.length <= 148 ? longTitle : p.name.slice(0, 148);

    // The per-SKU copy, not a template. Every item used to ship the same
    // sentence with the name and price swapped in, which is thin content in
    // Shopping exactly as it was on the site.
    const body = String(p.description || '').replace(/\s+/g, ' ').trim();
    const spec = `Handcrafted in Mumbai from skin-friendly, lead & nickel-free Zamak alloy with a high gold-plated (1 gram gold look) finish. Free insured shipping across India.`;
    const desc = body
      ? `${body} ${spec}`
      : `Buy ${p.name} online at ₹${p.price}. ${subtitle}. ${spec}`;
    const link = `${SITE_URL}/product/${encodeURIComponent(p.sku)}`;
    const img = absImg(p.image);
    const avail = (p.stock_count != null && p.stock_count <= 0) ? 'out_of_stock' : 'in_stock';

    // colour: prefer the linked-variant label, else map the SKU suffix
    let color = '';
    if (Array.isArray(variants)) {
      const hit = variants.find(v => v && v.sku === p.sku);
      if (hit && hit.label) color = hit.label;
    }
    if (!color) {
      const m = String(p.sku).match(/-([A-Z]+)$/);
      if (m) color = COLOR_BY_SUFFIX[m[1]] || '';
    }
    // group colour variants of one design (multi-colour necklaces only)
    const groupId = isMulti ? String(p.sku).replace(/-[A-Z]+$/, '') : '';

    return [
      '  <item>',
      `    <g:id>${esc(p.sku)}</g:id>`,
      `    <g:title>${esc(title)}</g:title>`,
      `    <g:description>${esc(desc)}</g:description>`,
      `    <g:link>${esc(link)}</g:link>`,
      img ? `    <g:image_link>${esc(img)}</g:image_link>` : '',
      `    <g:availability>${avail}</g:availability>`,
      `    <g:price>${p.price}.00 INR</g:price>`,
      `    <g:brand>${esc(BRAND)}</g:brand>`,
      '    <g:condition>new</g:condition>',
      '    <g:identifier_exists>no</g:identifier_exists>',
      `    <g:mpn>${esc(p.sku)}</g:mpn>`,
      `    <g:google_product_category>${esc(GOOGLE_CATEGORY[p.category] || 'Apparel & Accessories > Jewelry')}</g:google_product_category>`,
      `    <g:product_type>${esc(p.category || 'Imitation Jewellery')}</g:product_type>`,
      color ? `    <g:color>${esc(color)}</g:color>` : '',
      '    <g:gender>female</g:gender>',
      '    <g:age_group>adult</g:age_group>',
      '    <g:material>Zamak alloy, gold-plated</g:material>',
      groupId ? `    <g:item_group_id>${esc(groupId)}</g:item_group_id>` : '',
      '    <g:shipping><g:country>IN</g:country><g:service>Insured</g:service><g:price>0.00 INR</g:price></g:shipping>',
      '  </item>',
    ].filter(Boolean).join('\n');
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `<channel>\n` +
    `  <title>Saubhagya Jewellery</title>\n` +
    `  <link>${SITE_URL}/</link>\n` +
    `  <description>Handcrafted premium imitation jewellery — necklaces, earrings and jhumka earrings.</description>\n` +
    items.join('\n') + '\n' +
    `</channel>\n</rss>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
