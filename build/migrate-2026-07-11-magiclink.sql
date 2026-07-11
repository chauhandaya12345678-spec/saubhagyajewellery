-- Magic link + password reset table (also stores COD verify tokens by type)
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'reset',      -- 'reset' | 'magiclink' | 'cod_verify'
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(email);
