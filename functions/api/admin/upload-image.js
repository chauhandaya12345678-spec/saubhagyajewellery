/**
 * POST /api/admin/upload-image   (owner only)
 * Multipart form-data:
 *   file : the image (webp/jpg/png)
 *   sku  : (optional) e.g. SJ-SN06-GL  → stored as products/SJ-SN06-GL.webp
 *   key  : (optional) explicit R2 key/path (overrides sku)
 *
 * Uploads straight to the R2 bucket (IMAGES binding) so new product photos go
 * live with NO git push / deploy. Returns the public URL to paste into a
 * product's image field (or wire directly into the inventory row).
 *
 * Public base = env.R2_PUBLIC_BASE or https://img.saubhagyajewellery.com
 * Header: x-admin-key: <ADMIN_KEY>  (or an owner session)
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

const PUBLIC_BASE_DEFAULT = 'https://img.saubhagyajewellery.com';
const ALLOWED = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/avif': '.avif' };

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  if (!env.IMAGES) return json({ error: 'R2 bucket (IMAGES) not bound' }, 501);

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Expected multipart/form-data' }, 400); }

  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'file field required' }, 400);

  const ct = file.type || 'application/octet-stream';
  const ext = ALLOWED[ct];
  if (!ext) return json({ error: 'Unsupported type ' + ct + ' (use webp/jpg/png/avif)' }, 415);

  // 8 MB cap — product photos should be well under this.
  const buf = await file.arrayBuffer();
  if (buf.byteLength > 8 * 1024 * 1024) return json({ error: 'File too large (max 8 MB)' }, 413);

  // Resolve the R2 key. `key` may contain slashes (a path); sku/filename may not.
  const clean = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '');
  const cleanKey = (s) => String(s || '').replace(/[^A-Za-z0-9._/-]/g, '');
  let key = cleanKey(form.get('key'));
  if (!key) {
    const sku = clean(form.get('sku'));
    // SEO filename: derive a keyword slug from the product NAME and keep the
    // SKU as a suffix so the object stays uniquely findable and the SKU (the
    // real identifier) never changes. e.g. "Kundan Bridal Choker" + SJ-KC01
    // -> products/kundan-bridal-choker-SJ-KC01.webp. Falls back to bare SKU
    // when no name is supplied (e.g. the standalone upload button).
    const slug = String(form.get('name') || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')   // spaces/punct -> hyphen
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .split('-').slice(0, 6).join('-'); // cap length, keep it readable
    if (sku && slug) key = 'products/' + slug + '-' + sku + ext;
    else if (sku) key = 'products/' + sku + ext;
    else {
      const orig = clean(file.name) || ('upload-' + Date.now() + ext);
      key = 'products/' + orig;
    }
  }
  // Never allow escaping the bucket root.
  key = key.replace(/^\/+/, '').replace(/\.\.+/g, '');

  try {
    await env.IMAGES.put(key, buf, { httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' } });
  } catch (err) {
    return json({ error: 'R2 put failed: ' + (err.message || err) }, 500);
  }

  const base = (env.R2_PUBLIC_BASE || PUBLIC_BASE_DEFAULT).replace(/\/+$/, '');
  // Cache-bust. Replacing a photo re-uses the SAME R2 key (same name slug +
  // same SKU), so the public URL came back byte-identical to the one already
  // stored — and R2 serves it with a one-year immutable cache-control. The new
  // bytes were in the bucket but every browser and the CDN kept showing the old
  // picture, which is what "replace main photo does nothing" actually was.
  // A per-upload version makes each replacement a genuinely new URL.
  const v = Date.now().toString(36);
  return json({ success: true, key, url: base + '/' + key + '?v=' + v, bytes: buf.byteLength, contentType: ct });
}
