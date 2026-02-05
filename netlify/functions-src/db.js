// Unified database repository (Supabase-first) with routing, logging, and verification.
// This file preserves the legacy import path: require('../db').

const repository = require('./db-repository');
const { initDbRouter, getRouterState } = require('./db-router');

module.exports = repository;
module.exports.initDbRouter = initDbRouter;
module.exports.getRouterState = getRouterState;
