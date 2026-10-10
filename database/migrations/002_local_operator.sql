-- M1.2 forward migration. Run via Rust with FK enforcement off ONLY inside
-- a controlled migration; verify foreign_key_check before commit.
CREATE TABLE local_operator (
 id INTEGER PRIMARY KEY CHECK(id = 1),
 display_name TEXT NOT NULL CHECK(length(trim(display_name)) > 0),
 role TEXT NOT NULL CHECK(role IN ('SALES','SUP','ASM')),
 created_at_utc TEXT NOT NULL
);
INSERT INTO local_operator(id,display_name,role,created_at_utc)
 SELECT 1,display_name,role,created_at_utc FROM app_profiles;

-- Staff are business records, not app users.
CREATE TABLE employees_next (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('SALES','SUP','ASM')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT INTO employees_next(id,code,full_name,role,active)
 SELECT id,code,full_name,CASE WHEN role='REP' THEN 'SALES' ELSE role END,active FROM employees;
DROP TABLE employees;
ALTER TABLE employees_next RENAME TO employees;

-- Preserve audit events and translate old actor ID to the singleton operator.
CREATE TABLE audit_events_next (
 id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 actor_profile_id INTEGER REFERENCES local_operator(id),
 entity_type TEXT NOT NULL,
 entity_id TEXT,
 details_json TEXT,
 created_at_utc TEXT NOT NULL
);
INSERT INTO audit_events_next(id,event_type,actor_profile_id,entity_type,entity_id,details_json,created_at_utc)
 SELECT id,event_type,CASE WHEN actor_profile_id IS NULL THEN NULL ELSE 1 END,
        entity_type,entity_id,details_json,created_at_utc FROM audit_events;
DROP TABLE audit_events;
ALTER TABLE audit_events_next RENAME TO audit_events;
CREATE INDEX idx_audit_at ON audit_events(created_at_utc,event_type);
DROP TABLE app_profiles;
