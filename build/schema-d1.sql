-- ============================================================
-- Saubhagya Jewellery – D1 Products Table Schema
-- ============================================================
-- Created by: migrate-d1.py
-- Run with:   wrangler d1 execute saubhagya-db --file=build/seed-d1.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sku        TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  region     TEXT    NOT NULL,
  regionLabel TEXT   NOT NULL,
  category   TEXT    NOT NULL,
  price      INTEGER NOT NULL,
  mrp        INTEGER NOT NULL,
  city       TEXT    NOT NULL,
  badge      TEXT    NOT NULL DEFAULT '',
  image      TEXT    NOT NULL DEFAULT '',
  altImage   TEXT    NOT NULL DEFAULT '',
  inStock    INTEGER NOT NULL DEFAULT 1,
  stock_count INTEGER,
  weightGrams INTEGER,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_region ON products(region);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_instock ON products(inStock);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
