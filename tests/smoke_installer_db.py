"""Smoke fixture for the disposable CI Windows app-data database, not production."""
from pathlib import Path
import sqlite3
import sys

db_path = Path(sys.argv[1])
phase = sys.argv[2]
assert phase in ("seed", "verify"), phase
assert db_path.is_file(), db_path

with sqlite3.connect(db_path) as db:
    assert db.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    db.execute("PRAGMA foreign_keys = ON")
    assert db.execute("PRAGMA foreign_keys").fetchone() == (1,)
    versions = [row[0] for row in db.execute("SELECT version FROM schema_migrations ORDER BY version")]
    assert versions == ["001", "002", "003", "004", "005"], versions

    # Installed app must include M2.1 schema, not merely the migration number.
    expected_tables = {
        "product_families", "sku_unit_conversions", "employee_code_aliases",
        "employee_hierarchy_assignments", "employee_route_assignments",
        "catalog_categories", "catalog_brands", "catalog_units",
        "price_lists", "price_list_items",
    }
    actual_tables = {row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )}
    assert expected_tables <= actual_tables, expected_tables - actual_tables
    columns = {row[1] for row in db.execute("PRAGMA table_info(products)")}
    assert "product_family_id" in columns, columns

    if phase == "seed":
        assert db.execute("SELECT count(*) FROM local_operator").fetchone()[0] == 0
        db.execute("INSERT INTO local_operator (id,display_name,role,created_at_utc) VALUES (1, 'CI Smoke Operator', 'ASM', '2026-01-01T00:00:00Z')")
        # Seed a real family→SKU and NPP-scoped source mapping so the Windows
        # install/restart/uninstall/reinstall smoke also protects M2.1 data.
        db.execute("INSERT INTO distributors(id,code,name,created_at_utc) VALUES ('ci-npp','0001','CI Distributor','2026-01-01T00:00:00Z')")
        db.execute("INSERT INTO product_families(id,code,name) VALUES ('ci-family','CI-FAMILY','CI Product')")
        db.execute("INSERT INTO products(id,sku_code,name,base_unit,product_family_id) VALUES ('ci-sku','CI-SKU','CI SKU','LON','ci-family')")
        db.execute("INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den,effective_from) VALUES ('ci-sku-alias','ci-npp','0007','ci-sku','THUNG',24,1,'2026-01-01')")
        # Price list and declared source package unit must survive native app lifecycle.
        db.execute("INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den) VALUES ('ci-unit-conversion','ci-sku','THUNG',24,1)")
        db.execute("INSERT INTO catalog_units(id,code,name) VALUES ('ci-unit','THUNG','Thùng')")
        db.execute("INSERT INTO price_lists(id,distributor_id,code,name,price_type,effective_from) VALUES ('ci-list','ci-npp','LIST1','CI reference prices','OUT','2026-01-01')")
        db.execute("INSERT INTO price_list_items(id,price_list_id,product_id,unit_code,amount_vnd,effective_from) VALUES ('ci-price','ci-list','ci-sku','THUNG',240000,'2026-01-01')")
        db.execute("INSERT INTO employees(id,code,full_name,role) VALUES ('ci-sales','0009','CI Sales','SALES')")
        db.execute("INSERT INTO employee_code_aliases(id,distributor_id,raw_employee_code,employee_id,effective_from) VALUES ('ci-staff-alias','ci-npp','0009','ci-sales','2026-01-01')")
    else:
        assert db.execute("SELECT id,display_name,role FROM local_operator").fetchone() == (
            1, "CI Smoke Operator", "ASM"
        )
        assert db.execute("SELECT count(*) FROM local_operator").fetchone()[0] == 1
        assert db.execute(
            "SELECT f.code,p.sku_code,p.base_unit FROM products p "
            "JOIN product_families f ON f.id=p.product_family_id WHERE p.id='ci-sku'"
        ).fetchone() == ("CI-FAMILY", "CI-SKU", "LON")
        assert db.execute(
            "SELECT d.code,a.raw_sku_code,a.raw_unit,a.conversion_num,a.conversion_den "
            "FROM sku_aliases a JOIN distributors d ON d.id=a.distributor_id "
            "WHERE a.id='ci-sku-alias'"
        ).fetchone() == ("0001", "0007", "THUNG", 24, 1)
        assert db.execute(
            "SELECT pl.distributor_id,pl.price_type,i.product_id,i.unit_code,i.amount_vnd "
            "FROM price_list_items i JOIN price_lists pl ON pl.id=i.price_list_id "
            "WHERE i.id='ci-price'"
        ).fetchone() == ("ci-npp", "OUT", "ci-sku", "THUNG", 240000)
        assert db.execute(
            "SELECT e.role,a.raw_employee_code FROM employee_code_aliases a "
            "JOIN employees e ON e.id=a.employee_id WHERE a.id='ci-staff-alias'"
        ).fetchone() == ("SALES", "0009")
print("PASS:", phase, "SQLite survives install/restart/reinstall with one operator")
