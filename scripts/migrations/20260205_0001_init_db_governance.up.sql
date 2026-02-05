CREATE SCHEMA IF NOT EXISTS sca;

CREATE TABLE IF NOT EXISTS sca.schema_versions (
  version_id BIGSERIAL PRIMARY KEY,
  version_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT,
  schema_hash TEXT,
  execution_ms INT,
  rollback_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sca.db_logs (
  log_id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  database_type TEXT NOT NULL,
  operation TEXT,
  sql_text TEXT,
  params JSONB,
  affected_rows INT,
  execution_ms INT,
  user_id TEXT,
  endpoint TEXT,
  request_id TEXT,
  status TEXT,
  error_message TEXT,
  verification_status TEXT,
  verification_details JSONB,
  source_service TEXT,
  is_verification BOOLEAN NOT NULL DEFAULT FALSE,
  environment TEXT
);
