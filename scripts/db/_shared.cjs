require('dotenv').config()
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function getConnectionString() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING ||
    ''
  );
}

function ensureConnectionString() {
  const conn = getConnectionString();
  if (!conn) {
    throw new Error('Missing SUPABASE_DB_URL or POSTGRES_URL.');
  }
  return conn;
}

async function getClient() {
  const conn = ensureConnectionString();
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

function migrationsDir() {
  return path.join(__dirname, '..', 'migrations');
}

function loadMigrations() {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const upFiles = files.filter((f) => f.endsWith('.up.sql'));

  return upFiles
    .map((file) => {
      const versionKey = file.replace('.up.sql', '');
      const upPath = path.join(dir, file);
      const downPath = path.join(dir, `${versionKey}.down.sql`);
      const upSql = fs.readFileSync(upPath, 'utf8');
      const checksum = sha256(normalizeSql(upSql));
      return {
        versionKey,
        upPath,
        downPath: fs.existsSync(downPath) ? downPath : null,
        checksum
      };
    })
    .sort((a, b) => a.versionKey.localeCompare(b.versionKey));
}

function normalizeSql(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureGovernanceTables(client) {
  const sql = `
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
  `;
  await client.query(sql);
}

async function getAppliedMigrations(client) {
  const res = await client.query(
    `SELECT version_key, checksum, status, applied_at, rollback_at
     FROM sca.schema_versions
     ORDER BY applied_at`
  );
  return res.rows || [];
}

async function recordMigration(client, { versionKey, checksum, appliedBy, executionMs, schemaHash, notes }) {
  await client.query(
    `INSERT INTO sca.schema_versions (version_key, checksum, applied_by, execution_ms, schema_hash, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`
    , [versionKey, checksum, appliedBy || null, executionMs || null, schemaHash || null, notes || null]
  );
}

async function markRollback(client, versionKey) {
  await client.query(
    `UPDATE sca.schema_versions
     SET status = 'rolled_back', rollback_at = NOW()
     WHERE version_key = $1`,
    [versionKey]
  );
}

function computeLocalSchemaHash() {
  const schemaPath = path.join(__dirname, '..', 'create_schema_postgres.sql');
  if (!fs.existsSync(schemaPath)) return null;
  const content = fs.readFileSync(schemaPath, 'utf8');
  return sha256(normalizeSql(content));
}

async function computeRemoteSchemaHash(client) {
  const res = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'sca'
     ORDER BY table_name, ordinal_position`
  );
  const signature = JSON.stringify(res.rows || []);
  return sha256(signature);
}

module.exports = {
  getClient,
  loadMigrations,
  ensureGovernanceTables,
  getAppliedMigrations,
  recordMigration,
  markRollback,
  computeLocalSchemaHash,
  computeRemoteSchemaHash,
  normalizeSql,
  sha256
};
