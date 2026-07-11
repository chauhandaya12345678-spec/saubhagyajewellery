-- ============================================================
-- Saubhagya Jewellery – WIPE TEST USER DATA
-- ============================================================
-- Deletes every account, session, order, and reset/magic-link
-- token so the site is fresh for real customers.
--
-- Products, prices, images, reviews are NOT touched.
--
-- Run against remote D1 (production):
--   wrangler d1 execute saubhagya-db --remote --file=build/wipe-test-users.sql
--
-- Run against local dev D1:
--   wrangler d1 execute saubhagya-db --local  --file=build/wipe-test-users.sql
-- ============================================================

DELETE FROM password_resets;
DELETE FROM sessions;
DELETE FROM orders;
DELETE FROM users;

-- Reset AUTOINCREMENT counters so new user/session ids start at 1 again.
DELETE FROM sqlite_sequence WHERE name IN ('users','sessions','password_resets');
