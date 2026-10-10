---
name: postgres-migration-safety
description: Safely inspect and improve PostgreSQL schemas, SQL performance, migrations, constraints, triggers, indexes, locks, permissions and RLS. Use for PostgreSQL or Supabase database bugs, PG16/PG17 migration reviews, slow queries, and schema-change plans. Default to read-only auditing; require explicit approval for writes or migrations.
---

# PostgreSQL & Migration Safety

## Mission
Help maintain trustworthy PostgreSQL databases with controlled schema evolution, secure queries and evidence-backed performance work. This guidance is applicable to PostgreSQL on VPS or Supabase, and is **not** permission to operate a live database.

## Always determine before doing anything
- Target system, host/environment (development, staging, production), DB PostgreSQL major version and whether it is managed or self-hosted.
- User authorization: **read-only by default**. Schema changes, DDL, data writes, migrations, extension installs, reloads, restarts, backups and restores need the appropriate user approval; destructive actions need explicit approval.
- Current schema state, migration history, change window, compatibility with deployed application versions and rollback or forward-fix strategy.
- Secrets must never be printed: connection strings, passwords, API tokens, private keys or config values.

## Workflow
1. **Describe the expected behavior.** Identify the request, affected tables and application code path; distinguish app validation failures from database failures.
2. **Inspect safely.** Favor read-only catalog queries and `EXPLAIN` without `ANALYZE`. Gather constraint names, SQLSTATE, table/index definitions and statistics. Explain costs/risks before any heavy query.
3. **Review correctness first.** PK/FK, uniqueness, check constraints, nullability, referential integrity, ownership, grants, RLS, trigger side effects, transaction boundaries and application compatibility.
4. **Review performance with evidence.** Look for N+1 queries, missing/unused indexes, composite predicate order, excessive scans, inefficient pagination, lock contention, connection exhaustion and stale statistics. Never recommend an index based on guesswork alone.
5. **Plan safe changes.** Write migration steps, preconditions, expected lock behavior, backfill approach, tests and how to recover. Use expand → backfill → contract for breaking changes. Handle indexes and long-running operations appropriately for version and environment.
6. **Validate with a matrix.** Rehearse on a database copy first where available. For deployments using PG16/PG17 CI, report results separately. Confirm application compatibility and avoid false claims about unrun tests.
7. **Execute only if authorized.** No production migration, writes, lock-inducing DDL, data deletion, restore or direct deploy until explicitly requested. Observe before/after states and report actual results.

## Important safety nuances
- `EXPLAIN ANALYZE` executes SQL. Never run it on modifying statements or costly production workloads without approval.
- `CREATE INDEX CONCURRENTLY` reduces write blocking but cannot run inside a transaction block and still requires a controlled rollout; drop failed invalid indexes deliberately after review.
- Adding defaults, constraints, `NOT NULL`, FK and changing column types may affect locks or table rewrites; evaluate PostgreSQL version and data size.
- For security, apply least privilege; RLS policies must be tested for each role and tenant. Do not assume Supabase anon/service role behavior is interchangeable.
- Never dump data, inspect personal rows, or expose connection details unless explicitly authorized and necessary.

## What to return
- **Audit request:** current facts, suspected cause and confidence, risks, no changes made.
- **SQL review:** correctness, security, performance and suggested SQL snippets marked *proposed, not executed*.
- **Migration request:** migration plan, compatibility window, backup/restore readiness, rollback or forward-fix method, PG16/17 test outcomes and final change log.

Read `references/schema-and-migrations.md` and `references/diagnostic-sql.md` when applicable.
