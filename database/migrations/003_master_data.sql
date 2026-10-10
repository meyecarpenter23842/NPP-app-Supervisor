-- M2.1 additive master-data schema. Never rewrite canonical SKU IDs or imported facts.
-- 001/002 are immutable; 003 is applied atomically by the Rust migration runner.
CREATE TABLE product_families (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  category TEXT,
  brand TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(length(trim(code)) > 0)
);

-- products.id already identifies an individual SKU in legacy facts and sku_aliases.
ALTER TABLE products ADD COLUMN product_family_id TEXT REFERENCES product_families(id);
CREATE INDEX idx_sku_family ON products(product_family_id,active,sku_code);

-- An SKU can be entered as a base or packaging unit; do not infer a separate
-- selling SKU from an NPP's raw packaging unit.
CREATE TABLE sku_unit_conversions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_code TEXT NOT NULL CHECK(length(trim(unit_code)) > 0),
  conversion_num INTEGER NOT NULL CHECK(conversion_num > 0),
  conversion_den INTEGER NOT NULL CHECK(conversion_den > 0),
  UNIQUE(product_id,unit_code)
);
INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
SELECT 'base:'||id,id,base_unit,1,1 FROM products;

-- External employee code is scoped to distributor AND business date.
CREATE TABLE employee_code_aliases (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  raw_employee_code TEXT NOT NULL CHECK(length(trim(raw_employee_code)) > 0),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  effective_from TEXT NOT NULL CHECK(length(effective_from)=10 AND date(effective_from) IS NOT NULL),
  effective_to TEXT CHECK(effective_to IS NULL OR (length(effective_to)=10 AND date(effective_to) IS NOT NULL)),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(distributor_id,raw_employee_code,effective_from)
);
CREATE INDEX idx_employee_alias_date ON employee_code_aliases(distributor_id,raw_employee_code,effective_from,effective_to);

-- Historic manager relationships cannot retroactively rewrite earlier sales.
CREATE TABLE employee_hierarchy_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  manager_employee_id TEXT NOT NULL REFERENCES employees(id),
  effective_from TEXT NOT NULL CHECK(length(effective_from)=10 AND date(effective_from) IS NOT NULL),
  effective_to TEXT CHECK(effective_to IS NULL OR (length(effective_to)=10 AND date(effective_to) IS NOT NULL)),
  CHECK(employee_id <> manager_employee_id),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(employee_id,effective_from)
);
CREATE INDEX idx_hierarchy_child_dates ON employee_hierarchy_assignments(employee_id,effective_from,effective_to);
CREATE INDEX idx_hierarchy_manager_dates ON employee_hierarchy_assignments(manager_employee_id,effective_from,effective_to);

-- Route belongs to a single NPP; allow the employee to serve multiple NPPs.
CREATE TABLE employee_route_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  route_id TEXT NOT NULL REFERENCES routes(id),
  effective_from TEXT NOT NULL CHECK(length(effective_from)=10 AND date(effective_from) IS NOT NULL),
  effective_to TEXT CHECK(effective_to IS NULL OR (length(effective_to)=10 AND date(effective_to) IS NOT NULL)),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(employee_id,route_id,effective_from)
);
CREATE INDEX idx_employee_route_dates ON employee_route_assignments(employee_id,distributor_id,effective_from,effective_to);

-- Keep the legacy append-only audit_events table; actor is singleton local_operator.

CREATE TRIGGER employee_alias_no_overlap_insert BEFORE INSERT ON employee_code_aliases
WHEN EXISTS (
  SELECT 1 FROM employee_code_aliases a
  WHERE a.distributor_id=NEW.distributor_id AND a.raw_employee_code=NEW.raw_employee_code
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'employee alias overlaps'); END;

CREATE TRIGGER employee_alias_no_overlap_update BEFORE UPDATE ON employee_code_aliases
WHEN EXISTS (
  SELECT 1 FROM employee_code_aliases a
  WHERE a.id<>OLD.id AND a.distributor_id=NEW.distributor_id AND a.raw_employee_code=NEW.raw_employee_code
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'employee alias overlaps'); END;

CREATE TRIGGER sku_alias_no_overlap_insert BEFORE INSERT ON sku_aliases
WHEN EXISTS (
  SELECT 1 FROM sku_aliases a
  WHERE a.distributor_id=NEW.distributor_id AND a.raw_sku_code=NEW.raw_sku_code AND a.raw_unit=NEW.raw_unit
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'SKU alias overlaps'); END;

CREATE TRIGGER sku_alias_no_overlap_update BEFORE UPDATE ON sku_aliases
WHEN EXISTS (
  SELECT 1 FROM sku_aliases a
  WHERE a.id<>OLD.id AND a.distributor_id=NEW.distributor_id AND a.raw_sku_code=NEW.raw_sku_code AND a.raw_unit=NEW.raw_unit
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'SKU alias overlaps'); END;

