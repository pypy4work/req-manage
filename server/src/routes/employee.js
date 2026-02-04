const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// GET /api/employee/balances
router.get('/balances', async (req, res) => {
  try {
    // Mock balances for now (integrate with your allowance table in prod)
    res.json([
      { balance_id: 1, request_type_id: 1, request_name: 'إجازة عارضة', remaining: 7, remaining_days: 7 },
      { balance_id: 2, request_type_id: 2, request_name: 'إجازة إعتيادية', remaining: 21, remaining_days: 21 },
      { balance_id: 3, request_type_id: 10, request_name: 'إذن شخصي', remaining: 15, remaining_days: 15 }
    ]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employee/my-requests/:userId
router.get('/my-requests/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, userId);
    const query = `
      SELECT TOP 100 *
      FROM (
        SELECT 
          r.request_id, r.user_id, r.employee_name, r.type_id,
          rt.name AS leave_name, rt.name AS type_name,
          r.status, r.start_date, r.end_date, r.duration, r.unit, r.custom_data, r.created_at
        FROM sca.requests r
        LEFT JOIN sca.request_types rt ON r.type_id = rt.id
        WHERE r.user_id = @UserId
        UNION ALL
        SELECT 
          ISNULL(tr.request_id, tr.transfer_id) as request_id,
          tr.user_id,
          tr.employee_name,
          tr.template_id as type_id,
          rt2.name AS leave_name,
          rt2.name AS type_name,
          tr.status,
          tr.submission_date as start_date,
          NULL as end_date,
          0 as duration,
          'none' as unit,
          tr.custom_dynamic_fields as custom_data,
          tr.created_at
        FROM sca.transfer_requests tr
        LEFT JOIN sca.request_types rt2 ON tr.template_id = rt2.id
        WHERE tr.user_id = @UserId OR tr.employee_id = @UserId
      ) AS combined
      ORDER BY created_at DESC`;
    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employee/submit-request
router.post('/submit-request', async (req, res) => {
  try {
    const { user_id, employee_name, type_id, duration, start_date, end_date, custom_data } = req.body;
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, user_id);
    request.input('EmployeeName', sql.NVarChar(300), employee_name);
    request.input('TypeId', sql.Int, type_id);
    request.input('Duration', sql.Decimal(18, 2), duration || 0);
    request.input('StartDate', sql.Date, start_date || null);
    request.input('EndDate', sql.Date, end_date || null);
    request.input('CustomData', sql.NVarChar(sql.MAX), custom_data ? JSON.stringify(custom_data) : null);
    request.input('Status', sql.NVarChar(50), 'PENDING');
    request.input('Unit', sql.NVarChar(20), 'days');

    const query = `INSERT INTO sca.requests (user_id, employee_id, employee_name, type_id, status, start_date, end_date, duration, unit, custom_data, created_at)
      VALUES (@UserId, @UserId, @EmployeeName, @TypeId, @Status, @StartDate, @EndDate, @Duration, @Unit, @CustomData, SYSUTCDATETIME());
      SELECT @@IDENTITY as request_id;`;
    const result = await request.query(query);
    const reqId = result.recordset[0].request_id;
    res.json({ request_id: reqId, status: 'PENDING' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employee/my-transfers/:userId
router.get('/my-transfers/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, userId);
    const query = `
      SELECT 
        tr.transfer_id, tr.user_id, tr.employee_id, tr.employee_name,
        tr.template_id, tr.status, tr.current_unit_id, tr.current_job_id, tr.current_grade_id,
        tr.reason_for_transfer, tr.willing_to_relocate, tr.desired_start_date, tr.additional_notes,
        tr.allocated_unit_id, tr.allocated_job_id, tr.allocation_score, tr.allocation_reason,
        tr.submission_date, tr.approved_by, tr.approval_date, tr.rejection_reason,
        ou1.unit_name AS current_unit_name,
        ou2.unit_name AS allocated_unit_name,
        tr.custom_dynamic_fields
      FROM sca.transfer_requests tr
      LEFT JOIN sca.organizational_units ou1 ON tr.current_unit_id = ou1.unit_id
      LEFT JOIN sca.organizational_units ou2 ON tr.allocated_unit_id = ou2.unit_id
      WHERE tr.user_id = @UserId OR tr.employee_id = @UserId
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

// POST /api/employee/transfer-requests
router.post('/transfer-requests', async (req, res) => {
  try {
    const {
      employee_id,
      user_id,
      template_id,
      reason_for_transfer,
      willing_to_relocate,
      desired_start_date,
      additional_notes,
      preferred_units,
      custom_dynamic_fields,
      custom_data
    } = req.body;

    const employeeId = Number(employee_id || user_id);
    const userId = Number(user_id || employee_id);

    const pool = await getPool();
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      const userReq = new sql.Request(trx);
      userReq.input('UserId', sql.Int, userId);
      const userRow = await userReq.query('SELECT TOP 1 full_name, org_unit_id, job_id, grade_id FROM sca.users WHERE user_id = @UserId');
      const userInfo = userRow.recordset?.[0] || {};

      const insertReq = new sql.Request(trx);
      insertReq.input('UserId', sql.Int, userId);
      insertReq.input('EmployeeId', sql.Int, employeeId);
      insertReq.input('EmployeeName', sql.NVarChar(200), userInfo.full_name || null);
      insertReq.input('TemplateId', sql.Int, Number(template_id));
      insertReq.input('Status', sql.NVarChar(30), 'PENDING');
      insertReq.input('CurrentUnitId', sql.Int, userInfo.org_unit_id || 0);
      insertReq.input('CurrentJobId', sql.Int, userInfo.job_id || 0);
      insertReq.input('CurrentGradeId', sql.Int, userInfo.grade_id || 0);
      insertReq.input('Reason', sql.NVarChar(sql.MAX), reason_for_transfer || '');
      insertReq.input('Willing', sql.Bit, willing_to_relocate ? 1 : 0);
      insertReq.input('DesiredStartDate', sql.Date, desired_start_date || null);
      insertReq.input('AdditionalNotes', sql.NVarChar(sql.MAX), additional_notes || null);
      insertReq.input('CustomDynamic', sql.NVarChar(sql.MAX), JSON.stringify(custom_dynamic_fields || custom_data || {}));

      const insertQuery = `
        INSERT INTO sca.transfer_requests
        (user_id, employee_id, employee_name, template_id, status, current_unit_id, current_job_id, current_grade_id, reason_for_transfer,
         willing_to_relocate, desired_start_date, additional_notes, submission_date, created_at, custom_dynamic_fields)
        VALUES
        (@UserId, @EmployeeId, @EmployeeName, @TemplateId, @Status, @CurrentUnitId, @CurrentJobId, @CurrentGradeId, @Reason,
         @Willing, @DesiredStartDate, @AdditionalNotes, CAST(GETDATE() AS DATE), GETDATE(), @CustomDynamic);
        SELECT SCOPE_IDENTITY() as transfer_id;`;
      const insertRes = await insertReq.query(insertQuery);
      const transferId = insertRes.recordset?.[0]?.transfer_id;

      if (Array.isArray(preferred_units)) {
        for (const pref of preferred_units) {
          const prefReq = new sql.Request(trx);
          prefReq.input('TransferId', sql.Int, transferId);
          prefReq.input('UnitId', sql.Int, Number(pref.unit_id));
          prefReq.input('PreferenceOrder', sql.Int, Number(pref.preference_order));
          prefReq.input('Reason', sql.NVarChar(500), pref.reason || null);
          await prefReq.query(
            'INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason) VALUES (@TransferId, @UnitId, @PreferenceOrder, @Reason)'
          );
        }
      }

      await trx.commit();
      res.json({ transfer_id: transferId, status: 'PENDING' });
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employee/transfer-requests/:id
router.put('/transfer-requests/:id', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason_for_transfer, willing_to_relocate, desired_start_date, additional_notes, preferred_units, custom_dynamic_fields, custom_data } = req.body;
    const pool = await getPool();
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      const updReq = new sql.Request(trx);
      updReq.input('TransferId', sql.Int, transferId);
      updReq.input('Reason', sql.NVarChar(sql.MAX), reason_for_transfer || '');
      updReq.input('Willing', sql.Bit, willing_to_relocate ? 1 : 0);
      updReq.input('DesiredStartDate', sql.Date, desired_start_date || null);
      updReq.input('AdditionalNotes', sql.NVarChar(sql.MAX), additional_notes || null);
      updReq.input('CustomDynamic', sql.NVarChar(sql.MAX), JSON.stringify(custom_dynamic_fields || custom_data || {}));
      await updReq.query(`
        UPDATE sca.transfer_requests
        SET reason_for_transfer = @Reason,
            willing_to_relocate = @Willing,
            desired_start_date = @DesiredStartDate,
            additional_notes = @AdditionalNotes,
            custom_dynamic_fields = @CustomDynamic,
            is_edited = 1
        WHERE transfer_id = @TransferId AND status = 'PENDING'
      `);

      await new sql.Request(trx).input('TransferId', sql.Int, transferId)
        .query('DELETE FROM sca.transfer_preferences WHERE transfer_id = @TransferId');

      if (Array.isArray(preferred_units)) {
        for (const pref of preferred_units) {
          const prefReq = new sql.Request(trx);
          prefReq.input('TransferId', sql.Int, transferId);
          prefReq.input('UnitId', sql.Int, Number(pref.unit_id));
          prefReq.input('PreferenceOrder', sql.Int, Number(pref.preference_order));
          prefReq.input('Reason', sql.NVarChar(500), pref.reason || null);
          await prefReq.query(
            'INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason) VALUES (@TransferId, @UnitId, @PreferenceOrder, @Reason)'
          );
        }
      }

      await trx.commit();
      res.json({ success: true });
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employee/requests/:id
router.put('/requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { duration, start_date, end_date, custom_data } = req.body;
    const pool = await getPool();
    const query = `UPDATE sca.requests SET duration = @Duration, start_date = @StartDate, end_date = @EndDate, custom_data = @CustomData
      WHERE request_id = @Id`;
    await pool.request()
      .input('Id', sql.BigInt, id)
      .input('Duration', sql.Decimal(18, 2), duration)
      .input('StartDate', sql.Date, start_date)
      .input('EndDate', sql.Date, end_date)
      .input('CustomData', sql.NVarChar(sql.MAX), custom_data ? JSON.stringify(custom_data) : null)
      .query(query);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
