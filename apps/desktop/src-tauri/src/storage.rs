//! SQLite owner under Windows user app-data; no WebView IPC in M1.2.
use fs2::FileExt;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use sha2::{Digest, Sha256};
use std::{
    error::Error,
    fs::{self, File, OpenOptions},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;
const SCHEMA_001: &str = include_str!("../../../../database/001_initial_schema.sql");
const SCHEMA_002: &str = include_str!("../../../../database/migrations/002_local_operator.sql");
const SCHEMA_003: &str = include_str!("../../../../database/migrations/003_master_data.sql");
const SCHEMA_004: &str = include_str!("../../../../database/migrations/004_import_archives.sql");
const SCHEMA_005: &str = include_str!("../../../../database/migrations/005_catalog_prices.sql");

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OperatorRole {
    Sales,
    Sup,
    Asm,
}
impl OperatorRole {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Sales => "SALES",
            Self::Sup => "SUP",
            Self::Asm => "ASM",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct LocalOperator {
    pub display_name: String,
    pub role: OperatorRole,
}

pub struct AppDatabase {
    pub(crate) connection: Mutex<Connection>,
    _single_process_lock: File,
    pub path: PathBuf,
}

impl AppDatabase {
    pub fn open(app_data: &Path) -> Result<Self> {
        fs::create_dir_all(app_data)?;
        let lock = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(app_data.join("sales-supervisor.lock"))?;
        lock.try_lock_exclusive()?;
        let path = app_data.join("sales-supervisor.sqlite3");
        let conn = Connection::open(&path)?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "FULL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        ensure_foreign_keys(&conn)?;
        migrate(&conn, app_data)?;
        Ok(Self {
            connection: Mutex::new(conn),
            _single_process_lock: lock,
            path,
        })
    }

    pub fn create_operator(&self, display_name: &str, role: OperatorRole) -> Result<()> {
        let display_name = display_name.trim();
        if display_name.is_empty() {
            return Err("operator name must not be blank".into());
        }
        let conn = self
            .connection
            .lock()
            .map_err(|_| "storage mutex poisoned")?;
        conn.execute(
            "INSERT INTO local_operator(id,display_name,role,created_at_utc)
             VALUES(1,?1,?2,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![display_name, role.as_str()],
        )?;
        Ok(())
    }

    pub fn update_operator(&self, display_name: &str, role: OperatorRole) -> Result<bool> {
        let display_name = display_name.trim();
        if display_name.is_empty() {
            return Err("operator name must not be blank".into());
        }
        let conn = self
            .connection
            .lock()
            .map_err(|_| "storage mutex poisoned")?;
        let changed = conn.execute(
            "UPDATE local_operator SET display_name=?1,role=?2 WHERE id=1",
            params![display_name, role.as_str()],
        )?;
        Ok(changed == 1)
    }

    pub fn operator(&self) -> Result<Option<LocalOperator>> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| "storage mutex poisoned")?;
        let operator = conn
            .query_row(
                "SELECT display_name,role FROM local_operator WHERE id=1",
                [],
                |row| {
                    let role: String = row.get(1)?;
                    let role = match role.as_str() {
                        "SALES" => OperatorRole::Sales,
                        "SUP" => OperatorRole::Sup,
                        "ASM" => OperatorRole::Asm,
                        _ => return Err(rusqlite::Error::InvalidQuery),
                    };
                    Ok(LocalOperator {
                        display_name: row.get(0)?,
                        role,
                    })
                },
            )
            .optional()?;
        Ok(operator)
    }
}

fn ensure_foreign_keys(conn: &Connection) -> Result<()> {
    let enabled: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
    if enabled != 1 {
        return Err("foreign keys must be enabled".into());
    }
    Ok(())
}

fn has_table(conn: &Connection, name: &str) -> rusqlite::Result<bool> {
    Ok(conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
        [name],
        |r| r.get::<_, i64>(0),
    )? != 0)
}

