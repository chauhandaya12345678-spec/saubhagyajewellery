-- Sign-in OTP (WhatsApp-delivered, Turnstile-gated) replaces Firebase Phone Auth.
-- Separate from order_otps (COD email-OTP) — different purpose, different channel.
CREATE TABLE IF NOT EXISTS login_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_otps_phone ON login_otps(phone);
