-- ============================================================
-- Migration: persistent addresses table
-- Date: 2026-07-17
-- Purpose: Own address book, decouple from Razorpay/Magic Checkout
--          async delivery. Every checkout captures + stores address
--          BEFORE payment, guaranteeing D1 always has it.
-- Run: wrangler d1 execute saubhagya-db --file=build/migrate-2026-07-17-addresses.sql --remote
--   OR via Cloudflare dashboard → D1 → Console
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,            -- FK to users.id, NULL for pure-guest
  phone         TEXT NOT NULL,      -- normalized 10 digits (index key for guest lookup)
  email         TEXT,
  full_name     TEXT NOT NULL,
  address1      TEXT NOT NULL,      -- House/Flat/Building
  address2      TEXT,               -- Street/Area/Locality
  landmark      TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,      -- 6 digits
  is_default    INTEGER NOT NULL DEFAULT 0,
  label         TEXT,               -- e.g. 'Home', 'Office'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now')),
  usage_count   INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_addresses_phone ON addresses(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_last_used ON addresses(last_used_at DESC);

-- Track which address was used per order (optional but useful for analytics)
-- Only add if column doesn't exist (SQLite < 3.35 has no IF NOT EXISTS on ALTER)
-- Wrapped in a no-op trick: ALTER will error if column exists; migration script
-- ignores it. If you re-run, expect one "duplicate column" error — safe.
ALTER TABLE orders ADD COLUMN address_id INTEGER;
