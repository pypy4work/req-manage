const sql = require('mssql');
const { getMssqlConfig } = require('./db-config');

let poolPromise = null;

async function getPool() {
  if (poolPromise) return poolPromise;
  const config = getMssqlConfig();
  poolPromise = sql.connect(config).then((pool) => {
    console.log('Connected to MSSQL');
    return pool;
  }).catch((err) => {
    poolPromise = null;
    throw err;
  });
  return poolPromise;
}

async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  Object.entries(params || {}).forEach(([key, value]) => {
    request.input(key, value);
  });
  const result = await request.query(text);
  return {
    rows: result.recordset || [],
    rowCount: typeof result.rowsAffected?.[0] === 'number' ? result.rowsAffected[0] : (result.recordset ? result.recordset.length : 0)
  };
}

async function insertAndGetId(sqlText, params = {}, idColumn = 'id') {
  const pool = await getPool();
  const request = pool.request();
  Object.entries(params || {}).forEach(([key, value]) => {
    request.input(key, value);
  });
  const combinedSql = `${sqlText}; SELECT SCOPE_IDENTITY() AS ${idColumn}`;
  const result = await request.query(combinedSql);
  const id = result.recordset?.[0]?.[idColumn] || null;
  return {
    id,
    rows: result.recordset || [],
    rowCount: typeof result.rowsAffected?.[0] === 'number' ? result.rowsAffected[0] : (result.recordset ? result.recordset.length : 0)
  };
}

async function withTransaction(callback) {
  const pool = await getPool();
  const trx = new sql.Transaction(pool);
  await trx.begin();
  try {
    const result = await callback({
      query: async (text, params = {}) => {
        const request = new sql.Request(trx);
        Object.entries(params || {}).forEach(([key, value]) => {
          request.input(key, value);
        });
        const res = await request.query(text);
        return {
          rows: res.recordset || [],
          rowCount: typeof res.rowsAffected?.[0] === 'number' ? res.rowsAffected[0] : (res.recordset ? res.recordset.length : 0)
        };
      }
    });
    await trx.commit();
    return result;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

async function ping() {
  const start = Date.now();
  await query('SELECT 1');
  return {
    ok: true,
    latencyMs: Date.now() - start,
    timings: [{ name: 'select_1', ms: Date.now() - start }],
    lastSuccessfulQueryTime: new Date().toISOString()
  };
}

module.exports = {
  type: 'mssql',
  dialect: 'mssql',
  sql,
  getPool,
  query,
  insertAndGetId,
  withTransaction,
  ping
};
