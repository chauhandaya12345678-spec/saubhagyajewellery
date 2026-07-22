-- Named admin accounts with roles, so the raw ADMIN_KEY doesn't have to be
-- the only way in. 'owner' = full access (same as the ADMIN_KEY). 'staff' =
-- read-only: can view orders/inventory/customers, export CSV, print packing
-- slips, but cannot edit stock/price or mark orders packed.
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  role       TEXT NOT NULL,
  username   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
