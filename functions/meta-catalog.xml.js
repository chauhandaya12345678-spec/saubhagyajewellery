/**
 * Saubhagya — Meta Commerce Manager product feed (Cloudflare Pages Function)
 * Maps to /meta-catalog.xml (see _routes.json include list).
 *
 * Submit this URL in Meta Business → Commerce Manager → Catalog → Data Sources
 * → Add data source → Use a URL. Meta ingests it on a schedule (default every
 * 24h) so new products / price changes flow through automatically — no manual
 * CSV re-upload ever.
 *
 * Regenerated live from D1 on every fetch. Meta Commerce Manager accepts the
 * Google Shopping RSS/XML namespace (xmlns:g) — this feed adds the Meta-only
 * fields (fb_product_category, quantity_to_sell_on_facebook) on top.
 *
 * Meta docs: https://www.facebook.com/business/help/1084093196372967
 */
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

function seoSubtitle(p) {
  const n = p.name || '';
  if (/jhumka/i.test(n)) return 'Traditional Gold-Plated Jhumka Earrings for Weddings & Festive Wear';
  if (p.category === 'Earring') return 'Handcrafted Gold-Plated Earrings for Everyday & Festive Wear';
  if (/crystal/i.test(n)) return 'Crystal-Studded High Gold-Plated Necklace for Weddings & Party Wear';
  if (/short/i.test(n)) return 'High Gold-Plated Short Necklace for Festive & Party Wear';
  if (p.category === 'Necklace') return 'Handcrafted High Gold-Plated Necklace for Weddings & Festive Wear';
  return 'Handcrafted Gold-Plated Imitation Jewellery, Made in India';
}

const GOOGLE_CATEGORY = {
  Necklace: 'Apparel & Accessories > Jewelry > Necklaces',
  Earring: 'Apparel & Accessories > Jewelry > Earrings',
};

// Meta's own product taxonomy (fb_product_category) — jewellery branches.
const FB_CATEGORY = {
  Necklace: 'Jewelry & Accessories > Jewelry > Necklaces & Pendants',
  Earring: 'Jewelry & Accessories > Jewelry > Earrings',
};

const COLOR_BY_SUFFIX = { GL: 'Gold', SGL: 'Gold', GR: 'Green', WH: 'White', MR: 'Maroon', MH: 'Mehndi Green' };

export async function onRequest(context) {
  const { env } = context;

  let rows = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT sku, name, category, price, mrp, image, inStock, stock_count, variants FROM products WHERE inStock = 1 AND sku != \'TEST-RS1\' ORDER BY sku'
    ).all();
    rows = results || [];
  } catch (e) { /* DB down — return an empty but valid feed, never 500 */ }

  const items = rows.map(p => {
    let variants = null;
    if (typeof p.variants === 'string' && p.variants) {
      try { variants = JSON.parse(p.variants); } catch (e) { variants = null; }
    }
    const isMulti = Array.isArray(variants) && variants.length > 1;

    const title = `${p.name} — ${seoSubtitle(p)}`.slice(0, 148);
    const desc = `Buy ${p.name} online at ₹${p.price}. ${seoSubtitle(p)}. Handcrafted in Mumbai from skin-friendly, lead & nickel-free Zamak alloy with a high gold-plated (1 gram gold look) finish. Free insured shipping across India.`;
    const link = `${SITE_URL}/product/${encodeURIComponent(p.sku)}`;
    const img = absImg(p.image);
    const inStockNow = (p.stock_count != null && p.stock_count <= 0) ? false : true;
    // Meta uses "in stock" / "out of stock" (space), Google uses "in_stock"
    const avail = inStockNow ? 'in stock' : 'out of stock';
    const qty = (p.stock_count != null && p.stock_count >= 0) ? p.stock_count : (inStockNow ? 10 : 0);

    let color = '';
    if (Array.isArray(variants)) {
      const hit = variants.find(v => v && v.sku === p.sku);
      if (hit && hit.label) color = hit.label;
    }
    if (!color) {
      const m = String(p.sku).match(/-([A-Z]+)$/);
      if (m) color = COLOR_BY_SUFFIX[m[1]] || '';
    }
    const groupId = isMulti ? String(p.sku).replace(/-[A-Z]+$/, '') : '';

    return [
      '  <item>',
      `    <g:id>${esc(p.sku)}</g:id>`,
      `    <g:title>${esc(title)}</g:title>`,
      `    <g:description>${esc(desc)}</g:description>`,
      `    <g:link>${esc(link)}</g:link>`,
      img ? `    <g:image_link>${esc(img)}</g:image_link>` : '',
      `    <g:availability>${avail}</g:availability>`,
      `    <g:condition>new</g:condition>`,
      `    <g:price>${p.price}.00 INR</g:price>`,
      `    <g:brand>${esc(BRAND)}</g:brand>`,
      `    <g:google_product_category>${esc(GOOGLE_CATEGORY[p.category] || 'Apparel & Accessories > Jewelry')}</g:google_product_category>`,
      `    <g:fb_product_category>${esc(FB_CATEGORY[p.category] || 'Jewelry & Accessories > Jewelry')}</g:fb_product_category>`,
      `    <g:quantity_to_sell_on_facebook>${qty}</g:quantity_to_sell_on_facebook>`,
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
