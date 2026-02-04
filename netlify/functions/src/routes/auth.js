const express = require('express');
const router = express.Router();
const { query, DIALECT, sqlLimit } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'identifier and password required' });

    // SQL متوافق مع Postgres و MSSQL
    const limitClause = DIALECT === 'postgres' ? 'LIMIT 1' : 'TOP 1';
    const sqlText = `SELECT ${limitClause} user_id, full_name, username, email, role, org_unit_id, job_id, grade_id, picture_url 
      FROM sca.users 
      WHERE username = @ident OR email = @ident OR national_id = @ident`;
    
    const rows = await query(sqlText, { ident: identifier });
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    // NOTE: This demo accepts any password. Replace with hashed password verification in production.
    return res.json({ status: 'SUCCESS', user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
