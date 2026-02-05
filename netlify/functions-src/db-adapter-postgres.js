const { Pool } = require('pg');
const { getSupabaseConfig } = require('./db-config');

let pgPool = null;

function getPool() {
  if (pgPool) return pgPool;
  const config = getSupabaseConfig();

  if (config.connectionString) {
    pgPool = new Pool({ connectionString: config.connectionString, ssl: config.ssl });
  } else {
    pgPool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: 10
    });
  }

  pgPool.on('error', (err) => {
    console.error('Postgres pool error', err);
  });

  return pgPool;
}

function replaceNamedParams(text, params) {
  const keys = Object.keys(params || {});
  if (keys.length === 0) return { sqlText: text, values: [] };

  let sqlText = text;
  const values = [];
  keys.forEach((key, index) => {
    const token = new RegExp(`@${key}\\b`, 'g');
    const pgIndex = `$${index + 1}`;
    sqlText = sqlText.replace(token, pgIndex);
    values.push(params[key]);
  });
  return { sqlText, values };
}

async function query(text, params = {}) {
  const pool = getPool();
  const { sqlText, values } = replaceNamedParams(text, params);
  const result = await pool.query(sqlText, values);
  return {
    rows: result.rows || [],
    rowCount: typeof result.rowCount === 'number' ? result.rowCount : (result.rows ? result.rows.length : 0)
  };
}

async function insertAndGetId(sqlText, params = {}, idColumn = 'id') {
  const returningSql = `${sqlText} RETURNING ${idColumn}`;
  const result = await query(returningSql, params);
  const id = result.rows?.[0]?.[idColumn] || null;
  return { id, rows: result.rows, rowCount: result.rowCount };
}

async function withTransaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: async (text, params = {}) => {
        const { sqlText, values } = replaceNamedParams(text, params);
        const res = await client.query(sqlText, values);
        return {
          rows: res.rows || [],
          rowCount: typeof res.rowCount === 'number' ? res.rowCount : (res.rows ? res.rows.length : 0)
        };
      }
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ping() {
  const start = Date.now();
  const timings = [];
  const queries = [
    { name: 'select_1', sql: 'SELECT 1' },
    { name: 'select_now', sql: 'SELECT NOW() AS now' },
    { name: 'select_count', sql: 'SELECT COUNT(*)::int AS count FROM sca.users' }
  ];

  for (const q of queries) {
    const qStart = Date.now();
    await query(q.sql);
    timings.push({ name: q.name, ms: Date.now() - qStart });
  }

  return {
    ok: true,
    latencyMs: Date.now() - start,
    timings,
    lastSuccessfulQueryTime: new Date().toISOString()
  };
}

module.exports = {
  type: 'supabase',
  dialect: 'postgres',
  getPool,
  query,
  insertAndGetId,
  withTransaction,
  ping
};
