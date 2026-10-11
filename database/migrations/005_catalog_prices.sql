-- P1 additive catalog and distributor price foundation. 001-004 are immutable.
CREATE TABLE catalog_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE catalog_brands (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE catalog_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

-- Backfill legacy text without overwriting it. Null remains genuinely unknown.
INSERT INTO catalog_categories(id,code,name)
SELECT 'legacy-category:'||upper(trim(category)),upper(trim(category)),min(trim(category))
FROM product_families WHERE category IS NOT NULL AND trim(category)<>''
GROUP BY upper(trim(category));
INSERT INTO catalog_brands(id,code,name)
SELECT 'legacy-brand:'||upper(trim(brand)),upper(trim(brand)),min(trim(brand))
FROM product_families WHERE brand IS NOT NULL AND trim(brand)<>''
GROUP BY upper(trim(brand));
INSERT INTO catalog_units(id,code,name)
SELECT 'legacy-unit:'||upper(trim(unit_code)),upper(trim(unit_code)),min(trim(unit_code))
FROM (
  SELECT base_unit AS unit_code FROM products
  UNION ALL SELECT unit_code FROM sku_unit_conversions
  UNION ALL SELECT raw_unit AS unit_code FROM sku_aliases
)
WHERE unit_code IS NOT NULL AND trim(unit_code)<>''
GROUP BY upper(trim(unit_code));

ALTER TABLE product_families ADD COLUMN category_id TEXT REFERENCES catalog_categories(id);
ALTER TABLE product_families ADD COLUMN brand_id TEXT REFERENCES catalog_brands(id);
UPDATE product_families SET category_id=(
  SELECT id FROM catalog_categories WHERE code=upper(trim(product_families.category))
) WHERE category IS NOT NULL AND trim(category)<>'';
UPDATE product_families SET brand_id=(
  SELECT id FROM catalog_brands WHERE code=upper(trim(product_families.brand))
) WHERE brand IS NOT NULL AND trim(brand)<>'';
CREATE INDEX idx_family_catalog ON product_families(category_id,brand_id);

CREATE TABLE price_lists (
  id TEXT PRIMARY KEY,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  price_type TEXT NOT NULL CHECK(length(trim(price_type))>0),
  currency_code TEXT NOT NULL DEFAULT 'VND' CHECK(currency_code='VND'),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(effective_to IS NULL OR effective_to>=effective_from),
  UNIQUE(distributor_id,code)
);
CREATE INDEX idx_price_lists_scope ON price_lists(distributor_id,price_type,active,effective_from,effective_to);

-- Append price periods; do not destroy prior prices when a new period begins.
CREATE TABLE price_list_items (
  id TEXT PRIMARY KEY,
  price_list_id TEXT NOT NULL REFERENCES price_lists(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_code TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL CHECK(amount_vnd>=0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_note TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(effective_to IS NULL OR effective_to>=effective_from),
  UNIQUE(price_list_id,product_id,unit_code,effective_from)
);
CREATE INDEX idx_price_item_lookup ON price_list_items(price_list_id,product_id,unit_code,active,effective_from,effective_to);

CREATE TRIGGER price_item_unit_guard_insert BEFORE INSERT ON price_list_items
WHEN NOT EXISTS (
  SELECT 1 FROM sku_unit_conversions u
  WHERE u.product_id=NEW.product_id AND u.unit_code=NEW.unit_code COLLATE NOCASE
)
BEGIN SELECT RAISE(ABORT,'price unit must be registered for the SKU'); END;
CREATE TRIGGER price_item_unit_guard_update BEFORE UPDATE OF product_id,unit_code ON price_list_items
WHEN NOT EXISTS (
  SELECT 1 FROM sku_unit_conversions u
  WHERE u.product_id=NEW.product_id AND u.unit_code=NEW.unit_code COLLATE NOCASE
)
BEGIN SELECT RAISE(ABORT,'price unit must be registered for the SKU'); END;

CREATE TRIGGER price_item_no_overlap_insert BEFORE INSERT ON price_list_items
WHEN NEW.active=1 AND EXISTS (
  SELECT 1 FROM price_list_items p
  WHERE p.price_list_id=NEW.price_list_id AND p.product_id=NEW.product_id
    AND p.unit_code=NEW.unit_code COLLATE NOCASE AND p.active=1
    AND p.effective_from<=coalesce(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=coalesce(p.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'overlapping price item periods'); END;
CREATE TRIGGER price_item_no_overlap_update BEFORE UPDATE ON price_list_items
WHEN NEW.active=1 AND EXISTS (
  SELECT 1 FROM price_list_items p
  WHERE p.id<>OLD.id AND p.price_list_id=NEW.price_list_id AND p.product_id=NEW.product_id
    AND p.unit_code=NEW.unit_code COLLATE NOCASE AND p.active=1
    AND p.effective_from<=coalesce(NEW.effective_to,'9999-12-31')
    AND NEW.effective_from<=coalesce(p.effective_to,'9999-12-31')
)
BEGIN SELECT RAISE(ABORT,'overlapping price item periods'); END;
