# Read-only PostgreSQL diagnostics

These are reference examples. Check access rights and production sensitivity before executing; large statistics queries can still consume resources. Never substitute examples for a database-specific plan.

## Server and database identity
```sql
SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       current_user AS session_user;
```

## Table and index size (largest first)
```sql
SELECT schemaname, relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_indexes_size(relid)) AS indexes_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

## Check current sessions, avoid exposing query text by default
```sql
SELECT state, wait_event_type, count(*) AS connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type
ORDER BY connections DESC;
```

## Identify invalid indexes
```sql
SELECT n.nspname AS schema_name, c.relname AS index_name
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT i.indisvalid;
```

## Reason about a slow query
`EXPLAIN (FORMAT JSON) <SELECT ...>` plans rather than runs the SELECT.
Beware of expensive planning, security-definer functions and volatile expressions.
Do not automatically run `EXPLAIN ANALYZE` on live production.

## Troubleshooting order
1. Gather the actual query or SQLSTATE (without private values).
2. Check constraints, triggers, foreign key references and execution plan.
3. Evaluate cardinality and statistics, current workload and lock/wait evidence.
4. Only then propose a candidate SQL or schema change with performance tests.
