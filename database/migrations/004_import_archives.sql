-- M2.3 additive archive: preserve source evidence atomically with activated facts.
CREATE TABLE imported_file_archives (
  sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64),
  original_name TEXT NOT NULL,
  file_bytes BLOB NOT NULL,
  saved_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_import_batches_archive ON import_batches(source_file_sha256);
