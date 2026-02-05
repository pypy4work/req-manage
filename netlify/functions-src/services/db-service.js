const db = require('../db');

const query = (sqlText, params = {}, options = {}) => db.query(sqlText, params, options);
const insertAndGetId = (sqlText, params = {}, idColumn = 'id', options = {}) => db.insertAndGetId(sqlText, params, idColumn, options);
const withTransaction = (callback) => db.withTransaction(callback);
const sqlLimit = (count) => db.sqlLimit(count);
const sqlCoalesce = (...args) => db.sqlCoalesce(...args);
const getDialect = () => db.getDialect();

module.exports = {
  query,
  insertAndGetId,
  withTransaction,
  sqlLimit,
  sqlCoalesce,
  getDialect
};
