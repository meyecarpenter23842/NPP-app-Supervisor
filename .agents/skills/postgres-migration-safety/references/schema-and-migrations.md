# Database schema and migration review

## Safe change design
- Determine schema ownership, migration tool, baseline version, dependent queries, views, triggers, function signatures and API contracts.
- Prefer additive changes while old and new application versions overlap in production.
- For backfill, use controlled batches and monitor replication, locks and query pressure.
- Before enforcing uniqueness or NOT NULL, detect violations with read-only checks and quantify affected rows; choose a data remediation plan.
- Index new query shapes based on `EXPLAIN`, cardinality, predicates, sort order and projected columns. Verify actual business workload.
- Consider identity columns or UUIDs consciously; model monetary data with exact numeric types rather than binary floats.
- Use named constraints, explicit foreign keys and indexes on often-joined foreign keys where workload warrants them.
- Consider RLS policy shape and role privileges for each new table/column.

## Release plan checklist
1. Migration identifier and checksum.
2. Preconditions; target PG version; extension compatibility.
3. Estimated lock or table rewrite risk, estimated duration, backfill size.
4. Backup and tested recovery mechanism appropriate to the change; do not perform a backup until authorized.
5. Forward migration SQL and bounded data validation checks.
6. Backward application compatibility while traffic is routed across versions.
7. Rollback or forward-only recovery plan, with limitations called out.
8. PG16 / PG17 CI matrix and staging rehearsal results (mark untested explicitly).
9. Post-change verification and observability.

## Example: safe idea, not execute
A new non-null field for an existing populated table often requires a staged approach:
1. Add nullable column, deploy compatible application.
2. Backfill existing records in bounded batches with validation.
3. Ensure writes populate it, then apply/enforce NOT NULL at a controlled time.
Exact SQL depends on versions, data types, table size and constraints; never automatically execute a generic example.
