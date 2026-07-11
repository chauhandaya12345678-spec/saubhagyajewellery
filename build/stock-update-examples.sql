-- ============================================================
-- Saubhagya Jewellery – STOCK UPDATE EXAMPLES
-- ============================================================
-- No deploy needed. Same D1 flow you use for prices.
--
-- Run against remote D1 (production):
--   wrangler d1 execute saubhagya-db --remote --command="<one line here>"
-- or
--   wrangler d1 execute saubhagya-db --remote --file=build/stock-update-examples.sql
--
-- API caches for 60 s (see functions/api/products.js Cache-Control).
-- Change is live within 1 minute. Customer's browser may also cache;
-- catalog.js already busts it with ?t=<timestamp>.
-- ============================================================

-- 1) Mark a SKU OUT OF STOCK — hides it from all product listings,
--    home page, category filters, and search:
UPDATE products SET inStock = 0, updated_at = datetime('now') WHERE sku = 'CC-SI-001';

-- 2) Bring a SKU BACK IN STOCK:
UPDATE products SET inStock = 1, updated_at = datetime('now') WHERE sku = 'CC-SI-001';

-- 3) Show "Only N left — order soon" without hiding the product.
--    The product page already reads stock_count when it exists.
--    First time you use this feature, add the column ONCE (safe re-run):
--    ALTER TABLE products ADD COLUMN stock_count INTEGER;
--    Then set it per SKU:
UPDATE products SET stock_count = 2, inStock = 1, updated_at = datetime('now') WHERE sku = 'CC-SI-011';
UPDATE products SET stock_count = 3, inStock = 1, updated_at = datetime('now') WHERE sku = 'CC-SI-020';

-- 4) Bulk out-of-stock (comma list):
UPDATE products SET inStock = 0, updated_at = datetime('now')
  WHERE sku IN ('CC-SI-001','CC-MM-002','CC-NB-004');

-- 5) See what is currently out of stock:
SELECT sku, name, price FROM products WHERE inStock = 0 ORDER BY sku;

-- 6) See low-stock (only used if you added the stock_count column):
SELECT sku, name, stock_count FROM products WHERE stock_count IS NOT NULL AND stock_count <= 3 ORDER BY stock_count;
