const express = require('express');
const router = express.Router();
const { getDbHealth } = require('../db-health');
const { validateEnv } = require('../db-diagnostics');
const { initDbRouter, getRouterState } = require('../db');

// GET /api/system/db-health
router.get('/db-health', async (req, res) => {
  try {
    const health = await getDbHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message || 'DB health check failed.' });
  }
});

// GET /api/system/db-diagnostics
router.get('/db-diagnostics', async (req, res) => {
  try {
    await initDbRouter();
    const state = getRouterState();
    const diagnostics = validateEnv();
    res.json({
      active_database: state.active || 'none',
      degraded: !!state.degraded,
      degraded_reason: state.degradedReason || null,
      misconfiguration: state.misconfiguration || null,
      supabase: state.supabaseHealth
        ? { ok: !!state.supabaseHealth.ok, error: state.supabaseHealth.error || null }
        : null,
      mssql: state.mssqlHealth
        ? { ok: !!state.mssqlHealth.ok, error: state.mssqlHealth.error || null }
        : null,
      diagnostics
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'DB diagnostics failed.' });
  }
});

module.exports = router;
