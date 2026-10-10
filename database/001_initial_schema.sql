-- Sales SUP/ASM Desktop MVP v1.0 | SQLite 3
-- UUID IDs generated in Rust layer, ISO8601 UTC timestamps, ISO business dates (Asia/Ho_Chi_Minh).
-- Monetary values are integer VND; base quantities are integer micros (1e-6 base unit).
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

BEGIN;
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at_utc TEXT NOT NULL
);

CREATE TABLE app_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('SUP','ASM')),
  created_at_utc TEXT NOT NULL
);

CREATE TABLE territories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES territories(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE distributors (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  territory_id TEXT REFERENCES territories(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_distributors_territory ON distributors(territory_id);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('REP','SUP','ASM')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE employee_distributor_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(employee_id,distributor_id,effective_from)
);
CREATE INDEX idx_employee_assignments_lookup ON employee_distributor_assignments(distributor_id,effective_from,effective_to);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(distributor_id,code)
);

CREATE TABLE outlets (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  route_id TEXT REFERENCES routes(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(distributor_id,code)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  base_unit TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

-- NPP-specific code + package conversion, with temporal validity and explicit mappings.
CREATE TABLE sku_aliases (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  raw_sku_code TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  raw_unit TEXT NOT NULL,
  -- actual base qty = raw_qty * conversion_num / conversion_den
  conversion_num INTEGER NOT NULL CHECK(conversion_num > 0),
  conversion_den INTEGER NOT NULL CHECK(conversion_den > 0),
  effective_from TEXT NOT NULL DEFAULT '1900-01-01',
  effective_to TEXT,
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(distributor_id, raw_sku_code, raw_unit, effective_from)
);
CREATE INDEX idx_alias_mapping ON sku_aliases(distributor_id,raw_sku_code,raw_unit,effective_from);

CREATE TABLE import_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('SALES_IN','SALES_OUT','XNT','TARGET','NPP','SKU','EMPLOYEE','OUTLET')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  mapping_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

-- A batch corresponds to ONE NPP + ONE data kind + ONE exact reporting period.
-- For files covering many NPPs, split into multiple batches sharing source_file_sha256.
CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('SALES_IN','SALES_OUT','XNT','TARGET','NPP','SKU','EMPLOYEE','OUTLET')),
  distributor_id TEXT REFERENCES distributors(id),
  period_from TEXT,
  period_to TEXT,
  granularity TEXT NOT NULL DEFAULT 'TRANSACTION' CHECK(granularity IN ('TRANSACTION','DAILY_SUMMARY','PERIOD_SNAPSHOT','MASTER')),
  source_file_name TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  source_sheet TEXT,
  import_profile_id TEXT REFERENCES import_profiles(id),
  status TEXT NOT NULL DEFAULT 'STAGED' CHECK(status IN ('STAGED','VALIDATED','COMMITTED','REJECTED','SUPERSEDED')),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  supersedes_batch_id TEXT REFERENCES import_batches(id),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK(total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK(valid_rows >= 0),
  error_rows INTEGER NOT NULL DEFAULT 0 CHECK(error_rows >= 0),
  imported_at_utc TEXT NOT NULL,
  committed_at_utc TEXT,
  archive_relpath TEXT,
  CHECK(period_from IS NULL OR period_to IS NULL OR period_to >= period_from),
  CHECK(active = 0 OR status = 'COMMITTED')
);
-- Prevent two active revisions for exactly the same dataset slot.
CREATE UNIQUE INDEX ux_active_import_slot ON import_batches(kind,distributor_id,period_from,period_to)
 WHERE active = 1 AND distributor_id IS NOT NULL AND period_from IS NOT NULL AND period_to IS NOT NULL;
CREATE INDEX idx_import_batches_status ON import_batches(kind,status,active,period_to);
CREATE INDEX idx_import_batches_file ON import_batches(source_file_sha256);

CREATE TABLE import_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  sheet_name TEXT,
  source_row INTEGER,
  column_name TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('ERROR','WARNING')),
  issue_code TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE INDEX idx_import_issues_batch ON import_issues(batch_id,severity,source_row);

CREATE TABLE sales_in_facts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  business_date TEXT NOT NULL,
  document_no TEXT,
  document_line_no TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('INVOICE','RETURN')),
  quantity_micro INTEGER NOT NULL,
  net_amount_vnd INTEGER NOT NULL,
  source_row INTEGER NOT NULL CHECK(source_row >= 2),
  UNIQUE(batch_id, source_row),
  CHECK ((kind = 'INVOICE' AND quantity_micro >= 0 AND net_amount_vnd >= 0)
      OR (kind = 'RETURN' AND quantity_micro <= 0 AND net_amount_vnd <= 0))
);
CREATE INDEX idx_si_dim ON sales_in_facts(distributor_id,business_date,product_id);