CREATE TRIGGER employee_npp_no_overlap_insert BEFORE INSERT ON employee_distributor_assignments
WHEN EXISTS (
  SELECT 1 FROM employee_distributor_assignments a
  WHERE a.employee_id=NEW.employee_id AND a.distributor_id=NEW.distributor_id
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'employee NPP assignment overlaps'); END;

CREATE TRIGGER employee_npp_no_overlap_update BEFORE UPDATE ON employee_distributor_assignments
WHEN EXISTS (
  SELECT 1 FROM employee_distributor_assignments a
  WHERE a.id<>OLD.id AND a.employee_id=NEW.employee_id AND a.distributor_id=NEW.distributor_id
    AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'employee NPP assignment overlaps'); END;

-- Validate NPP relationship and time-bounded duplicate route membership.
CREATE TRIGGER route_assignment_guard_insert BEFORE INSERT ON employee_route_assignments
BEGIN
  SELECT RAISE(ABORT,'route belongs to a different NPP')
    WHERE NOT EXISTS(SELECT 1 FROM routes r WHERE r.id=NEW.route_id AND r.distributor_id=NEW.distributor_id);
  SELECT RAISE(ABORT,'route assignment overlaps')
    WHERE EXISTS(SELECT 1 FROM employee_route_assignments a
      WHERE a.employee_id=NEW.employee_id AND a.route_id=NEW.route_id
        AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
        AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31'));
END;
CREATE TRIGGER route_assignment_guard_update BEFORE UPDATE ON employee_route_assignments
BEGIN
  SELECT RAISE(ABORT,'route belongs to a different NPP')
    WHERE NOT EXISTS(SELECT 1 FROM routes r WHERE r.id=NEW.route_id AND r.distributor_id=NEW.distributor_id);
  SELECT RAISE(ABORT,'route assignment overlaps')
    WHERE EXISTS(SELECT 1 FROM employee_route_assignments a
      WHERE a.id<>OLD.id AND a.employee_id=NEW.employee_id AND a.route_id=NEW.route_id
        AND a.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
        AND NEW.effective_from<=COALESCE(a.effective_to,'9999-12-31'));
END;

-- Recursive temporal interval intersection detects cycles even if each link
-- is valid for a different period; only paths intersecting NEW's period matter.
CREATE TRIGGER employee_hierarchy_guard_insert BEFORE INSERT ON employee_hierarchy_assignments
BEGIN
  SELECT RAISE(ABORT,'manager assignment overlaps')
    WHERE EXISTS(SELECT 1 FROM employee_hierarchy_assignments h
      WHERE h.employee_id=NEW.employee_id
        AND h.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
        AND NEW.effective_from<=COALESCE(h.effective_to,'9999-12-31'));
  SELECT RAISE(ABORT,'manager hierarchy cycle') WHERE EXISTS (
    WITH RECURSIVE chain(person,lo,hi) AS (
      SELECT NEW.manager_employee_id,NEW.effective_from,COALESCE(NEW.effective_to,'9999-12-31')
      UNION ALL
      SELECT h.manager_employee_id,
        MAX(h.effective_from,chain.lo),
        MIN(COALESCE(h.effective_to,'9999-12-31'),chain.hi)
      FROM chain JOIN employee_hierarchy_assignments h ON h.employee_id=chain.person
      WHERE h.effective_from<=chain.hi AND chain.lo<=COALESCE(h.effective_to,'9999-12-31')
    )
    SELECT 1 FROM chain WHERE person=NEW.employee_id
  );
END;

CREATE TRIGGER employee_hierarchy_guard_update BEFORE UPDATE ON employee_hierarchy_assignments
BEGIN
  SELECT RAISE(ABORT,'manager assignment overlaps')
    WHERE EXISTS(SELECT 1 FROM employee_hierarchy_assignments h
      WHERE h.id<>OLD.id AND h.employee_id=NEW.employee_id
        AND h.effective_from<=COALESCE(NEW.effective_to,'9999-12-31')
        AND NEW.effective_from<=COALESCE(h.effective_to,'9999-12-31'));
  SELECT RAISE(ABORT,'manager hierarchy cycle') WHERE EXISTS (
    WITH RECURSIVE chain(person,lo,hi) AS (
      SELECT NEW.manager_employee_id,NEW.effective_from,COALESCE(NEW.effective_to,'9999-12-31')
      UNION ALL
      SELECT h.manager_employee_id,
        MAX(h.effective_from,chain.lo),
        MIN(COALESCE(h.effective_to,'9999-12-31'),chain.hi)
      FROM chain JOIN employee_hierarchy_assignments h ON h.employee_id=chain.person
      WHERE h.id<>OLD.id AND h.effective_from<=chain.hi
        AND chain.lo<=COALESCE(h.effective_to,'9999-12-31')
    )
    SELECT 1 FROM chain WHERE person=NEW.employee_id
  );
END;
