-- ============================================================
-- Saubhagya Jewellery – Inventory columns migration
-- ============================================================
-- Adds stock_count + weightGrams to products for the low-stock
-- label ("Only N left") and per-product shipping weight.
-- SQLite has no "ADD COLUMN IF NOT EXISTS" — check first with:
--   wrangler d1 execute saubhagya-db --remote --command="PRAGMA table_info(products);"
-- then run whichever ALTER lines are still missing.
-- ============================================================

ALTER TABLE products ADD COLUMN stock_count INTEGER;
ALTER TABLE products ADD COLUMN weightGrams INTEGER;
