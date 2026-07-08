-- ============================================================
-- Saubhagya Jewellery – Users, Orders, Sessions Tables
-- ============================================================
-- Run: wrangler d1 execute saubhagya-db --file=build/schema-auth-orders.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT,
  phone      TEXT,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,  -- hashed with simple hash for now
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS orders (
  id        TEXT PRIMARY KEY,  -- e.g. "CC-20260627-A7X3"
  user_id   INTEGER,
  email     TEXT,
  phone     TEXT,
  name      TEXT,
  items     TEXT NOT NULL,     -- JSON array
  total     INTEGER NOT NULL,  -- in paise
  subtotal  INTEGER NOT NULL,
  discount  INTEGER DEFAULT 0,
  address   TEXT NOT NULL,     -- JSON
  razorpay_payment_id TEXT,
  status    TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed|processing|shipped|delivered|cancelled
  awb       TEXT DEFAULT '',
  awb_url   TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

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
