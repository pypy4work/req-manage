const express = require('express');
const router = express.Router();
const { query, DIALECT, insertAndGetId, sqlLimit, sqlCoalesce, withTransaction } = require('../db');

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
    const limitPrefix = DIALECT === 'postgres' ? '' : 'TOP 100';
    const limitSuffix = DIALECT === 'postgres' ? 'LIMIT 100' : '';
    
    // Postgres و MSSQL كلاهما يدعم COALESCE
    const sqlText = `
      SELECT ${limitPrefix} *
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
          tr.transfer_id as request_id,
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
      ORDER BY created_at DESC ${limitSuffix}`;
    
    const rows = await query(sqlText, { UserId: userId });
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employee/submit-request
router.post('/submit-request', async (req, res) => {
  try {
    const { user_id, employee_name, type_id, duration, start_date, end_date, custom_data } = req.body;
    
    const customDataJson = custom_data ? JSON.stringify(custom_data) : null;
    const nowFunc = DIALECT === 'postgres' ? 'NOW()' : 'SYSUTCDATETIME()';
    
    const sqlText = `INSERT INTO sca.requests (user_id, employee_id, employee_name, type_id, status, start_date, end_date, duration, unit, custom_data, created_at)
      VALUES (@UserId, @UserId, @EmployeeName, @TypeId, @Status, @StartDate, @EndDate, @Duration, @Unit, @CustomData, ${nowFunc})`;
    
    const reqId = await insertAndGetId(sqlText, {
      UserId: user_id,
      EmployeeName: employee_name,
      TypeId: type_id,
      Status: 'PENDING',
      StartDate: start_date || null,
      EndDate: end_date || null,
      Duration: duration || 0,
      Unit: 'days',
      CustomData: customDataJson
    }, 'request_id');
    
    res.json({ request_id: reqId, status: 'PENDING' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employee/my-transfers/:userId
router.get('/my-transfers/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sqlText = `
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
    
    const transfers = await query(sqlText, { UserId: userId });
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

    const transferId = await withTransaction(async (tx) => {
      // الحصول على بيانات المستخدم
      const limitPrefix = DIALECT === 'postgres' ? '' : 'TOP 1';
      const limitSuffix = DIALECT === 'postgres' ? 'LIMIT 1' : '';
      const userRows = await tx.query(
        `SELECT ${limitPrefix} full_name, org_unit_id, job_id, grade_id FROM sca.users WHERE user_id = @UserId ${limitSuffix}`,
        { UserId: userId }
      );
      const userInfo = userRows.rows?.[0] || {};

      // إدراج طلب النقل
      const customDynamicJson = JSON.stringify(custom_dynamic_fields || custom_data || {});
      const nowFunc = DIALECT === 'postgres' ? 'NOW()' : 'GETDATE()';
      const dateCast = DIALECT === 'postgres' ? 'CURRENT_DATE' : 'CAST(GETDATE() AS DATE)';
      const willingBool = willing_to_relocate ? (DIALECT === 'postgres' ? true : 1) : (DIALECT === 'postgres' ? false : 0);

      const insertSql = DIALECT === 'postgres'
        ? `INSERT INTO sca.transfer_requests
           (user_id, employee_id, employee_name, template_id, status, current_unit_id, current_job_id, current_grade_id, reason_for_transfer,
            willing_to_relocate, desired_start_date, additional_notes, submission_date, created_at, custom_dynamic_fields)
           VALUES
           (@UserId, @EmployeeId, @EmployeeName, @TemplateId, @Status, @CurrentUnitId, @CurrentJobId, @CurrentGradeId, @Reason,
            @Willing, @DesiredStartDate, @AdditionalNotes, ${dateCast}, ${nowFunc}, @CustomDynamic) RETURNING transfer_id`
        : `INSERT INTO sca.transfer_requests
           (user_id, employee_id, employee_name, template_id, status, current_unit_id, current_job_id, current_grade_id, reason_for_transfer,
            willing_to_relocate, desired_start_date, additional_notes, submission_date, created_at, custom_dynamic_fields)
           VALUES
           (@UserId, @EmployeeId, @EmployeeName, @TemplateId, @Status, @CurrentUnitId, @CurrentJobId, @CurrentGradeId, @Reason,
            @Willing, @DesiredStartDate, @AdditionalNotes, ${dateCast}, ${nowFunc}, @CustomDynamic);
           SELECT SCOPE_IDENTITY() AS transfer_id`;
      
      const insertResult = await tx.query(insertSql, {
        UserId: userId,
        EmployeeId: employeeId,
        EmployeeName: userInfo.full_name || null,
        TemplateId: Number(template_id),
        Status: 'PENDING',
        CurrentUnitId: userInfo.org_unit_id || 0,
        CurrentJobId: userInfo.job_id || 0,
        CurrentGradeId: userInfo.grade_id || 0,
        Reason: reason_for_transfer || '',
        Willing: willingBool,
        DesiredStartDate: desired_start_date || null,
        AdditionalNotes: additional_notes || null,
        CustomDynamic: customDynamicJson
      });
      
      const transferId = DIALECT === 'postgres' 
        ? insertResult.rows[0]?.transfer_id
        : insertResult.rows[0]?.transfer_id || insertResult.rows?.[0]?.['SCOPE_IDENTITY()'];

      // إدراج التفضيلات
      if (Array.isArray(preferred_units)) {
        for (const pref of preferred_units) {
          await tx.query(
            'INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason) VALUES (@TransferId, @UnitId, @PreferenceOrder, @Reason)',
            {
              TransferId: transferId,
              UnitId: Number(pref.unit_id),
              PreferenceOrder: Number(pref.preference_order),
              Reason: pref.reason || null
            }
          );
        }
      }

      return transferId;
    });

    res.json({ transfer_id: transferId, status: 'PENDING' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employee/transfer-requests/:id
router.put('/transfer-requests/:id', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason_for_transfer, willing_to_relocate, desired_start_date, additional_notes, preferred_units, custom_dynamic_fields, custom_data } = req.body;
    
    await withTransaction(async (tx) => {
      const customDynamicJson = JSON.stringify(custom_dynamic_fields || custom_data || {});
      const willingBool = willing_to_relocate ? (DIALECT === 'postgres' ? true : 1) : (DIALECT === 'postgres' ? false : 0);
      
      await tx.query(`
        UPDATE sca.transfer_requests
        SET reason_for_transfer = @Reason,
            willing_to_relocate = @Willing,
            desired_start_date = @DesiredStartDate,
            additional_notes = @AdditionalNotes,
            custom_dynamic_fields = @CustomDynamic
        WHERE transfer_id = @TransferId AND status = 'PENDING'`,
        {
          TransferId: transferId,
          Reason: reason_for_transfer || '',
          Willing: willingBool,
          DesiredStartDate: desired_start_date || null,
          AdditionalNotes: additional_notes || null,
          CustomDynamic: customDynamicJson
        }
      );

      await tx.query('DELETE FROM sca.transfer_preferences WHERE transfer_id = @TransferId', { TransferId: transferId });

      if (Array.isArray(preferred_units)) {
        for (const pref of preferred_units) {
          await tx.query(
            'INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason) VALUES (@TransferId, @UnitId, @PreferenceOrder, @Reason)',
            {
              TransferId: transferId,
              UnitId: Number(pref.unit_id),
              PreferenceOrder: Number(pref.preference_order),
              Reason: pref.reason || null
            }
          );
        }
      }
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employee/requests/:id
router.put('/requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { duration, start_date, end_date, custom_data } = req.body;
    
    const customDataJson = custom_data ? JSON.stringify(custom_data) : null;
    
    await query(
      'UPDATE sca.requests SET duration = @Duration, start_date = @StartDate, end_date = @EndDate, custom_data = @CustomData WHERE request_id = @Id',
      {
        Id: id,
        Duration: duration,
        StartDate: start_date,
        EndDate: end_date,
        CustomData: customDataJson
      }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