CREATE TABLE sales_out_facts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  employee_id TEXT REFERENCES employees(id),
  route_id TEXT REFERENCES routes(id),
  outlet_id TEXT REFERENCES outlets(id),
  business_date TEXT NOT NULL,
  document_no TEXT,
  document_line_no TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('DELIVERED','RETURN')),
  quantity_micro INTEGER NOT NULL,
  net_amount_vnd INTEGER NOT NULL,
  source_row INTEGER NOT NULL CHECK(source_row >= 2),
  UNIQUE(batch_id, source_row),
  CHECK ((kind = 'DELIVERED' AND quantity_micro >= 0 AND net_amount_vnd >= 0)
      OR (kind = 'RETURN' AND quantity_micro <= 0 AND net_amount_vnd <= 0))
);
CREATE INDEX idx_so_dim ON sales_out_facts(distributor_id,business_date,product_id,employee_id);
CREATE INDEX idx_so_outlet ON sales_out_facts(outlet_id,business_date);

-- Period XNT is a snapshot/statement; rows must NOT be summed across periods.
CREATE TABLE inventory_period_facts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  opening_micro INTEGER NOT NULL CHECK(opening_micro >= 0),
  receipts_micro INTEGER NOT NULL CHECK(receipts_micro >= 0),
  issues_micro INTEGER NOT NULL CHECK(issues_micro >= 0),
  adjustments_micro INTEGER NOT NULL DEFAULT 0,
  closing_micro INTEGER NOT NULL CHECK(closing_micro >= 0),
  source_row INTEGER NOT NULL CHECK(source_row >= 2),
  UNIQUE(batch_id,source_row),
  UNIQUE(batch_id,distributor_id,product_id,period_from,period_to),
  CHECK(period_to >= period_from)
);
CREATE INDEX idx_xnt_dim ON inventory_period_facts(distributor_id,period_to,product_id);

-- Month must be yyyy-mm-01; 'scope' is explicit to avoid target double counting.
CREATE TABLE target_facts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  month_start TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('SALES_IN','SALES_OUT')),
  scope TEXT NOT NULL CHECK(scope IN ('NPP','REP')),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  employee_id TEXT REFERENCES employees(id),
  target_vnd INTEGER NOT NULL CHECK(target_vnd >= 0),
  source_row INTEGER NOT NULL CHECK(source_row >= 2),
  UNIQUE(batch_id,source_row),
  CHECK(substr(month_start,9,2) = '01'),
  CHECK((scope = 'NPP' AND employee_id IS NULL) OR (scope = 'REP' AND employee_id IS NOT NULL))
);
CREATE UNIQUE INDEX ux_targets_scoped ON target_facts(batch_id,month_start,metric,scope,distributor_id,COALESCE(employee_id,''));

CREATE TABLE period_closures (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  closed_at_utc TEXT NOT NULL,
  reopened_at_utc TEXT,
  reopen_reason TEXT,
  CHECK(period_to >= period_from),
  UNIQUE(distributor_id,period_from,period_to)
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_profile_id TEXT REFERENCES app_profiles(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_audit_at ON audit_events(created_at_utc,event_type);

-- Read models: ALWAYS filter for active committed batches.
CREATE VIEW v_active_sales_in AS
SELECT f.* FROM sales_in_facts f JOIN import_batches b ON b.id = f.batch_id
 WHERE b.active = 1 AND b.status = 'COMMITTED' AND b.kind = 'SALES_IN';
CREATE VIEW v_active_sales_out AS
SELECT f.* FROM sales_out_facts f JOIN import_batches b ON b.id = f.batch_id
 WHERE b.active = 1 AND b.status = 'COMMITTED' AND b.kind = 'SALES_OUT';
CREATE VIEW v_active_inventory_period AS
SELECT f.*,
  (f.opening_micro + f.receipts_micro - f.issues_micro + f.adjustments_micro - f.closing_micro) AS reconciliation_variance_micro
FROM inventory_period_facts f JOIN import_batches b ON b.id = f.batch_id
 WHERE b.active = 1 AND b.status = 'COMMITTED' AND b.kind = 'XNT';
CREATE VIEW v_active_targets AS
SELECT f.* FROM target_facts f JOIN import_batches b ON b.id = f.batch_id
 WHERE b.active = 1 AND b.status = 'COMMITTED' AND b.kind = 'TARGET';

COMMIT;
