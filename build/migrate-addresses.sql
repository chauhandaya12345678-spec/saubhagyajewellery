-- Address book table — matches functions/api/addresses/{save,list}.js exactly.
-- Additive + idempotent. Run once on remote:
--   npx wrangler d1 execute saubhagya-db --remote --file=build/migrate-addresses.sql
CREATE TABLE IF NOT EXISTS addresses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  phone        TEXT NOT NULL,
  email        TEXT,
  full_name    TEXT NOT NULL,
  address1     TEXT NOT NULL,
  address2     TEXT,
  landmark     TEXT,
  city         TEXT,
  state        TEXT,
  pincode      TEXT,
  is_default   INTEGER NOT NULL DEFAULT 0,
  label        TEXT,
  usage_count  INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_phone ON addresses(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user  ON addresses(user_id);
