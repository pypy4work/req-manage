const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'identifier and password required' });

    const pool = await getPool();
    const request = pool.request();
    request.input('ident', sql.NVarChar(200), identifier);
    // Try to match username or email or national_id
    const query = `SELECT TOP 1 user_id, full_name, username, email, role, org_unit_id, job_id, grade_id, picture_url FROM sca.users WHERE username = @ident OR email = @ident OR national_id = @ident`;
    const result = await request.query(query);
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.recordset[0];

    // NOTE: This demo accepts any password. Replace with hashed password verification in production.
    return res.json({ status: 'SUCCESS', user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
