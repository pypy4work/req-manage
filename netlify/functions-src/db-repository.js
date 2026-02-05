const { initDbRouter, getActiveAdapter, getSupabaseAdapter, getRouterState, getDialectSync } = require('./db-router');
const { getRouterConfig } = require('./db-config');
const { logDbOperation } = require('./db-logging');
const { sendCriticalAlert } = require('./db-alerts');

const routerConfig = getRouterConfig();

function normalizeSql(sqlText) {
  return String(sqlText || '').trim().replace(/\s+/g, ' ');
}

function inferOperation(sqlText) {
  const normalized = normalizeSql(sqlText).toLowerCase();
  return normalized.split(' ')[0] || 'unknown';
}

function inferTable(sqlText, operation) {
  const normalized = normalizeSql(sqlText);
  let match = null;
  if (operation === 'insert') {
    match = normalized.match(/insert\s+into\s+([a-zA-Z0-9_.\"]+)/i);
  } else if (operation === 'update') {
    match = normalized.match(/update\s+([a-zA-Z0-9_.\"]+)/i);
  } else if (operation === 'delete') {
    match = normalized.match(/delete\s+from\s+([a-zA-Z0-9_.\"]+)/i);
  }
  if (!match) return null;
  return match[1].replace(/"/g, '');
}

function inferWhereParam(sqlText) {
  const normalized = normalizeSql(sqlText);
  const match = normalized.match(/where\s+([a-zA-Z0-9_.\"]+)\s*=\s*@([a-zA-Z0-9_]+)/i);
  if (!match) return null;
  return {
    column: match[1].replace(/"/g, ''),
    param: match[2]
  };
}

function inferExpectedFromInsert(sqlText, params = {}) {
  const normalized = normalizeSql(sqlText);
  const match = normalized.match(/insert\s+into\s+[a-zA-Z0-9_.\"]+\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
  if (!match) return null;
  const columns = match[1].split(',').map((c) => c.trim().replace(/"/g, ''));
  const values = match[2].split(',').map((v) => v.trim());
  if (columns.length !== values.length) return null;
  const expected = {};
  columns.forEach((col, idx) => {
    const token = values[idx];
    const paramMatch = token.match(/^@([a-zA-Z0-9_]+)$/);
    if (paramMatch) {
      const paramName = paramMatch[1];
      if (Object.prototype.hasOwnProperty.call(params, paramName)) {
        expected[col] = params[paramName];
      }
    }
  });
  return Object.keys(expected).length ? expected : null;
}

function inferExpectedFromUpdate(sqlText, params = {}) {
  const normalized = normalizeSql(sqlText);
  const match = normalized.match(/set\s+(.+?)\s+where\s+/i);
  if (!match) return null;
  const assignments = match[1].split(',').map((item) => item.trim());
  const expected = {};
  assignments.forEach((assignment) => {
    const parts = assignment.split('=').map((p) => p.trim());
    if (parts.length !== 2) return;
    const column = parts[0].replace(/"/g, '');
    const token = parts[1];
    const paramMatch = token.match(/^@([a-zA-Z0-9_]+)$/);
    if (paramMatch) {
      const paramName = paramMatch[1];
      if (Object.prototype.hasOwnProperty.call(params, paramName)) {
        expected[column] = params[paramName];
      }
    }
  });
  return Object.keys(expected).length ? expected : null;
}

function valuesEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).toISOString() === new Date(b).toISOString();
  }
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b || a === Number(b);
  if (typeof b === 'number' && typeof a === 'string') return String(b) === a || b === Number(a);
  if (typeof a === 'object' || typeof b === 'object') return true;
  return String(a) === String(b);
}

function isWriteOperation(operation) {
  return ['insert', 'update', 'delete'].includes(operation);
}

function sqlLimit(count) {
  return getDialectSync() === 'postgres' ? `LIMIT ${count}` : `TOP ${count}`;
}

function sqlCoalesce(...args) {
  return `COALESCE(${args.join(', ')})`;
}

async function verifyWrite({ operation, table, params, idColumn, idValue, where, expected }) {
  const state = getRouterState();
  if (!state.supabaseHealth?.ok) {
    return { status: 'skipped', details: { reason: 'supabase_unavailable' } };
  }
  if (!table) {
    return { status: 'skipped', details: { reason: 'table_not_inferred' } };
  }

  const adapter = getSupabaseAdapter();
  if (!adapter) {
    return { status: 'skipped', details: { reason: 'supabase_adapter_missing' } };
  }

  let verificationSql = null;
  let verificationParams = {};

  if (operation === 'insert' && idColumn && idValue != null) {
    verificationSql = `SELECT * FROM ${table} WHERE ${idColumn} = @VerifyId`;
    verificationParams = { VerifyId: idValue };
  } else if ((operation === 'update' || operation === 'delete') && where?.column && where?.param) {
    const value = params?.[where.param];
    if (value == null) {
      return { status: 'skipped', details: { reason: 'where_param_missing' } };
    }
    verificationSql = `SELECT * FROM ${table} WHERE ${where.column} = @VerifyValue`;
    verificationParams = { VerifyValue: value };
  } else {
    return { status: 'skipped', details: { reason: 'insufficient_verification_metadata' } };
  }

  try {
    const result = await adapter.query(verificationSql, verificationParams);
    const exists = (result.rows || []).length > 0;
    const row = result.rows?.[0] || null;

    if (operation === 'delete') {
      return exists
        ? { status: 'mismatch', details: { reason: 'row_still_exists' } }
        : { status: 'ok', details: { reason: 'row_deleted' } };
    }

    if (!exists) return { status: 'mismatch', details: { reason: 'row_missing' } };

    if (expected && row) {
      const mismatches = Object.keys(expected).filter((key) => !valuesEqual(expected[key], row[key]));
      if (mismatches.length > 0) {
        return { status: 'mismatch', details: { reason: 'value_mismatch', fields: mismatches } };
      }
    }

    return { status: 'ok', details: { reason: 'row_verified' } };
  } catch (err) {
    return { status: 'failed', details: { error: err.message || String(err) } };
  }
}

async function guardDegradedWrites(operation, sqlText) {
  const state = getRouterState();
  if (!state.degraded || !state.degradedReadOnly) return;
  if (!isWriteOperation(operation)) return;
  await sendCriticalAlert({
    type: 'DB_WRITE_BLOCKED',
    message: 'Write operation blocked in degraded mode.',
    details: { sql: sqlText, active: state.active }
  });
  const error = new Error('Database is in degraded read-only mode. Write operations are blocked.');
  error.statusCode = 503;
  throw error;
}

async function query(sqlText, params = {}, options = {}) {
  await initDbRouter();
  const adapter = getActiveAdapter();
  if (!adapter) {
    const err = new Error('No active database adapter available.');
    err.statusCode = 503;
    throw err;
  }

  const operation = options.operation || inferOperation(sqlText);
  await guardDegradedWrites(operation, sqlText);

  const start = Date.now();
  let result;
  let error;
  try {
    result = await adapter.query(sqlText, params);
  } catch (err) {
    error = err;
  }
  const durationMs = Date.now() - start;
  const affectedRows = result?.rowCount ?? (result?.rows ? result.rows.length : 0);

  let verification = { status: null, details: null };
  if (!error && isWriteOperation(operation) && (routerConfig.verifyWrites || options.verify)) {
    const table = options.table || inferTable(sqlText, operation);
    const where = options.where || inferWhereParam(sqlText);
    const expected = options.expected || (operation === 'update' ? inferExpectedFromUpdate(sqlText, params) : null);
    verification = await verifyWrite({
      operation,
      table,
      params,
      where,
      idColumn: options.idColumn,
      idValue: options.idValue,
      expected
    });
  }

  await logDbOperation({
    databaseType: adapter.type,
    operation,
    sqlText,
    params,
    affectedRows,
    durationMs,
    status: error ? 'error' : 'ok',
    errorMessage: error ? error.message : null,
    verificationStatus: verification.status,
    verificationDetails: verification.details
  });

  if (error) throw error;
  return result.rows || [];
}

async function insertAndGetId(sqlText, params = {}, idColumn = 'id', options = {}) {
  await initDbRouter();
  const state = getRouterState();
  const adapter = getActiveAdapter();
  if (!adapter) {
    const err = new Error('No active database adapter available.');
    err.statusCode = 503;
    throw err;
  }

  await guardDegradedWrites('insert', sqlText);

  const start = Date.now();
  let result;
  let error;
  try {
    result = await adapter.insertAndGetId(sqlText, params, idColumn);
  } catch (err) {
    error = err;
  }
  const durationMs = Date.now() - start;
  const affectedRows = result?.rowCount ?? 0;
  const idValue = result?.id ?? null;

  let verification = { status: null, details: null };
  if (!error && (routerConfig.verifyWrites || options.verify)) {
    const table = options.table || inferTable(sqlText, 'insert');
    const expected = options.expected || inferExpectedFromInsert(sqlText, params);
    verification = await verifyWrite({
      operation: 'insert',
      table,
      params,
      idColumn: options.idColumn || idColumn,
      idValue,
      expected
    });
  }

  await logDbOperation({
    databaseType: adapter.type,
    operation: 'insert',
    sqlText,
    params,
    affectedRows,
    durationMs,
    status: error ? 'error' : 'ok',
    errorMessage: error ? error.message : null,
    verificationStatus: verification.status,
    verificationDetails: verification.details
  });

  if (error) throw error;
  return idValue;
}

async function withTransaction(callback) {
  await initDbRouter();
  const adapter = getActiveAdapter();
  if (!adapter) {
    const err = new Error('No active database adapter available.');
    err.statusCode = 503;
    throw err;
  }
  const state = getRouterState();
  if (state.degraded && state.degradedReadOnly) {
    const error = new Error('Database is in degraded read-only mode. Transactions are blocked.');
    error.statusCode = 503;
    throw error;
  }

  return adapter.withTransaction(async (tx) => {
    const txQuery = async (sqlText, params = {}, options = {}) => {
      const operation = options.operation || inferOperation(sqlText);
      const start = Date.now();
      let result;
      let error;
      try {
        result = await tx.query(sqlText, params);
      } catch (err) {
        error = err;
      }
      const durationMs = Date.now() - start;
      const affectedRows = result?.rowCount ?? (result?.rows ? result.rows.length : 0);

      await logDbOperation({
        databaseType: adapter.type,
        operation: `transaction:${operation}`,
        sqlText,
        params,
        affectedRows,
        durationMs,
        status: error ? 'error' : 'ok'
      });

      if (error) throw error;
      return result;
    };

    return callback({ query: txQuery });
  });
}

async function getPool() {
  await initDbRouter();
  const adapter = getActiveAdapter();
  return adapter?.getPool ? adapter.getPool() : null;
}

function getDialect() {
  return getDialectSync();
}

const exportsObj = {
  query,
  insertAndGetId,
  withTransaction,
  sqlLimit,
  sqlCoalesce,
  getPool,
  getDialect
};

Object.defineProperty(exportsObj, 'DIALECT', {
  enumerable: true,
  get: () => getDialectSync()
});

Object.defineProperty(exportsObj, 'sql', {
  enumerable: true,
  get: () => {
    const adapter = getActiveAdapter();
    return adapter?.sql || null;
  }
});

module.exports = exportsObj;
