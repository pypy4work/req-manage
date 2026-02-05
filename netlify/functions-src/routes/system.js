const express = require('express');
const router = express.Router();
const { getDbHealth } = require('../db-health');

// GET /api/system/db-health
router.get('/db-health', async (req, res) => {
  try {
    const health = await getDbHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message || 'DB health check failed.' });
  }
});

module.exports = router;
