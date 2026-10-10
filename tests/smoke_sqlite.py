"""Zero-dependency SQLite schema smoke test; python3 tests/smoke_sqlite.py."""
import sqlite3
from pathlib import Path
from uuid import uuid4
ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'database/001_initial_schema.sql'


def main():
    db = sqlite3.connect(':memory:')
    db.executescript(SCHEMA.read_text(encoding='utf-8'))
    assert db.execute('PRAGMA foreign_keys').fetchone()[0] == 1
    db.execute("INSERT INTO distributors(id,code,name,created_at_utc) VALUES ('d1','NPP_001','Demo','2026-10-10T00:00:00Z')")
    db.execute("INSERT INTO products(id,sku_code,name,base_unit) VALUES ('p1','SKU_001','Demo','THUNG')")
    db.execute("INSERT INTO import_batches (id,kind,distributor_id,period_from,period_to,granularity,source_file_name,source_file_sha256,status,active,imported_at_utc,committed_at_utc) VALUES ('b1','XNT','d1','2026-10-01','2026-10-31','PERIOD_SNAPSHOT','xnt.xlsx','abcd','COMMITTED',1,'2026-10-10T00:00:00Z','2026-10-10T00:00:01Z')")
    db.execute("INSERT INTO inventory_period_facts (id,batch_id,distributor_id,product_id,period_from,period_to,opening_micro,receipts_micro,issues_micro,adjustments_micro,closing_micro,source_row) VALUES ('f1','b1','d1','p1','2026-10-01','2026-10-31',100000000,50000000,20000000,0,130000000,2)")
    q = db.execute('SELECT reconciliation_variance_micro FROM v_active_inventory_period').fetchone()
    assert q == (0,), q
    try:
        db.execute("INSERT INTO import_batches (id,kind,distributor_id,period_from,period_to,granularity,source_file_name,source_file_sha256,status,active,imported_at_utc) VALUES ('b2','XNT','d1','2026-10-01','2026-10-31','PERIOD_SNAPSHOT','again.xlsx','efgh','COMMITTED',1,'2026-10-10T00:00:02Z')")
        raise AssertionError('duplicate active slot incorrectly accepted')
    except sqlite3.IntegrityError:
        pass
    db.execute("UPDATE import_batches SET active=0,status='SUPERSEDED' WHERE id='b1'")
    db.execute("INSERT INTO import_batches (id,kind,distributor_id,period_from,period_to,granularity,source_file_name,source_file_sha256,status,active,imported_at_utc) VALUES ('b2','XNT','d1','2026-10-01','2026-10-31','PERIOD_SNAPSHOT','again.xlsx','efgh','COMMITTED',1,'2026-10-10T00:00:02Z')")
    assert db.execute('SELECT COUNT(*) FROM v_active_inventory_period').fetchone()[0] == 0
    print('PASS: migrations, foreign keys, XNT variance, active-slot revision, active view filtering')

if __name__ == '__main__':
    main()
