/**
 * Saubhagya – Products API (Cloudflare Pages Function)
 *
 * GET /api/products          → all in-stock products
 * GET /api/products?sku=X    → single product by SKU
 * GET /api/products?region=X → filter by region (south|modern|bridal)
 * GET /api/products?cat=X    → filter by category
 *
 * Connected to D1 database via wrangler.toml binding "DB".
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = env.DB;
    const { searchParams } = url;
    const sku = searchParams.get('sku');
    const region = searchParams.get('region');
    const cat = searchParams.get('cat');

    // A direct ?sku= lookup must resolve even when the product is fully
    // delisted (inStock=0) — the product page and cart/checkout need the
    // real row to show "Out of stock" correctly instead of silently falling
    // back to a stale catalog.js snapshot that may still say available.
    // Browse/category listings keep hiding delisted products as before.
    let sql = sku ? 'SELECT * FROM products WHERE sku = ?' : 'SELECT * FROM products WHERE inStock = 1';
    const params = sku ? [sku] : [];

    if (region) {
      sql += ' AND region = ?';
      params.push(region);
    }
    if (cat) {
      sql += ' AND category = ?';
      params.push(cat);
    }

    sql += ' ORDER BY id ASC';

    const stmt = db.prepare(sql);
    const { results } = await (params.length
      ? stmt.bind(...params).all()
      : stmt.all()
    );

    // variants is stored as a JSON string ([{image,label}]) — parse it so the
    // client's Array.isArray(p.variants) check works for color swatches.
    for (const row of results) {
      if (typeof row.variants === 'string' && row.variants) {
        try { row.variants = JSON.parse(row.variants); } catch (e) { row.variants = null; }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
