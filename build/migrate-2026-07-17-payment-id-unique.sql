-- ============================================================
-- Migration: UNIQUE index on orders.razorpay_payment_id
-- Date: 2026-07-17
-- Purpose: Prevent double-INSERT race between save.js and
--          webhook.js when both fire for the same payment.
-- Run: wrangler d1 execute saubhagya-db --file=build/migrate-2026-07-17-payment-id-unique.sql --remote
-- ============================================================

-- Deduplicate any existing dupes (keeps oldest row per payment_id)
DELETE FROM orders
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM orders
  WHERE razorpay_payment_id IS NOT NULL AND razorpay_payment_id != ''
  GROUP BY razorpay_payment_id
)
AND razorpay_payment_id IS NOT NULL AND razorpay_payment_id != '';

-- Create the UNIQUE index (partial: only where payment_id present, so COD/legacy rows unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_id
  ON orders(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL AND razorpay_payment_id != '';
