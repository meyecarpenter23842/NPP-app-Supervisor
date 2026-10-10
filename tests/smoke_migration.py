"""Independent Python SQLite M1.2 migration smoke, no production database access."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
BASE = (ROOT / "database/001_initial_schema.sql").read_text(encoding="utf-8")
NEXT = (ROOT / "database/migrations/002_local_operator.sql").read_text(encoding="utf-8")


def check(with_rows):
    db = sqlite3.connect(":memory:")
    db.executescript(BASE)
    if with_rows:
        db.execute("INSERT INTO app_profiles VALUES('old','Operator','SUP','2026-01-01')")
        db.execute("INSERT INTO employees (id,code,full_name,role) VALUES('e','0001','Demo','REP')")
        db.execute(
            "INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,created_at_utc) "
            "VALUES('audit','CREATE','old','EMPLOYEE','2026-01-01')"
        )
        db.commit()

    # Mirror Rust migrator's FK mode and explicit atomic migration.
    db.execute("PRAGMA foreign_keys=OFF")
    db.executescript("BEGIN IMMEDIATE;\n" + NEXT + "\nCOMMIT;")
    db.execute("PRAGMA foreign_keys=ON")
    assert db.execute("PRAGMA foreign_keys").fetchone() == (1,)
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    assert db.execute("SELECT count(*) FROM sqlite_master WHERE name='app_profiles'").fetchone() == (0,)
    if with_rows:
        assert db.execute("SELECT role FROM employees WHERE id='e'").fetchone() == ("SALES",)
        assert db.execute("SELECT actor_profile_id FROM audit_events WHERE id='audit'").fetchone() == (1,)
        assert db.execute("SELECT display_name,role FROM local_operator").fetchone() == ("Operator", "SUP")
    else:
        db.execute("INSERT INTO local_operator VALUES(1,'Operator','SALES','2026-01-01')")
    try:
        db.execute("INSERT INTO local_operator VALUES(2,'Other','ASM','2026-01-01')")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("second local operator unexpectedly accepted")
    db.close()


if __name__ == "__main__":
    check(False)
    check(True)
    print("PASS: baseline -> singleton operator/employee SALES/audit FK upgrade")
