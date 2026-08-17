-- Saubhagya — data-driven categories.
-- Run once per environment:
--   UAT :  npx wrangler d1 execute saubhagya-db-uat --file=build/migrate-categories.sql --remote
--   PROD:  npx wrangler d1 execute saubhagya-db     --file=build/migrate-categories.sql --remote
-- Idempotent: CREATE IF NOT EXISTS + INSERT OR IGNORE, safe to re-run.
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  banner TEXT,
  subtitle TEXT,
  bgpos TEXT,
  position INTEGER DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO categories (slug, label, banner, subtitle, bgpos, position) VALUES
 ('necklaces',  'Necklace',   'images/models/cat-necklace.webp', 'Short, temple & crystal necklaces', 'center 70%', 10),
 ('earrings',   'Earring',    'images/models/cat-earrings.webp', 'Kundan chandbali & drops',          '',           20),
 ('pendants',   'Pendant',    'images/models/cat-pendant.webp',  'Lakshmi temple pendant mala',       '',           30),
 ('bridal-set', 'Bridal Set', 'images/models/cat-bridal.webp',   'Temple necklace & matching jhumkas','center 55%', 40);
