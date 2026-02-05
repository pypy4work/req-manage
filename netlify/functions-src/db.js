const sql = require('mssql');
const { Pool: PgPool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

/**
 * دعم ثنائي MSSQL / Postgres من خلال طبقة تجريد بسيطة:
 * - نستخدم متغير DB_DIALECT لتحديد السائق: 'mssql' (الافتراضي) أو 'postgres'
 * - الميثود الموحّد: query(text, params?) يعيد rows[]
 * - getPool() يبقى متاحاً للكود القديم المعتمد على mssql، ولا يتأثر عند اختيار postgres
 *
 * ملاحظة مهمة:
 *  - سكربتات SQL الحالية مكتوبة بصيغة T-SQL (MSSQL) وتستخدم TOP / SCOPE_IDENTITY / NVARCHAR...
 *  - لكي يعمل Postgres فعلياً، يلزم توفير نسخ معادلة من هذه الاستعلامات (أو Stored Procedures) متوافقة مع Postgres.
 *  - هذه الطبقة تضمن أن تغيير نوع قاعدة البيانات يتم في مكان واحد، والباقي مجرد تعديل SQL عند الحاجة.
 */

const DIALECT = (process.env.DB_DIALECT || 'mssql').toLowerCase();

// ========= إعداد MSSQL (كما كان) =========
const mssqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASS || 'Your_password123',
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'master',
  options: {
    encrypt: false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let mssqlPoolPromise = null;

async function getMssqlPool() {
  if (mssqlPoolPromise) return mssqlPoolPromise;
  mssqlPoolPromise = sql.connect(mssqlConfig).then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  }).catch(err => { mssqlPoolPromise = null; throw err; });
  return mssqlPoolPromise;
}

// ========== إعداد Postgres ==========
let pgPool = null;

function getPgPool() {
  if (pgPool) return pgPool;

  // يمكن استخدام POSTGRES_URL (connection string) أو متغيرات منفصلة
  const connectionString = process.env.POSTGRES_URL;

  if (connectionString) {
    pgPool = new PgPool({ connectionString });
  } else {
    pgPool = new PgPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 10
    });
  }

  pgPool.on('error', (err) => {
    console.error('Postgres pool error', err);
  });

  console.log('Postgres pool initialized');
  return pgPool;
}

/**
 * query(text, params?)
 * واجهة موحّدة لتنفيذ الاستعلامات:
 * - text: نص SQL (بصيغة مناسبة لكل DB)
 * - params: كائن بسيط { اسم_المعامل: القيمة }
 *
 * MSSQL:
 *   - نستخدم @ParamName داخل النص
 *   - يتم حقن كل param تلقائياً باستخدام mssql.request().input(...)
 *
 * Postgres:
 *   - نسمح بإعادة استخدام نفس النص مع @ParamName
 *   - داخلياً نستبدل @ParamName بـ $1, $2, ... حسب ترتيب المفاتيح
 */
async function query(text, params = {}) {
  if (DIALECT === 'postgres') {
    const pool = getPgPool();
    const keys = Object.keys(params);
    // استبدال @ParamName بـ $1, $2, ...
    let sqlText = text;
    const values = [];
    keys.forEach((key, index) => {
      const token = '@' + key;
      const pgIndex = '$' + (index + 1);
      sqlText = sqlText.split(token).join(pgIndex);
      values.push(params[key]);
    });
    const result = await pool.query(sqlText, values);
    return result.rows || [];
  }

  // MSSQL (الافتراضي)
  const pool = await getMssqlPool();
  const request = pool.request();
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
  const result = await request.query(text);
  return result.recordset || [];
}

/**
 * getPool()
 * لإبقاء التوافق مع الكود القديم الذي يستدعي getPool() و sql مباشرةً.
 * - عندما يكون DB_DIALECT = mssql → يرجع ConnectionPool الحقيقي.
 * - عندما يكون DB_DIALECT = postgres → ما زال يرجع MSSQL pool، حتى لا ينكسر الكود القديم.
 *   (المسار الموصى به لـ Postgres هو استخدام query() فقط وكتابة SQL متوافق مع Postgres)
 */
async function getPool() {
  return getMssqlPool();
}

/**
 * Helper: SQL متوافق مع Postgres و MSSQL
 * - LIMIT: Postgres يستخدم LIMIT، MSSQL يستخدم TOP
 * - COALESCE: متوافق مع الاثنين (بديل ISNULL)
 * - RETURNING: Postgres فقط، MSSQL يستخدم SCOPE_IDENTITY()
 */
function sqlLimit(count) {
  return DIALECT === 'postgres' ? `LIMIT ${count}` : `TOP ${count}`;
}

function sqlCoalesce(...args) {
  return `COALESCE(${args.join(', ')})`;
}

/**
 * insertAndGetId(sqlText, params, idColumn = 'id')
 * تنفيذ INSERT وإرجاع الـ ID المُنشأ:
 * - Postgres: يستخدم RETURNING id
 * - MSSQL: يستخدم SCOPE_IDENTITY() في استعلام منفصل
 */
async function insertAndGetId(sqlText, params = {}, idColumn = 'id') {
  if (DIALECT === 'postgres') {
    const returningSql = `${sqlText} RETURNING ${idColumn}`;
    const rows = await query(returningSql, params);
    return rows[0]?.[idColumn] || null;
  }

  // MSSQL: نستخدم SCOPE_IDENTITY()
  const pool = await getMssqlPool();
  const request = pool.request();
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
  const combinedSql = `${sqlText}; SELECT SCOPE_IDENTITY() AS ${idColumn}`;
  const result = await request.query(combinedSql);
  return result.recordset?.[0]?.[idColumn] || null;
}

/**
 * withTransaction(callback)
 * تنفيذ عدة استعلامات داخل Transaction:
 * - Postgres: يستخدم BEGIN/COMMIT/ROLLBACK
 * - MSSQL: يستخدم sql.Transaction
 */
async function withTransaction(callback) {
  if (DIALECT === 'postgres') {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback({
        query: async (text, params = {}) => {
          const keys = Object.keys(params);
          let sqlText = text;
          const values = [];
          keys.forEach((key, index) => {
            const token = '@' + key;
            const pgIndex = '$' + (index + 1);
            sqlText = sqlText.split(token).join(pgIndex);
            values.push(params[key]);
          });
          const res = await client.query(sqlText, values);
          return { rows: res.rows || [] };
        }
      });
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // MSSQL
  const pool = await getMssqlPool();
  const trx = new sql.Transaction(pool);
  await trx.begin();
  try {
    const result = await callback({
      query: async (text, params = {}) => {
        const req = new sql.Request(trx);
        Object.entries(params).forEach(([key, value]) => {
          req.input(key, value);
        });
        const res = await req.query(text);
        return { rows: res.recordset || [] };
      }
    });
    await trx.commit();
    return result;
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}

module.exports = { sql, getPool, query, DIALECT, sqlLimit, sqlCoalesce, insertAndGetId, withTransaction };
