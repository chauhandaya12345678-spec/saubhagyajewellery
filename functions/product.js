/**
 * Saubhagya — /product route.
 *  • /product?sku=SJ-XX  → 301 redirect to the clean /product/SJ-XX
 *    (consolidates SEO onto one indexable URL; old links + shared cards
 *    keep working). The clean URL is SSR-rendered by functions/product/[sku].js.
 *  • /product (no sku)   → serve the static shell as-is. This is also the
 *    path functions/product/[sku].js subrequests to fetch the shell, so it
 *    must NOT redirect or loop — next() serves product.html directly.
 */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku');

  if (!sku) return next();

  const dest = new URL('/product/' + encodeURIComponent(sku), url.origin);
  return new Response(null, {
    status: 301,
    headers: { Location: dest.toString(), 'Cache-Control': 'public, max-age=86400' },
  });
}
