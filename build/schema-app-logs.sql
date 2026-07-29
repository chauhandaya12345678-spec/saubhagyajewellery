-- Advanced admin log viewer (Kibana-lite) + FCM device registry.
-- Apply:  wrangler d1 execute saubhagya-db-uat --file build/schema-app-logs.sql --remote
--   prod: wrangler d1 execute saubhagya-db     --file build/schema-app-logs.sql --remote

-- Structured, filterable application log. Written by logEvent() in _lib.js.
CREATE TABLE IF NOT EXISTS app_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  level      TEXT NOT NULL DEFAULT 'info',   -- debug | info | warn | error
  source     TEXT NOT NULL DEFAULT 'app',    -- endpoint / module name
  order_id   TEXT,
  request_id TEXT,
  message    TEXT NOT NULL DEFAULT '',
  meta       TEXT                            -- JSON blob (optional)
);
CREATE INDEX IF NOT EXISTS idx_app_logs_ts       ON app_logs (ts);
CREATE INDEX IF NOT EXISTS idx_app_logs_level    ON app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_source   ON app_logs (source);
CREATE INDEX IF NOT EXISTS idx_app_logs_order    ON app_logs (order_id);

-- Registered admin devices for FCM push (new-order alerts).
CREATE TABLE IF NOT EXISTS admin_devices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL UNIQUE,           -- FCM registration token
  username   TEXT,                           -- admin who registered it
  platform   TEXT,                           -- android | ios | web
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_devices_user ON admin_devices (username);
