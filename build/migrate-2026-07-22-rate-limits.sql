-- Generic fixed-window rate limiter shared across endpoints — see
-- rateLimitCheck() in functions/api/_lib.js. Replaces the in-memory Map
-- pattern (functions/api/orders/track.js used to use one) which resets
-- unpredictably whenever a Cloudflare Workers isolate recycles.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key   TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
