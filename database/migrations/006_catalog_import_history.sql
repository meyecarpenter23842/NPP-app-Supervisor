-- P2: traceable, idempotent catalog and reference-price Excel imports.
-- Additive only; do not rewrite legacy facts or migrations 001-005.
CREATE TABLE catalog_import_runs (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  content_sha256 TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('CATEGORY','BRAND','UNIT_CATALOG','FAMILY','SKU','CONVERSION','ALIAS','PRICE')),
  distributor_id TEXT REFERENCES distributors(id),
  price_list_id TEXT REFERENCES price_lists(id),
  source_file_name TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  total_rows INTEGER NOT NULL CHECK(total_rows>=0),
  inserted_rows INTEGER NOT NULL CHECK(inserted_rows>=0),
  unchanged_rows INTEGER NOT NULL CHECK(unchanged_rows>=0),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_catalog_import_time ON catalog_import_runs(created_at_utc DESC);

CREATE TABLE catalog_import_row_events (
  run_id TEXT NOT NULL REFERENCES catalog_import_runs(id),
  excel_row INTEGER NOT NULL CHECK(excel_row>0),
  action TEXT NOT NULL CHECK(action IN ('ADDED','UNCHANGED')),
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  PRIMARY KEY(run_id,excel_row)
);
