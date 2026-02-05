let memory = {
  tables: {}
};

function ensureTable(name) {
  if (!memory.tables[name]) memory.tables[name] = [];
  return memory.tables[name];
}

async function query(text, params = {}) {
  console.warn('[MockDB] Query executed', { text });
  return { rows: [], rowCount: 0 };
}

async function insertAndGetId(sqlText, params = {}, idColumn = 'id') {
  console.warn('[MockDB] Insert executed', { sqlText });
  return { id: Date.now(), rows: [], rowCount: 1 };
}

async function withTransaction(callback) {
  return callback({ query });
}

async function ping() {
  return {
    ok: true,
    latencyMs: 0,
    timings: [{ name: 'mock', ms: 0 }],
    lastSuccessfulQueryTime: new Date().toISOString()
  };
}

module.exports = {
  type: 'mock',
  dialect: 'mock',
  query,
  insertAndGetId,
  withTransaction,
  ping,
  _memory: memory,
  _ensureTable: ensureTable
};
