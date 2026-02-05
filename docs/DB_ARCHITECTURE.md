# Database Architecture (Supabase-First)

## Overview
This system enforces Supabase PostgreSQL as the authoritative source of truth. All database access routes through a single repository layer that provides:
- Supabase-first routing with controlled fallback.
- Mandatory startup validation and health checks.
- Write verification against Supabase.
- Centralized audit logging to `sca.db_logs`.
- Schema governance and migration tracking via `sca.schema_versions`.

## Core Modules
- `netlify/functions-src/db-router.js`
  - Chooses active database: Supabase → MSSQL → Mock.
  - Hard validation + degraded mode safeguards.
- `netlify/functions-src/db-repository.js`
  - Single entry point for all queries.
  - Logging + verification.
- `netlify/functions-src/services/db-service.js`
  - Service-layer wrapper used by controllers.
- `netlify/functions-src/db-health.js`
  - Provides health metrics for `/api/system/db-health`.
- `netlify/functions-src/db-diagnostics.js`
  - Env validation and connection diagnostics.
- `netlify/functions-src/db-logging.js`
  - Writes audit logs to `sca.db_logs`.

## Environment Variables
Required for Supabase:
- `SUPABASE_DB_URL` (preferred) or `POSTGRES_URL`
- `SUPABASE_URL` (frontend usage only, **do not** expose DB directly)
- `SUPABASE_ANON_KEY`

Optional routing controls:
- `DB_DIALECT` (use only with `DB_ROUTER_ALLOW_FORCE=true`)
- `DB_ROUTER_ALLOW_FORCE` (false by default)
- `DB_ROUTER_ALLOW_FALLBACK` (false in prod by default)
- `DB_ROUTER_ALLOW_MOCK` (false in prod by default)
- `DB_DEGRADED_READONLY` (true in prod)
- `DB_VERIFY_WRITES` (true by default)
- `DB_LOGGING_ENABLED` (true by default)

MSSQL fallback:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_ENCRYPT`, `DB_TRUST_CERT`

## Health Endpoint
`GET /api/system/db-health`
Response:
- `active_database`
- `connection_status`
- `latency_ms`
- `last_successful_query_time`

## Schema Governance
Migrations are stored in `scripts/migrations`.
- `npm run db:sync` applies pending migrations.
- `npm run db:status` shows migration status and schema hash comparison.
- `npm run db:rollback` rolls back the latest migration.

Supabase tracking tables:
- `sca.schema_versions` (version history)
- `sca.db_logs` (audit log)

## Operational Guarantees
- Supabase is always the first-choice database.
- Any fallback is explicitly flagged as degraded and logged.
- Writes are blocked in degraded mode unless explicitly allowed.
- Every write is verified against Supabase (when available).

## Frontend Integration
- All CRUD calls must go through the backend API.
- The frontend includes `X-User-Id` header (stored after login) to enable RBAC checks.
- Never expose `SUPABASE_DB_URL` or direct database credentials in the frontend bundle.

## Debugging & Monitoring
- Check `/api/system/db-health` for runtime DB status.
- Inspect `sca.db_logs` for full audit trail.
- Review Netlify function logs for `DB_DEGRADED_MODE` alerts.
- Use `npm run db:status` to compare local vs remote schema.
