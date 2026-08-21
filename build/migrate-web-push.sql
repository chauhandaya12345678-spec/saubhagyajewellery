-- Customer web push (browser notifications on the storefront).
--
-- UAT:  wrangler d1 execute saubhagya-db-uat --remote --file=build/migrate-web-push.sql
-- LIVE: wrangler d1 execute saubhagya-db     --remote --file=build/migrate-web-push.sql
--
-- Separate from admin_devices, which holds FCM tokens for the owner's Android
-- app. These are W3C Push subscriptions belonging to shoppers.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT NOT NULL UNIQUE,     -- the push service URL; unique per browser install
  p256dh      TEXT NOT NULL,            -- subscription public key
  auth        TEXT NOT NULL,            -- subscription auth secret
  user_id     INTEGER,                  -- set when a signed-in shopper subscribes
  ua          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_ok_at  TEXT,
  fail_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- One row per broadcast. The service worker fetches the newest row on push,
-- which is why the push message itself carries no encrypted payload.
CREATE TABLE IF NOT EXISTS push_broadcasts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  url         TEXT,
  icon        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0
);
