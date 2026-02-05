const DEFAULT_PORTS = {
  postgres: 5432,
  mssql: 1433
};

function getSupabaseConfig() {
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING ||
    '';

  const host = process.env.DB_HOST || process.env.PGHOST || '';
  const port = process.env.DB_PORT || process.env.PGPORT || DEFAULT_PORTS.postgres;
  const database = process.env.DB_NAME || process.env.PGDATABASE || 'postgres';
  const user = process.env.DB_USER || process.env.PGUSER || 'postgres';
  const password = process.env.DB_PASS || process.env.PGPASSWORD || '';
  const ssl =
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    process.env.SUPABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production';

  return {
    connectionString: connectionString || '',
    host,
    port: port ? Number(port) : DEFAULT_PORTS.postgres,
    database,
    user,
    password,
    ssl: ssl ? { rejectUnauthorized: false } : undefined
  };
}

function getMssqlConfig() {
  return {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASS || 'Your_password123',
    server: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'master',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : DEFAULT_PORTS.mssql,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      enableArithAbort: true,
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

function getRouterConfig() {
  return {
    forceDialect: (process.env.DB_DIALECT || '').toLowerCase(),
    allowForce: process.env.DB_ROUTER_ALLOW_FORCE === 'true',
    allowFallback: process.env.DB_ROUTER_ALLOW_FALLBACK === 'true',
    allowMock: process.env.DB_ROUTER_ALLOW_MOCK === 'true',
    requireSupabase: process.env.DB_ROUTER_REQUIRE_SUPABASE !== 'false',
    degradedReadOnly: process.env.DB_DEGRADED_READONLY !== 'false',
    verifyWrites: process.env.DB_VERIFY_WRITES !== 'false'
  };
}

module.exports = {
  getSupabaseConfig,
  getMssqlConfig,
  getRouterConfig
};
