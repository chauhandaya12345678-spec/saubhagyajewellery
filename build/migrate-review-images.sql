-- Customer review photos: reviews.image_url + the newest-first index the
-- homepage feed (GET /api/reviews?latest=1) orders by.
-- Run once on remote:
--   npx wrangler d1 execute saubhagya-db --remote --file=build/migrate-review-images.sql
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS" — re-running this file errors
-- with "duplicate column name: image_url". That's expected; run it once.
ALTER TABLE reviews ADD COLUMN image_url TEXT;
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
