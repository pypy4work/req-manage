const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// Import existing admin module for lists
const existingAdminRoutes = require('./admin');

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT user_id, full_name, username, email, role, org_unit_id, job_id, grade_id, salary FROM sca.users ORDER BY full_name`;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/org-units
router.get('/org-units', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT unit_id, unit_name, unit_type_id, parent_unit_id, manager_id FROM sca.organizational_units ORDER BY unit_name`;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/request-types
router.get('/request-types', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT id, name, description, category, unit, fields, is_transfer_type, transfer_config FROM sca.request_types ORDER BY name`;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/request-types (create or update)
router.post('/request-types', async (req, res) => {
  try {
    const def = req.body || {};
    const pool = await getPool();

    const payload = {
      name: def.name,
      description: def.description || null,
      category: def.category || null,
      unit: def.unit || null,
      fields: JSON.stringify(def.fields || []),
      is_transfer_type: def.is_transfer_type ? 1 : 0,
      transfer_config: def.transfer_config ? JSON.stringify(def.transfer_config) : null
    };

    if (!def.id || Number(def.id) === 0) {
      const insert = await pool.request()
        .input('Name', sql.NVarChar(200), payload.name)
        .input('Description', sql.NVarChar(sql.MAX), payload.description)
        .input('Category', sql.NVarChar(50), payload.category)
        .input('Unit', sql.NVarChar(20), payload.unit)
        .input('Fields', sql.NVarChar(sql.MAX), payload.fields)
        .input('IsTransfer', sql.Bit, payload.is_transfer_type)
        .input('TransferConfig', sql.NVarChar(sql.MAX), payload.transfer_config)
        .query(`INSERT INTO sca.request_types (name, description, category, unit, fields, is_transfer_type, transfer_config)
                VALUES (@Name, @Description, @Category, @Unit, @Fields, @IsTransfer, @TransferConfig);
                SELECT SCOPE_IDENTITY() AS id;`);
      return res.json({ id: insert.recordset?.[0]?.id });
    }

    await pool.request()
      .input('Id', sql.Int, Number(def.id))
      .input('Name', sql.NVarChar(200), payload.name)
      .input('Description', sql.NVarChar(sql.MAX), payload.description)
      .input('Category', sql.NVarChar(50), payload.category)
      .input('Unit', sql.NVarChar(20), payload.unit)
      .input('Fields', sql.NVarChar(sql.MAX), payload.fields)
      .input('IsTransfer', sql.Bit, payload.is_transfer_type)
      .input('TransferConfig', sql.NVarChar(sql.MAX), payload.transfer_config)
      .query(`UPDATE sca.request_types
              SET name = @Name,
                  description = @Description,
                  category = @Category,
                  unit = @Unit,
                  fields = @Fields,
                  is_transfer_type = @IsTransfer,
                  transfer_config = @TransferConfig
              WHERE id = @Id`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/request-types/:id
router.delete('/request-types/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM sca.request_types WHERE id = @Id');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-titles
router.get('/job-titles', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT job_id, job_title_ar, job_title_en FROM sca.job_titles ORDER BY job_title_ar`;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-grades
router.get('/job-grades', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT grade_id, grade_code, grade_name, min_salary, max_salary FROM sca.job_grades ORDER BY grade_id`;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { full_name, username, email, role, org_unit_id } = req.body;
    const pool = await getPool();
    const query = `INSERT INTO sca.users (full_name, username, email, role, org_unit_id) VALUES (@FullName, @Username, @Email, @Role, @OrgUnitId);
      SELECT @@IDENTITY as user_id;`;
    const result = await pool.request()
      .input('FullName', sql.NVarChar(300), full_name)
      .input('Username', sql.NVarChar(100), username)
      .input('Email', sql.NVarChar(200), email)
      .input('Role', sql.NVarChar(50), role)
      .input('OrgUnitId', sql.Int, org_unit_id || null)
      .query(query);
    const userId = result.recordset[0].user_id;
    res.json({ user_id: userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query(`DELETE FROM sca.users WHERE user_id = @Id`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/transfer-requests
router.get('/transfer-requests', async (req, res) => {
  try {
    const status = req.query.status;
    const pool = await getPool();
    const request = pool.request();
    if (status) request.input('Status', sql.NVarChar(30), status);
    const query = `
      SELECT 
        tr.transfer_id, tr.user_id, tr.employee_id, tr.employee_name,
        tr.template_id, tr.status, tr.current_unit_id, tr.current_job_id, tr.current_grade_id,
        tr.reason_for_transfer, tr.willing_to_relocate, tr.desired_start_date, tr.additional_notes,
        tr.allocated_unit_id, tr.allocated_job_id, tr.allocation_score, tr.allocation_reason,
        tr.submission_date, tr.approved_by, tr.approval_date, tr.rejection_reason,
        tr.custom_dynamic_fields
      FROM sca.transfer_requests tr
      WHERE (@Status IS NULL OR tr.status = @Status)
      ORDER BY tr.submission_date DESC`;
    const result = await request.query(query);
    const transfers = result.recordset || [];
    if (transfers.length === 0) return res.json([]);

    const ids = transfers.map(t => t.transfer_id).join(',');
    const prefsQuery = `SELECT transfer_id, unit_id, preference_order, reason FROM sca.transfer_preferences WHERE transfer_id IN (${ids}) ORDER BY preference_order`;
    const prefs = await pool.request().query(prefsQuery);
    const prefMap = new Map();
    (prefs.recordset || []).forEach(p => {
      if (!prefMap.has(p.transfer_id)) prefMap.set(p.transfer_id, []);
      prefMap.get(p.transfer_id).push(p);
    });

    res.json(transfers.map(t => ({
      ...t,
      preferred_units: prefMap.get(t.transfer_id) || []
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/transfer-stats
router.get('/transfer-stats', async (req, res) => {
  try {
    const pool = await getPool();
    const stats = await pool.request().query(`
      SELECT
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status IN ('PENDING','MANAGER_REVIEW') THEN 1 ELSE 0 END) as pendingRequests,
        SUM(CASE WHEN status = 'HR_APPROVED' THEN 1 ELSE 0 END) as approvedRequests,
        SUM(CASE WHEN status = 'ALLOCATED' THEN 1 ELSE 0 END) as allocatedRequests
      FROM sca.transfer_requests
    `);
    res.json(stats.recordset?.[0] || { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, allocatedRequests: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/approve
router.post('/transfer-requests/:id/approve', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { nextStatus } = req.body;
    const status = nextStatus || 'HR_APPROVED';
    const pool = await getPool();
    await pool.request()
      .input('TransferId', sql.Int, transferId)
      .input('Status', sql.NVarChar(30), status)
      .query(`UPDATE sca.transfer_requests SET status = @Status, decision_at = GETDATE(), decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/reject
router.post('/transfer-requests/:id/reject', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('TransferId', sql.Int, transferId)
      .input('Reason', sql.NVarChar(sql.MAX), reason || null)
      .query(`UPDATE sca.transfer_requests SET status = 'REJECTED', rejection_reason = @Reason, decision_at = GETDATE(), decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/status
router.post('/transfer-requests/:id/status', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { status } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('TransferId', sql.Int, transferId)
      .input('Status', sql.NVarChar(30), status)
      .query(`UPDATE sca.transfer_requests SET status = @Status WHERE transfer_id = @TransferId`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/permissions
router.get('/permissions', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT permission_key AS [key], label, description, group_name AS [group]
      FROM sca.permissions
      ORDER BY group_name, label
    `);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/user-permissions/:userId
router.get('/user-permissions/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const pool = await getPool();
    const userRole = await pool.request().input('UserId', sql.Int, userId)
      .query('SELECT role FROM sca.users WHERE user_id = @UserId');
    const role = userRole.recordset?.[0]?.role || '';

    const permList = await pool.request().query('SELECT permission_key FROM sca.permissions');
    const allPerms = (permList.recordset || []).map(r => r.permission_key);

    if (String(role).toLowerCase() === 'admin') {
      return res.json(allPerms);
    }

    const assigned = await pool.request().input('UserId', sql.Int, userId)
      .query('SELECT permission_key FROM sca.user_permissions WHERE user_id = @UserId');
    res.json((assigned.recordset || []).map(r => r.permission_key));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/user-permissions/:userId
router.put('/user-permissions/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    const pool = await getPool();
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      await new sql.Request(trx).input('UserId', sql.Int, userId)
        .query('DELETE FROM sca.user_permissions WHERE user_id = @UserId');
      for (const key of permissions) {
        await new sql.Request(trx)
          .input('UserId', sql.Int, userId)
          .input('PermissionKey', sql.NVarChar(100), key)
          .query('INSERT INTO sca.user_permissions (user_id, permission_key, granted_at) VALUES (@UserId, @PermissionKey, GETDATE())');
      }
      await trx.commit();
      res.json({ success: true });
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Use existing admin lists routes
router.use('/', existingAdminRoutes);

module.exports = router;
