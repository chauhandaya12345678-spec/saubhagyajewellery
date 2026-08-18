-- Invoicing / finance docs. Additive. Run once per D1 (prod + uat).
-- ALTER ADD COLUMN errors if the column already exists — run statements
-- individually and ignore "duplicate column name" on re-runs.
ALTER TABLE orders ADD COLUMN invoice_no TEXT;
ALTER TABLE orders ADD COLUMN invoice_date TEXT;
ALTER TABLE orders ADD COLUMN credit_note_no TEXT;
ALTER TABLE orders ADD COLUMN credit_note_date TEXT;

-- FY-scoped sequential counters for invoice / credit-note numbers.
CREATE TABLE IF NOT EXISTS doc_counters (
  name    TEXT PRIMARY KEY,   -- e.g. invoice_25-26 / credit_25-26
  next_no INTEGER NOT NULL DEFAULT 0
);
