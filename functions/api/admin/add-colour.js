/**
 * POST /api/admin/add-colour  (owner only)
 *
 * Append ONE colour to a design that already exists — the missing half of the
 * product builder. Works whether the target is currently single-colour or
 * already multi-colour.
 *
 * Body (JSON):
 *   leadSku*            the design's lead/canonical SKU (an existing product row)
 *   leadLabel          colour name for the EXISTING product — required only when
 *                      the design is still single-colour (variants is null), so
 *                      the switcher can label it
 *   colour*: { label*, sku*, nameSuffix?, image*, stock_count? }
 *
 * It rebuilds the shared `variants` array (lead first) and writes it to every
 * sibling row plus the new one, in a single atomic D1 batch — the same shape
 * save-product-group produces, so the colour switcher, listing de-duplication
 * and canonical consolidation all keep working.
 */
import { verifyAdminAccess, adminCorsHeaders, logEvent } from '../_lib.js';

function parseVariants(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { return JSON.parse(v); } catch (e) { return null; } }
  return null;
}
function stripSuffix(name, label) {
  const suf = ' - ' + label;
  return (label && name.endsWith(suf)) ? name.slice(0, -suf.length) : name;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const leadSku = String(b.leadSku || '').trim();
  const c = b.colour || {};
  const newSku = String(c.sku || '').trim();
  const newLabel = String(c.label || '').trim();
  const newImage = String(c.image || '').trim();
  const nameSuffix = String(c.nameSuffix || '').trim();
  const stock_count = (c.stock_count !== undefined && c.stock_count !== '' && c.stock_count !== null) ? parseInt(c.stock_count, 10) : 0;

  if (!leadSku) return json({ error: 'leadSku is required' }, 400);
  if (!newSku) return json({ error: 'New colour SKU is required' }, 400);
  if (!/^[A-Za-z0-9_-]+$/.test(newSku)) return json({ error: `SKU "${newSku}": only letters, numbers, - and _ allowed` }, 400);
  if (!newLabel) return json({ error: 'New colour name is required' }, 400);
  if (!newImage) return json({ error: 'A photo for the new colour is required' }, 400);

  try {
    const lead = await env.DB.prepare('SELECT * FROM products WHERE sku = ?').bind(leadSku).first();
    if (!lead) return json({ error: `Lead product "${leadSku}" not found` }, 404);

    const exists = await env.DB.prepare('SELECT sku FROM products WHERE sku = ?').bind(newSku).first();
    if (exists) return json({ error: `SKU "${newSku}" already exists` }, 409);

    let variants = parseVariants(lead.variants);
    let baseName, newVariants, affectedSkus;

    if (Array.isArray(variants) && variants.length) {
      // Already a multi-colour design: the row we were given must be the lead.
      if (variants[0].sku !== leadSku) {
        return json({ error: `Use the design's LEAD sku (${variants[0].sku}), not a colour sibling` }, 400);
      }
      baseName = stripSuffix(lead.name, variants[0].label);
      newVariants = variants.concat([{ sku: newSku, label: newLabel, image: newImage }]);
      affectedSkus = variants.map(v => v.sku);
    } else {
      // Single-colour → convert to a group. Need a colour name for the existing one.
      const leadLabel = String(b.leadLabel || '').trim();
      if (!leadLabel) return json({ error: 'This product has no colour yet — send leadLabel (the existing colour name)' }, 400);
      baseName = lead.name;
      newVariants = [
        { sku: leadSku, label: leadLabel, image: lead.image },
        { sku: newSku, label: newLabel, image: newImage },
      ];
      affectedSkus = [leadSku];
    }

    const newName = baseName + ' - ' + (nameSuffix || newLabel);
    const vjson = JSON.stringify(newVariants);

    const insert = env.DB.prepare(
      `INSERT INTO products
         (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage,
          inStock, stock_count, weightGrams, packing_weight_grams, low_stock_threshold, variants,
          description, material, finish, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      newSku, newName, lead.region, lead.regionLabel, lead.category, lead.price, lead.mrp, lead.city, lead.badge || '',
      newImage, newImage, 1, stock_count, lead.weightGrams, lead.packing_weight_grams,
      lead.low_stock_threshold != null ? lead.low_stock_threshold : 3, vjson,
      lead.description || '', lead.material || null, lead.finish || null
    );

    const updates = affectedSkus.map(s =>
      env.DB.prepare('UPDATE products SET variants = ?, updated_at = datetime(\'now\') WHERE sku = ?').bind(vjson, s)
    );

    await env.DB.batch([insert, ...updates]);
    try {
      await logEvent(env.DB, {
        level: 'info', source: 'add-colour',
        message: `Added colour ${newSku} (${newLabel}) to design ${leadSku}`,
        meta: { leadSku, newSku, colours: newVariants.length },
      });
    } catch (e) { /* logging must not fail the write */ }

    return json({ success: true, lead: leadSku, newSku, name: newName, colours: newVariants.length });
  } catch (e) {
    const msg = /UNIQUE/i.test(String(e.message)) ? 'That SKU is already in use' : String(e.message || e);
    return json({ error: msg }, 400);
  }
}
