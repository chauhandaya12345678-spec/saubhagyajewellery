/**
 * POST /api/admin/add-product — create a NEW product row in D1.
 * (update-inventory only edits existing rows; this inserts.)
 *
 * Body (JSON):
 *   sku*        unique code, e.g. "SJ-SN02-RD"
 *   name*       display name
 *   price*      selling price in ₹ (integer)
 *   category*   e.g. "Necklace" / "Earring"
 *   mrp         original price ₹ (defaults to price)
 *   image       photo URL (from /api/admin/upload-image)
 *   weightGrams, packing_weight_grams, stock_count, low_stock_threshold
 *   region, regionLabel, city, badge, altImage, inStock, variants (sensible defaults)
 *
 * Refuses if the SKU already exists (won't overwrite).
 */
import { verifyAdminAccess, adminCorsHeaders, logEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: false });
  if (auth.response) return auth.response;

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, cors); }

  const sku = String(b.sku || '').trim();
  const name = String(b.name || '').trim();
  const category = String(b.category || '').trim();
  const price = parseInt(b.price, 10);
  if (!sku || !name || !category || !(price >= 0)) {
    return json({ error: 'sku, name, category and a valid price are required' }, 400, cors);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(sku)) {
    return json({ error: 'SKU can only contain letters, numbers, - and _' }, 400, cors);
  }

  // Never overwrite an existing product.
  const dupe = await env.DB.prepare('SELECT sku FROM products WHERE sku = ?').bind(sku).first().catch(() => null);
  if (dupe) return json({ error: `A product with SKU "${sku}" already exists` }, 409, cors);

  const intOr = (v, d) => (v !== undefined && v !== null && v !== '' ? parseInt(v, 10) : d);
  const mrp = intOr(b.mrp, price);
  const region = String(b.region || 'modern').trim();
  const regionLabel = String(b.regionLabel || 'Modern').trim();
  const city = String(b.city || 'Mumbai').trim();
  const badge = String(b.badge || '').trim();
  const image = String(b.image || '').trim();
  const altImage = String(b.altImage || image || '').trim();
  const inStock = (b.inStock === 0 || b.inStock === '0' || b.inStock === false) ? 0 : 1;
  const stock_count = intOr(b.stock_count, 0);
  const weightGrams = intOr(b.weightGrams, null);
  const packing_weight_grams = intOr(b.packing_weight_grams, null);
  const low_stock_threshold = intOr(b.low_stock_threshold, 3);
  const variants = b.variants ? (typeof b.variants === 'string' ? b.variants : JSON.stringify(b.variants)) : null;

  try {
    await env.DB.prepare(
      `INSERT INTO products
         (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage,
          inStock, stock_count, weightGrams, packing_weight_grams, low_stock_threshold, variants,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage,
           inStock, stock_count, weightGrams, packing_weight_grams, low_stock_threshold, variants).run();

    try { await logEvent(env.DB, { level: 'info', source: 'add-product', message: `Added ${sku} — ${name}`, meta: { price, category, stock_count } }); } catch (e) {}
    return json({ success: true, sku }, 200, cors);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500, cors);
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200, headers: { 'Content-Type': 'application/json', ...cors },
  });
}
