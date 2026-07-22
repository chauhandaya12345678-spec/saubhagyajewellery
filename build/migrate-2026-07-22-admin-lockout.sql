-- Per-IP lockout tracking for /api/admin/* key checks — see verifyAdminKey() in functions/api/_lib.js
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