fn has_column(conn: &Connection, name: &str) -> rusqlite::Result<bool> {
    Ok(conn.query_row(
        "SELECT count(*) FROM pragma_table_info('schema_migrations') WHERE name=?1",
        [name],
        |r| r.get::<_, i64>(0),
    )? != 0)
}

fn sha256(src: &str) -> String {
    format!("{:x}", Sha256::digest(src.as_bytes()))
}

fn check_integrity(conn: &Connection) -> Result<()> {
    let result: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if result != "ok" {
        return Err(format!("SQLite integrity error: {result}").into());
    }
    Ok(())
}

fn snapshot(conn: &Connection, app_data: &Path) -> Result<()> {
    check_integrity(conn)?;
    let dir = app_data.join("backups");
    fs::create_dir_all(&dir)?;
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let name = format!("pre-migration-{}-{suffix}.sqlite3", std::process::id());
    let file = dir.join(name);
    // SQLite's consistent backup snapshot (safe with WAL), not a file copy.
    conn.execute("VACUUM INTO ?1", params![file.to_string_lossy().as_ref()])?;
    let backup = Connection::open_with_flags(file, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    check_integrity(&backup)
}

fn write_ledger(tx: &rusqlite::Transaction<'_>, version: &str, sql: &str) -> rusqlite::Result<()> {
    tx.execute(
        "INSERT INTO schema_migrations(version,checksum,applied_at_utc)
         VALUES(?1,?2,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        params![version, sha256(sql)],
    )?;
    Ok(())
}

fn check_single_legacy_profile(conn: &Connection) -> Result<()> {
    if !has_table(conn, "app_profiles")? {
        return Err("unknown legacy schema: app_profiles missing".into());
    }
    let count: i64 = conn.query_row("SELECT count(*) FROM app_profiles", [], |r| r.get(0))?;
    if count > 1 {
        return Err("legacy multiple profiles: manual migration needed".into());
    }
    Ok(())
}

fn migrate(conn: &Connection, app_data: &Path) -> Result<()> {
    check_integrity(conn)?;
    let new_database = !has_table(conn, "schema_migrations")?;
    let mut backup_made = false;
    if new_database {
        let unknown: i64 = conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [],
            |r| r.get(0),
        )?;
        if unknown > 0 {
            return Err("unrecognized database without migration ledger".into());
        }
        // Historical 001 includes PRAGMAs and explicit transaction boundaries.
        // Preserve the exact old SQL as checksum source but own atomic commit.
        let ddl = SCHEMA_001
            .split_once("BEGIN;")
            .and_then(|(_, rest)| rest.rsplit_once("COMMIT;"))
            .map(|(body, _)| body)
            .ok_or("missing baseline SQL transaction markers")?;
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(ddl)?;
        tx.execute_batch(
            "ALTER TABLE schema_migrations ADD COLUMN checksum TEXT NOT NULL DEFAULT '';",
        )?;
        write_ledger(&tx, "001", SCHEMA_001)?;
        tx.commit()?;
    } else if !has_column(conn, "checksum")? {
        if !has_table(conn, "employees")? {
            return Err("unknown legacy employees schema".into());
        }
        check_single_legacy_profile(conn)?;
        let known: i64 =
            conn.query_row("SELECT count(*) FROM schema_migrations", [], |r| r.get(0))?;
        if known != 0 {
            return Err("legacy ledger is not empty; manual inspection needed".into());
        }
        snapshot(conn, app_data)?;
        backup_made = true;
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "ALTER TABLE schema_migrations ADD COLUMN checksum TEXT NOT NULL DEFAULT '';",
        )?;
        write_ledger(&tx, "001", SCHEMA_001)?;
        tx.commit()?;
    }

    let versions = {
        let mut stmt =
            conn.prepare("SELECT version,checksum FROM schema_migrations ORDER BY version")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    for (v, digest) in &versions {
        let expected = match v.as_str() {
            "001" => sha256(SCHEMA_001),
            "002" => sha256(SCHEMA_002),
            "003" => sha256(SCHEMA_003),
            "004" => sha256(SCHEMA_004),
            "005" => sha256(SCHEMA_005),
            _ => return Err(format!("unsupported newer migration: {v}").into()),
        };
        if *digest != expected {
            return Err(format!("migration checksum mismatch: {v}").into());
        }
    }
    if !versions.iter().any(|(v, _)| v == "001") {
        return Err("missing baseline migration 001".into());
    }

    if !versions.iter().any(|(v, _)| v == "002") {
        check_single_legacy_profile(conn)?;
        if !new_database && !backup_made {
            snapshot(conn, app_data)?;
            backup_made = true;
        }
        // Only the private migration connection may briefly disable FK checks.
        conn.pragma_update(None, "foreign_keys", "OFF")?;
        let outcome = (|| -> Result<()> {
            let tx = conn.unchecked_transaction()?;
            tx.execute_batch(SCHEMA_002)?;
            write_ledger(&tx, "002", SCHEMA_002)?;
            let violations: i64 =
                tx.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })?;
            if violations != 0 {
                return Err(format!("{violations} foreign-key violations").into());
            }
            tx.commit()?;
            Ok(())
        })();
        conn.pragma_update(None, "foreign_keys", "ON")?;
        outcome?;
    }
    if !versions.iter().any(|(v, _)| v == "003") {
        if !new_database && !backup_made {
            snapshot(conn, app_data)?;
        }
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_003)?;
        write_ledger(&tx, "003", SCHEMA_003)?;
        let violations: i64 =
            tx.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                r.get(0)
            })?;
        if violations != 0 {
            return Err(format!("{violations} foreign-key violations").into());
        }
        tx.commit()?;
    }
    if !versions.iter().any(|(v, _)| v == "004") {
        if !new_database && !backup_made {
            snapshot(conn, app_data)?;
        }
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_004)?;
        write_ledger(&tx, "004", SCHEMA_004)?;
        let violations: i64 =
            tx.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                r.get(0)
            })?;
        if violations != 0 {
            return Err(format!("{violations} foreign-key violations").into());
        }
        tx.commit()?;
    }
    if !versions.iter().any(|(v, _)| v == "005") {
        if !new_database && !backup_made {
            snapshot(conn, app_data)?;
        }
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_005)?;
        write_ledger(&tx, "005", SCHEMA_005)?;
        let violations: i64 =
            tx.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                r.get(0)
            })?;
        if violations != 0 {
            return Err(format!("{violations} foreign-key violations").into());
        }
        tx.commit()?;
    }
    check_integrity(conn)?;
    ensure_foreign_keys(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn install_single_operator_and_restart_offline() -> Result<()> {
        for role in [OperatorRole::Sales, OperatorRole::Sup, OperatorRole::Asm] {
            let d = tempdir()?;
            {
                let db = AppDatabase::open(d.path())?;
                assert!(db.path.starts_with(d.path()) && db.path.exists());
                assert!(db.operator()?.is_none());
                db.create_operator(" Example ", role)?;
                assert_eq!(
                    db.operator()?,
                    Some(LocalOperator {
                        display_name: "Example".into(),
                        role
                    })
                );
                assert!(db.create_operator("Second", role).is_err());
                let c = db.connection.lock().unwrap();
                ensure_foreign_keys(&c)?;
                assert_eq!(
                    c.query_row("SELECT count(*) FROM schema_migrations", [], |r| r
                        .get::<_, i64>(0))?,
                    5
                );
                assert!(c.execute(
                    "INSERT INTO local_operator(id,display_name,role,created_at_utc) VALUES(2,'bad','SALES','2026')",[]
                ).is_err());
            }
            let db = AppDatabase::open(d.path())?;
            assert_eq!(
                db.operator()?,
                Some(LocalOperator {
                    display_name: "Example".into(),
                    role
                })
            );
        }
        Ok(())
    }

    #[test]
    fn second_instance_cannot_use_same_app_data() -> Result<()> {
        let d = tempdir()?;
        let first = AppDatabase::open(d.path())?;
        assert!(AppDatabase::open(d.path()).is_err());
        drop(first);
        AppDatabase::open(d.path())?;
        Ok(())
    }

    #[test]
    fn upgrade_from_004_preserves_skus_and_backfills_catalog() -> Result<()> {
        let d = tempdir()?;
        let path = d.path().join("sales-supervisor.sqlite3");
        {
            let c = Connection::open(&path)?;
            c.execute_batch(SCHEMA_001)?;
            c.execute_batch(
                "ALTER TABLE schema_migrations ADD COLUMN checksum TEXT NOT NULL DEFAULT '';",
            )?;
            c.pragma_update(None, "foreign_keys", "OFF")?;
            c.execute_batch(SCHEMA_002)?;
            c.pragma_update(None, "foreign_keys", "ON")?;
            c.execute_batch(SCHEMA_003)?;
            c.execute_batch(SCHEMA_004)?;
            for (version, schema) in [
                ("001", SCHEMA_001),
                ("002", SCHEMA_002),
                ("003", SCHEMA_003),
                ("004", SCHEMA_004),
            ] {
                c.execute(
                    "INSERT INTO schema_migrations(version,checksum,applied_at_utc)
                     VALUES(?1,?2,'2026')",
                    params![version, sha256(schema)],
                )?;
            }
            c.execute_batch(
                "INSERT INTO distributors(id,code,name,created_at_utc)
                  VALUES('npp','N1','NPP 1','2026');
                 INSERT INTO product_families(id,code,name,category,brand)
                  VALUES('family','F','Sản phẩm','Đồ uống','Nhãn A');
                 INSERT INTO products(id,sku_code,name,category,base_unit,product_family_id)
                  VALUES('sku','0007','Tên SKU','Nước giải khát','LON','family');
                 INSERT INTO sku_unit_conversions
                  (id,product_id,unit_code,conversion_num,conversion_den)
                  VALUES('base','sku','LON',1,1);
                 INSERT INTO sku_aliases
                  (id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den)
                  VALUES('alias','npp','0007','sku','LON',1,1);",
            )?;
        }

        let db = AppDatabase::open(d.path())?;
        let c = db.connection.lock().unwrap();
        let (sku_id, source_code): (String, String) = c.query_row(
            "SELECT product_id,raw_sku_code FROM sku_aliases WHERE id='alias'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        assert_eq!((sku_id.as_str(), source_code.as_str()), ("sku", "0007"));
        let family: (String, String) = c.query_row(
            "SELECT c.name,b.name FROM product_families f
             JOIN catalog_categories c ON c.id=f.category_id
             JOIN catalog_brands b ON b.id=f.brand_id WHERE f.id='family'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        assert_eq!(family, ("Đồ uống".into(), "Nhãn A".into()));
        let source_category_count: i64 = c.query_row(
            "SELECT count(*) FROM catalog_categories WHERE name='Nước giải khát'",
            [],
            |r| r.get(0),
        )?;
        assert_eq!(source_category_count, 1);
        let version_count: i64 =
            c.query_row("SELECT count(*) FROM schema_migrations", [], |r| r.get(0))?;
        assert_eq!(version_count, 5);
        ensure_foreign_keys(&c)?;
        assert!(d.path().join("backups").read_dir()?.next().is_some());
        Ok(())
    }

    #[test]
    fn historic_schema_upgrade_preserves_subject_and_audit() -> Result<()> {
        let d = tempdir()?;
        {
            let c = Connection::open(d.path().join("sales-supervisor.sqlite3"))?;
            c.execute_batch(SCHEMA_001)?;
            c.execute(
                "INSERT INTO app_profiles VALUES('legacy','One','SUP','2026-01-01')",
                [],
            )?;
            c.execute(
                "INSERT INTO employees(id,code,full_name,role) VALUES('e','001','Sales','REP')",
                [],
            )?;
            c.execute("INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,created_at_utc) VALUES('a','EDIT','legacy','EMPLOYEE','2026-01-01')",[])?;
        }
        let db = AppDatabase::open(d.path())?;
        assert_eq!(db.operator()?.unwrap().role, OperatorRole::Sup);
        let c = db.connection.lock().unwrap();
        assert_eq!(
            c.query_row("SELECT role FROM employees WHERE id='e'", [], |r| r
                .get::<_, String>(0))?,
            "SALES"
        );
        assert_eq!(
            c.query_row(
                "SELECT actor_profile_id FROM audit_events WHERE id='a'",
                [],
                |r| r.get::<_, i64>(0)
            )?,
            1
        );
        assert!(!has_table(&c, "app_profiles")?);
        ensure_foreign_keys(&c)?;
        assert_eq!(
            c.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| r
                .get::<_, i64>(
                0
            ))?,
            0
        );
        assert!(d.path().join("backups").read_dir()?.next().is_some());
        Ok(())
    }

    #[test]
    fn mismatch_or_ambiguous_source_never_overwrites_customer_data() -> Result<()> {
        let d = tempdir()?;
        drop(AppDatabase::open(d.path())?);
        let path = d.path().join("sales-supervisor.sqlite3");
        {
            let c = Connection::open(&path)?;
            c.execute(
                "UPDATE schema_migrations SET checksum='broken' WHERE version='001'",
                [],
            )?;
        }
        assert!(AppDatabase::open(d.path()).is_err());
        let c = Connection::open(path)?;
        assert_eq!(
            c.query_row(
                "SELECT checksum FROM schema_migrations WHERE version='001'",
                [],
                |r| r.get::<_, String>(0)
            )?,
            "broken"
        );

        let legacy = tempdir()?;
        let file = legacy.path().join("sales-supervisor.sqlite3");
        {
            let c = Connection::open(&file)?;
            c.execute_batch(SCHEMA_001)?;
            c.execute("INSERT INTO app_profiles VALUES('1','A','SUP','2026')", [])?;
            c.execute("INSERT INTO app_profiles VALUES('2','B','ASM','2026')", [])?;
        }
        assert!(AppDatabase::open(legacy.path()).is_err());
        let c = Connection::open(file)?;
        assert!(has_table(&c, "app_profiles")?);
        assert_eq!(
            c.query_row("SELECT count(*) FROM app_profiles", [], |r| r
                .get::<_, i64>(0))?,
            2
        );
        Ok(())
    }

    #[test]
    fn edits_single_operator_without_creating_a_second_user() -> Result<()> {
        let root = tempdir()?;
        let db = AppDatabase::open(root.path())?;
        assert!(!db.update_operator("No profile", OperatorRole::Sales)?);
        db.create_operator("First", OperatorRole::Sup)?;
        assert!(db.update_operator("  Updated  ", OperatorRole::Asm)?);
        assert_eq!(
            db.operator()?,
            Some(LocalOperator {
                display_name: "Updated".into(),
                role: OperatorRole::Asm,
            })
        );
        assert!(db.create_operator("Another", OperatorRole::Sales).is_err());
        drop(db);
        let again = AppDatabase::open(root.path())?;
        assert_eq!(
            again.operator()?,
            Some(LocalOperator {
                display_name: "Updated".into(),
                role: OperatorRole::Asm,
            })
        );
        Ok(())
    }

    #[test]
    fn invalid_sql_transaction_rolls_back_ddl_and_rows() -> Result<()> {
        let c = Connection::open_in_memory()?;
        let tx = c.unchecked_transaction()?;
        assert!(tx
            .execute_batch("CREATE TABLE demo(x); INSERT INTO missing_table VALUES(1);")
            .is_err());
        drop(tx);
        assert!(!has_table(&c, "demo")?);
        Ok(())
    }
}
