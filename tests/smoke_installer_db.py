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
    versions = [row[0] for row in db.execute("SELECT version FROM schema_migrations ORDER BY version")]
    assert versions == ["001", "002"], versions
    if phase == "seed":
        assert db.execute("SELECT count(*) FROM local_operator").fetchone()[0] == 0
        db.execute("INSERT INTO local_operator (id,display_name,role,created_at_utc) VALUES (1, 'CI Smoke Operator', 'ASM', '2026-01-01T00:00:00Z')")
    else:
        assert db.execute("SELECT id,display_name,role FROM local_operator").fetchone() == (
            1, "CI Smoke Operator", "ASM"
        )
        assert db.execute("SELECT count(*) FROM local_operator").fetchone()[0] == 1
print("PASS:", phase, "SQLite survives install/restart/reinstall with one operator")
