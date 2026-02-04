const express = require('express');
const router = express.Router();
const { query, DIALECT, insertAndGetId, withTransaction } = require('../db');

// Import existing admin module for lists
const existingAdminRoutes = require('./admin');

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const rows = await query('SELECT user_id, full_name, username, email, role, org_unit_id, job_id, grade_id, salary FROM sca.users ORDER BY full_name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/org-units
router.get('/org-units', async (req, res) => {
  try {
    const rows = await query('SELECT unit_id, unit_name, unit_type_id, parent_unit_id, manager_id FROM sca.organizational_units ORDER BY unit_name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/request-types
router.get('/request-types', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, description, category, unit, fields, is_transfer_type, transfer_config FROM sca.request_types ORDER BY name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/request-types (create or update)
router.post('/request-types', async (req, res) => {
  try {
    const def = req.body || {};

    const fieldsJson = DIALECT === 'postgres' 
      ? JSON.stringify(def.fields || [])
      : JSON.stringify(def.fields || []);
    const transferConfigJson = def.transfer_config ? JSON.stringify(def.transfer_config) : null;
    const isTransferBool = def.is_transfer_type ? (DIALECT === 'postgres' ? true : 1) : (DIALECT === 'postgres' ? false : 0);

    if (!def.id || Number(def.id) === 0) {
      const sqlText = `INSERT INTO sca.request_types (name, description, category, unit, fields, is_transfer_type, transfer_config)
        VALUES (@Name, @Description, @Category, @Unit, @Fields, @IsTransfer, @TransferConfig)`;
      const newId = await insertAndGetId(sqlText, {
        Name: def.name,
        Description: def.description || null,
        Category: def.category || null,
        Unit: def.unit || null,
        Fields: fieldsJson,
        IsTransfer: isTransferBool,
        TransferConfig: transferConfigJson
      }, 'id');
      return res.json({ id: newId });
    }

    await query(
      `UPDATE sca.request_types
       SET name = @Name,
           description = @Description,
           category = @Category,
           unit = @Unit,
           fields = @Fields,
           is_transfer_type = @IsTransfer,
           transfer_config = @TransferConfig
       WHERE id = @Id`,
      {
        Id: Number(def.id),
        Name: def.name,
        Description: def.description || null,
        Category: def.category || null,
        Unit: def.unit || null,
        Fields: fieldsJson,
        IsTransfer: isTransferBool,
        TransferConfig: transferConfigJson
      }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/request-types/:id
router.delete('/request-types/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM sca.request_types WHERE id = @Id', { Id: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-titles
router.get('/job-titles', async (req, res) => {
  try {
    const rows = await query('SELECT job_id, job_title_ar, job_title_en FROM sca.job_titles ORDER BY job_title_ar');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-grades
router.get('/job-grades', async (req, res) => {
  try {
    const rows = await query('SELECT grade_id, grade_code, grade_name, min_salary, max_salary FROM sca.job_grades ORDER BY grade_id');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { full_name, username, email, role, org_unit_id } = req.body;
    const sqlText = 'INSERT INTO sca.users (full_name, username, email, role, org_unit_id) VALUES (@FullName, @Username, @Email, @Role, @OrgUnitId)';
    const userId = await insertAndGetId(sqlText, {
      FullName: full_name,
      Username: username,
      Email: email,
      Role: role,
      OrgUnitId: org_unit_id || null
    }, 'user_id');
    res.json({ user_id: userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM sca.users WHERE user_id = @Id', { Id: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/transfer-requests
router.get('/transfer-requests', async (req, res) => {
  try {
    const status = req.query.status;
    const sqlText = status
      ? `SELECT tr.transfer_id, tr.user_id, tr.employee_id, tr.employee_name, tr.template_id, tr.status, tr.current_unit_id, tr.current_job_id, tr.current_grade_id,
         tr.reason_for_transfer, tr.willing_to_relocate, tr.desired_start_date, tr.additional_notes,
         tr.allocated_unit_id, tr.allocated_job_id, tr.allocation_score, tr.allocation_reason,
         tr.submission_date, tr.approved_by, tr.approval_date, tr.rejection_reason, tr.custom_dynamic_fields
         FROM sca.transfer_requests tr WHERE tr.status = @Status ORDER BY tr.submission_date DESC`
      : `SELECT tr.transfer_id, tr.user_id, tr.employee_id, tr.employee_name, tr.template_id, tr.status, tr.current_unit_id, tr.current_job_id, tr.current_grade_id,
         tr.reason_for_transfer, tr.willing_to_relocate, tr.desired_start_date, tr.additional_notes,
         tr.allocated_unit_id, tr.allocated_job_id, tr.allocation_score, tr.allocation_reason,
         tr.submission_date, tr.approved_by, tr.approval_date, tr.rejection_reason, tr.custom_dynamic_fields
         FROM sca.transfer_requests tr ORDER BY tr.submission_date DESC`;
    
    const transfers = await query(sqlText, status ? { Status: status } : {});
    if (transfers.length === 0) return res.json([]);

    const ids = transfers.map(t => t.transfer_id);
    const placeholders = DIALECT === 'postgres' 
      ? ids.map((_, i) => `$${i + 1}`).join(',')
      : ids.join(',');
    
    const prefsSql = DIALECT === 'postgres'
      ? `SELECT transfer_id, unit_id, preference_order, reason FROM sca.transfer_preferences WHERE transfer_id = ANY($1::bigint[]) ORDER BY preference_order`
      : `SELECT transfer_id, unit_id, preference_order, reason FROM sca.transfer_preferences WHERE transfer_id IN (${placeholders}) ORDER BY preference_order`;
    
    const prefsParams = DIALECT === 'postgres' ? { '1': ids } : {};
    const prefs = await query(prefsSql, prefsParams);

    const prefMap = new Map();
    (prefs || []).forEach(p => {
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
    const rows = await query(`
      SELECT
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status IN ('PENDING','MANAGER_REVIEW') THEN 1 ELSE 0 END) as pendingRequests,
        SUM(CASE WHEN status = 'HR_APPROVED' THEN 1 ELSE 0 END) as approvedRequests,
        SUM(CASE WHEN status = 'ALLOCATED' THEN 1 ELSE 0 END) as allocatedRequests
      FROM sca.transfer_requests
    `);
    res.json(rows?.[0] || { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, allocatedRequests: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/approve
router.post('/transfer-requests/:id/approve', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { nextStatus } = req.body;
    const status = nextStatus || 'HR_APPROVED';
    const nowFunc = DIALECT === 'postgres' ? 'NOW()' : 'GETDATE()';
    
    await query(
      `UPDATE sca.transfer_requests SET status = @Status, decision_at = ${nowFunc}, decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`,
      { TransferId: transferId, Status: status }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/reject
router.post('/transfer-requests/:id/reject', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason } = req.body;
    const nowFunc = DIALECT === 'postgres' ? 'NOW()' : 'GETDATE()';
    
    await query(
      `UPDATE sca.transfer_requests SET status = 'REJECTED', rejection_reason = @Reason, decision_at = ${nowFunc}, decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`,
      { TransferId: transferId, Reason: reason || null }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/status
router.post('/transfer-requests/:id/status', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { status } = req.body;
    await query(
      'UPDATE sca.transfer_requests SET status = @Status WHERE transfer_id = @TransferId',
      { TransferId: transferId, Status: status }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/permissions
router.get('/permissions', async (req, res) => {
  try {
    const rows = await query(`
      SELECT permission_key AS key, label, description, group_name AS group
      FROM sca.permissions
      ORDER BY group_name, label
    `);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/user-permissions/:userId
router.get('/user-permissions/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const userRows = await query('SELECT role FROM sca.users WHERE user_id = @UserId', { UserId: userId });
    const role = userRows[0]?.role || '';

    const permRows = await query('SELECT permission_key FROM sca.permissions');
    const allPerms = (permRows || []).map(r => r.permission_key);

    if (String(role).toLowerCase() === 'admin') {
      return res.json(allPerms);
    }

    const assignedRows = await query('SELECT permission_key FROM sca.user_permissions WHERE user_id = @UserId', { UserId: userId });
    res.json((assignedRows || []).map(r => r.permission_key));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/user-permissions/:userId
router.put('/user-permissions/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    
    await withTransaction(async (tx) => {
      await tx.query('DELETE FROM sca.user_permissions WHERE user_id = @UserId', { UserId: userId });
      
      const nowFunc = DIALECT === 'postgres' ? 'NOW()' : 'GETDATE()';
      for (const key of permissions) {
        await tx.query(
          `INSERT INTO sca.user_permissions (user_id, permission_key, granted_at) VALUES (@UserId, @PermissionKey, ${nowFunc})`,
          { UserId: userId, PermissionKey: key }
        );
      }
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Use existing admin lists routes
router.use('/', existingAdminRoutes);

module.exports = router;
