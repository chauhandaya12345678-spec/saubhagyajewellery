-- Review photos are held for owner approval; the review TEXT still publishes
-- instantly. 'pending' | 'approved' | 'rejected'. Rows with no photo are
-- unaffected (the column is only consulted when image_url is set).
--
-- Run:
--   npx wrangler d1 execute saubhagya-db --remote --file=build/migrate-review-photo-moderation.sql -y
-- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running this errors.
ALTER TABLE reviews ADD COLUMN image_status TEXT DEFAULT 'pending';

-- Anything already carrying a photo predates moderation; leave it hidden
-- until it is explicitly approved.
UPDATE reviews SET image_status = 'pending' WHERE image_url IS NOT NULL AND image_status IS NULL;
