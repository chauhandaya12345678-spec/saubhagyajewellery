-- ============================================================
-- Saubhagya Jewellery – July 2026 migration
-- Creates auth/order tables (if missing), wishlist + reviews
-- tables (previously had no schema at all), and adds Shiprocket
-- + payment columns to orders.
--
-- Run once:
--   wrangler d1 execute saubhagya-db --remote --file=build/migrate-2026-07-orders-shiprocket.sql
-- The ALTER TABLE lines error harmlessly ("duplicate column") if re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT,
  phone      TEXT,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,  -- "s256$<salt>$<hash>" (legacy rows may be plaintext until next login)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS orders (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER,
  email     TEXT,
  phone     TEXT,
  name      TEXT,
  items     TEXT NOT NULL,
  total     INTEGER NOT NULL,
  subtotal  INTEGER NOT NULL,
  discount  INTEGER DEFAULT 0,
  address   TEXT NOT NULL,
  razorpay_payment_id TEXT,
  status    TEXT NOT NULL DEFAULT 'confirmed',
  awb       TEXT DEFAULT '',
  awb_url   TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(razorpay_payment_id);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  email      TEXT,
  name       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS wishlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  product_sku TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_sku)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_sku TEXT NOT NULL,
  user_id     INTEGER,
  name        TEXT NOT NULL,
  rating      INTEGER NOT NULL,
  review_text TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_sku ON reviews(product_sku);

-- New columns for Shiprocket + payment audit (error if already added: fine)
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'razorpay';
ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT;
ALTER TABLE orders ADD COLUMN shiprocket_order_id TEXT;
ALTER TABLE orders ADD COLUMN shiprocket_shipment_id TEXT;
ALTER TABLE orders ADD COLUMN test_mode INTEGER DEFAULT 0;

-- Guest accounts auto-created at checkout; signup with same email/phone claims them
ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0;
UPDATE users SET is_guest = 1 WHERE password LIKE 'guest_%';
