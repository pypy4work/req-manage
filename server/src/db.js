const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config();

const config = {
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

let poolPromise = null;

async function getPool() {
  if (poolPromise) return poolPromise;
  poolPromise = sql.connect(config).then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  }).catch(err => { poolPromise = null; throw err; });
  return poolPromise;
}

module.exports = { sql, getPool };
