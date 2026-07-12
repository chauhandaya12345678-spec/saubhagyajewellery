-- ============================================================
-- Saubhagya – Shiprocket retry + error logging
-- Run: wrangler d1 execute saubhagya-db --remote --file=build/migrate-2026-07-12-shiprocket-retry.sql
-- ============================================================

-- Store the last failure reason directly on the order row so admin can see
-- WHY an order didn't push to Shiprocket without digging through logs.
ALTER TABLE orders ADD COLUMN shiprocket_error TEXT;
ALTER TABLE orders ADD COLUMN shiprocket_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shiprocket_last_attempt_at TEXT;

-- Append-only event log for every push attempt (success or failure).
-- Query this when an order is missing from Shiprocket panel.
CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,          -- 'shiprocket_push' | 'shiprocket_retry' | 'email' | 'note'
  ok         INTEGER NOT NULL,       -- 1 success, 0 failure
  detail     TEXT,                    -- error message OR success JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON order_events(kind);
