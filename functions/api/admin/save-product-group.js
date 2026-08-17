/**
 * POST /api/admin/save-product-group
 *
 * Create a product as ONE atomic unit: a single-colour product, OR a
 * multi-colour design where each colour is its own SKU row, all linked by an
 * identical `variants` array.
 *
 * This is what lets a NON-technical employee add any product and get the SEO
 * right automatically. The endpoint — not the person — builds the variants JSON
 * (LEAD colour first; that lead is the canonical every sibling consolidates
 * onto, see functions/_pdp.js `leadSku`), writes the same array to every colour
 * row, and persists a real description so a new product is never thin-content.
 * A single-colour product gets variants = NULL and is its own canonical.
 *
 * Body (JSON):
 *   baseName*    design name, e.g. "Lakshmi Mango Temple Necklace Set"
 *   category*    e.g. "Necklace" / "Earring"
 *   description  shared SEO description (2–3 sentences); written to every row.
 *                Only the lead is indexed (siblings canonicalize to it), so one
 *                shared description is correct.
 *   price*       selling price ₹ (integer, applies to every colour)
 *   mrp, weightGrams, packing_weight_grams, low_stock_threshold
 *   region, regionLabel, city, badge   (sensible defaults)
 *   colours*     [ { label, sku*, nameSuffix, image, stock_count }, ... ]
 *                colours[0] = LEAD / canonical. A single entry = single product.
 *                `label` (short, e.g. "Gold") is required when there is >1 colour.
 *                per-colour name = baseName + " - " + (nameSuffix || label) when
 *                multi; baseName alone when single.
 *
 * All-or-nothing: every row goes in one D1 batch (implicit transaction). If any
 * SKU already exists, or the batch fails, NOTHING is written.
 */
import { verifyAdminAccess, adminCorsHeaders, logEvent } from '../_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Owner-only, to match upload-image + update-inventory (all product/photo
  // mutations are owner-gated). Open to staff later if the shop wants it.
  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const baseName = String(b.baseName || '').trim();
  const category = String(b.category || '').trim();
  const description = String(b.description || '').trim();
  // Optional spec overrides — blank means the product page shows the standard
  // "Zamak alloy" / "high gold-plated" defaults. Set them for oxidised, silver,
  // rose-gold etc.
  const material = String(b.material || '').trim() || null;
  const finish = String(b.finish || '').trim() || null;
  const price = parseInt(b.price, 10);
  const colours = Array.isArray(b.colours) ? b.colours : [];

  if (!baseName || !category || !(price >= 0)) {
    return json({ error: 'baseName, category and a valid price are required' }, 400);
  }
  if (!colours.length) return json({ error: 'At least one colour is required' }, 400);

  const intOr = (v, d) => (v !== undefined && v !== null && v !== '' ? parseInt(v, 10) : d);
  const mrp = intOr(b.mrp, price);
  const weightGrams = intOr(b.weightGrams, null);
  const packing_weight_grams = intOr(b.packing_weight_grams, null);
  const low_stock_threshold = intOr(b.low_stock_threshold, 3);
  const region = String(b.region || 'modern').trim();
  const regionLabel = String(b.regionLabel || 'Modern').trim();
  const city = String(b.city || 'Mumbai').trim();
  const badge = String(b.badge || '').trim();

  const multi = colours.length > 1;

  // ── validate + normalise every colour ──
  const seen = new Set();
  const norm = [];
  for (let i = 0; i < colours.length; i++) {
    const c = colours[i] || {};
    const sku = String(c.sku || '').trim();
    const label = String(c.label || '').trim();
    const image = String(c.image || '').trim();
    const nameSuffix = String(c.nameSuffix || '').trim();
    const stock_count = intOr(c.stock_count, 0);
    if (!sku) return json({ error: `Colour #${i + 1}: SKU is required` }, 400);
    if (!/^[A-Za-z0-9_-]+$/.test(sku)) {
      return json({ error: `SKU "${sku}": only letters, numbers, - and _ allowed` }, 400);
    }
    if (multi && !label) return json({ error: `Colour #${i + 1} (${sku}): a colour name is required` }, 400);
    if (seen.has(sku)) return json({ error: `Duplicate SKU "${sku}" in the request` }, 409);
    seen.add(sku);
    const suffix = nameSuffix || label;
    const name = multi && suffix ? `${baseName} - ${suffix}` : baseName;
    norm.push({ sku, label, image, name, stock_count });
  }

  // variants: lead first, byte-identical on every sibling row; NULL for a
  // single-colour product (which is then its own canonical).
  const variantsJson = multi
    ? JSON.stringify(norm.map(c => ({ sku: c.sku, label: c.label, image: c.image })))
    : null;

  // ── refuse if ANY sku already exists (before writing anything) ──
  try {
    const skus = norm.map(c => c.sku);
    const placeholders = skus.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT sku FROM products WHERE sku IN (${placeholders})`
    ).bind(...skus).all();
    if (results && results.length) {
      return json({ error: `Already exists: ${results.map(r => r.sku).join(', ')}` }, 409);
    }
  } catch (e) { return json({ error: 'DB check failed: ' + (e.message || e) }, 500); }

  // ── atomic insert of every colour row (one D1 batch = one transaction) ──
  const stmt = env.DB.prepare(
    `INSERT INTO products
       (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage,
        inStock, stock_count, weightGrams, packing_weight_grams, low_stock_threshold, variants,
        description, material, finish, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  );
  const batch = norm.map(c => stmt.bind(
    c.sku, c.name, region, regionLabel, category, price, mrp, city, badge, c.image, c.image,
    1, c.stock_count, weightGrams, packing_weight_grams, low_stock_threshold, variantsJson,
    description, material, finish
  ));

  try {
    await env.DB.batch(batch);
    try {
      await logEvent(env.DB, {
        level: 'info', source: 'save-product-group',
        message: `Added ${multi ? `group (${norm.length} colours)` : 'product'} ${norm[0].sku} — ${baseName}`,
        meta: { skus: norm.map(c => c.sku), price, category },
      });
    } catch (e) { /* logging must never fail the write */ }
    return json({ success: true, lead: norm[0].sku, skus: norm.map(c => c.sku), multi }, 200);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
