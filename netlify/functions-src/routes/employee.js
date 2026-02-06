const express = require('express');
const router = express.Router();
const { query, getDialect, insertAndGetId, withTransaction } = require('../services/db-service');

const parseSettingsJson = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

const getN8nConfig = async () => {
  const envUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK || '';
  const envMode = process.env.MODE_TYPE || process.env.N8N_MODE || '';
  try {
    const rows = await query('SELECT settings_json FROM sca.system_settings WHERE setting_id = 1');
    const settings = parseSettingsJson(rows?.[0]?.settings_json);
    return {
      url: (settings?.n8n_webhook_url || envUrl || '').trim(),
      mode: settings?.mode_type || envMode
    };
  } catch {
    return { url: envUrl, mode: envMode };
  }
};

const getAppealsConfig = async () => {
  const envUrl =
    process.env.APPEALS_WEBHOOK_URL ||
    process.env.APPEAL_WEBHOOK_URL ||
    process.env.N8N_APPEALS_WEBHOOK_URL ||
    process.env.N8N_APPEAL_WEBHOOK_URL ||
    '';
  try {
    const rows = await query('SELECT settings_json FROM sca.system_settings WHERE setting_id = 1');
    const settings = parseSettingsJson(rows?.[0]?.settings_json);
    return {
      url: (settings?.appeals_webhook_url || envUrl || '').trim()
    };
  } catch {
    return { url: envUrl };
  }
};

const sendToN8nWebhook = async (url, payload) => {
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Source': 'SCA_Request_Management' },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    if (!text) return { success: resp.ok };
    try { return JSON.parse(text); } catch { return { success: resp.ok, message: text.slice(0, 200) }; }
  } catch (e) {
    console.warn('N8N webhook failed', e);
    return null;
  }
};

const sendToAppealsWebhook = async (url, payload) => {
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Source': 'SCA_Request_Management' },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    if (!text) return { success: resp.ok };
    try { return JSON.parse(text); } catch { return { success: resp.ok, message: text.slice(0, 200) }; }
  } catch (e) {
    console.warn('Appeals webhook failed', e);
    return null;
  }
};

// GET /api/employee/balances
router.get('/balances', async (req, res) => {
  try {
    const userId = Number(req.query.userId || req.query.employeeId || 0);
    if (!userId) return res.json([]);
    const rows = await query(
      `SELECT 
          b.balance_id, b.user_id, b.request_type_id, b.total_entitlement, b.remaining, b.unit,
          rt.name AS request_name
       FROM sca.leave_balances b
       LEFT JOIN sca.request_types rt ON rt.id = b.request_type_id
       WHERE b.user_id = @UserId
       ORDER BY rt.name`,
      { UserId: userId }
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employee/my-requests/:userId
router.get('/my-requests/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const limitPrefix = getDialect() === 'postgres' ? '' : 'TOP 100';
    const limitSuffix = getDialect() === 'postgres' ? 'LIMIT 100' : '';
    
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

// GET /api/employee/career-history/:userId
router.get('/career-history/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rows = await query(
      `SELECT history_id, user_id, change_date, reason, prev_job_title, new_job_title,
              prev_grade_code, new_grade_code, prev_dept, new_dept, changed_by_admin_id
       FROM sca.career_history
       WHERE user_id = @UserId
       ORDER BY change_date ASC`,
      { UserId: userId }
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employee/submit-request
router.post('/submit-request', async (req, res) => {
  try {
    const { user_id, employee_name, type_id, duration, start_date, end_date, custom_data } = req.body;
    
    const customDataJson = custom_data ? JSON.stringify(custom_data) : null;
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'SYSUTCDATETIME()';
    
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
    let finalStatus = 'PENDING';
    let rejectionReason = null;
    let decisionBy = null;
    let decisionAt = null;

    const { url: n8nUrl, mode } = await getN8nConfig();
    if (n8nUrl && String(mode).toLowerCase() === 'n8n') {
      const userRows = await query('SELECT full_name, email, phone_number, job_id, grade_id, org_unit_id FROM sca.users WHERE user_id = @UserId', { UserId: user_id });
      const userInfo = userRows?.[0] || {};
      const payload = {
        meta: { timestamp: new Date().toISOString(), source_system: 'SCA_Request_Management', event_type: 'leave_request' },
        request: { request_id: reqId, created_at: new Date().toISOString(), type_id: type_id, details: { start_date, end_date, duration }, custom_fields: custom_data || {} },
        employee: { id: user_id, full_name: userInfo.full_name || employee_name, email: userInfo.email, phone: userInfo.phone_number, org_unit_id: userInfo.org_unit_id }
      };
      const n8nResponse = await sendToN8nWebhook(n8nUrl, payload);
      if (n8nResponse?.auto_approve && n8nResponse?.recommendation === 'APPROVE') {
        finalStatus = 'APPROVED';
        decisionBy = 'N8N_Workflow';
        decisionAt = new Date().toISOString();
      } else if (n8nResponse?.recommendation === 'REJECT') {
        finalStatus = 'REJECTED';
        decisionBy = 'N8N_Workflow';
        decisionAt = new Date().toISOString();
        rejectionReason = n8nResponse?.rejection_reason || null;
      }

      if (finalStatus !== 'PENDING') {
        await query(
          `UPDATE sca.requests SET status = @Status, decision_by = @DecisionBy, decision_at = ${nowFunc}, rejection_reason = @Rejection WHERE request_id = @Id`,
          { Status: finalStatus, DecisionBy: decisionBy, Rejection: rejectionReason, Id: reqId }
        );
      }
    }

    res.json({ request_id: reqId, status: finalStatus, rejection_reason: rejectionReason });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employee/appeals
router.post('/appeals', async (req, res) => {
  try {
    const body = req.body || {};
    const appeal = body.appeal || {};
    const requestSnapshot = body.request || {};
    const employee = body.employee || {};

    const requestId = Number(requestSnapshot.request_id || body.request_id || 0);
    const userId = Number(employee.id || body.user_id || 0);
    const reason = String(appeal.reason || body.reason || '').trim();
    const isTransfer = !!(body.is_transfer || requestSnapshot.transfer_id);

    if (!requestId || !userId || !reason) {
      return res.status(400).json({ success: false, message: 'Missing request_id, user_id, or appeal reason.' });
    }

    const { url } = await getAppealsConfig();
    if (!url) return res.status(400).json({ success: false, message: 'Appeals webhook URL not configured.' });

    const submittedAt = appeal.submitted_at || new Date().toISOString();
    const attachments = Array.isArray(appeal.attachments) ? appeal.attachments : [];

    // Enrich employee info from DB if available
    let employeeInfo = employee;
    try {
      const userRows = await query(
        'SELECT full_name, email, phone_number, job_id, grade_id, org_unit_id FROM sca.users WHERE user_id = @UserId',
        { UserId: userId }
      );
      const userInfo = userRows?.[0] || {};
      employeeInfo = {
        id: userId,
        full_name: employee.full_name || userInfo.full_name || requestSnapshot.employee_name || '',
        email: employee.email || userInfo.email || null,
        phone: employee.phone || userInfo.phone_number || null,
        org_unit_id: employee.org_unit_id || userInfo.org_unit_id || null
      };
    } catch {
      employeeInfo = {
        id: userId,
        full_name: employee.full_name || requestSnapshot.employee_name || '',
        email: employee.email || null,
        phone: employee.phone || null,
        org_unit_id: employee.org_unit_id || null
      };
    }

    const payload = {
      meta: body.meta || { timestamp: submittedAt, source_system: 'SCA_Request_Management', event_type: 'request_appeal' },
      appeal: { reason, submitted_at: submittedAt, attachments },
      request: {
        request_id: requestSnapshot.request_id || requestId,
        transfer_id: requestSnapshot.transfer_id || null,
        created_at: requestSnapshot.created_at || null,
        type_id: requestSnapshot.type_id || requestSnapshot.leave_type_id || null,
        type_name: requestSnapshot.type_name || requestSnapshot.leave_name || null,
        status: requestSnapshot.status || null,
        start_date: requestSnapshot.start_date || null,
        end_date: requestSnapshot.end_date || null,
        duration: requestSnapshot.duration || null,
        unit: requestSnapshot.unit || null,
        rejection_reason: requestSnapshot.rejection_reason || null,
        decision_by: requestSnapshot.decision_by || null,
        custom_data: requestSnapshot.custom_data || {}
      },
      employee: employeeInfo,
      is_transfer: isTransfer
    };

    const result = await sendToAppealsWebhook(url, payload);

    // Persist appeal meta into request custom data (best-effort)
    try {
      const table = isTransfer ? 'sca.transfer_requests' : 'sca.requests';
      const column = isTransfer ? 'custom_dynamic_fields' : 'custom_data';
      const idColumn = isTransfer ? 'transfer_id' : 'request_id';
      const rows = await query(`SELECT ${column} FROM ${table} WHERE ${idColumn} = @Id`, { Id: requestId });
      if (rows && rows.length > 0) {
        const existing = parseSettingsJson(rows[0][column]) || {};
        const updated = {
          ...existing,
          appeal: {
            status: 'SUBMITTED',
            submitted_at: submittedAt,
            reason,
            attachments
          }
        };
        await query(`UPDATE ${table} SET ${column} = @CustomData WHERE ${idColumn} = @Id`, {
          CustomData: JSON.stringify(updated),
          Id: requestId
        });
      }
    } catch (err) {
      console.warn('Appeal persistence failed', err);
    }

    res.json({ success: true, response: result });
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
    const placeholders = getDialect() === 'postgres' 
      ? ids.map((_, i) => `$${i + 1}`).join(',')
      : ids.join(',');
    
    const prefsSql = getDialect() === 'postgres'
      ? `SELECT transfer_id, unit_id, preference_order, reason FROM sca.transfer_preferences WHERE transfer_id = ANY($1::bigint[]) ORDER BY preference_order`
      : `SELECT transfer_id, unit_id, preference_order, reason FROM sca.transfer_preferences WHERE transfer_id IN (${placeholders}) ORDER BY preference_order`;
    
    const prefsParams = getDialect() === 'postgres' ? { '1': ids } : {};
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
      const limitPrefix = getDialect() === 'postgres' ? '' : 'TOP 1';
      const limitSuffix = getDialect() === 'postgres' ? 'LIMIT 1' : '';
      const userRows = await tx.query(
        `SELECT ${limitPrefix} full_name, org_unit_id, job_id, grade_id FROM sca.users WHERE user_id = @UserId ${limitSuffix}`,
        { UserId: userId }
      );
      const userInfo = userRows.rows?.[0] || {};

      // إدراج طلب النقل
      const customDynamicJson = JSON.stringify(custom_dynamic_fields || custom_data || {});
      const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
      const dateCast = getDialect() === 'postgres' ? 'CURRENT_DATE' : 'CAST(GETDATE() AS DATE)';
      const willingBool = willing_to_relocate ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0);

      const insertSql = getDialect() === 'postgres'
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
      
      const transferId = getDialect() === 'postgres' 
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

    let finalStatus = 'PENDING';
    let rejectionReason = null;
    const { url: n8nUrl, mode } = await getN8nConfig();
    if (n8nUrl && String(mode).toLowerCase() === 'n8n') {
      const payload = {
        meta: { timestamp: new Date().toISOString(), source_system: 'SCA_Request_Management', event_type: 'transfer_request' },
        request: { transfer_id: transferId, template_id, reason_for_transfer, preferred_units, custom_fields: custom_dynamic_fields || custom_data || {} },
        employee: { id: userId, employee_id: employeeId }
      };
      const n8nResponse = await sendToN8nWebhook(n8nUrl, payload);
      if (n8nResponse?.auto_approve && n8nResponse?.recommendation === 'APPROVE') {
        finalStatus = 'HR_APPROVED';
      } else if (n8nResponse?.recommendation === 'REJECT') {
        finalStatus = 'REJECTED';
        rejectionReason = n8nResponse?.rejection_reason || null;
      }

      if (finalStatus !== 'PENDING') {
        const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
        await query(
          `UPDATE sca.transfer_requests
           SET status = @Status, decision_by = @DecisionBy, decision_at = ${nowFunc}, rejection_reason = @Rejection
           WHERE transfer_id = @TransferId`,
          { Status: finalStatus, DecisionBy: 'N8N_Workflow', Rejection: rejectionReason, TransferId: transferId }
        );
      }
    }

    res.json({ transfer_id: transferId, status: finalStatus, rejection_reason: rejectionReason });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employee/transfer-requests/:id
router.put('/transfer-requests/:id', async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason_for_transfer, willing_to_relocate, desired_start_date, additional_notes, preferred_units, custom_dynamic_fields, custom_data } = req.body;
    
    await withTransaction(async (tx) => {
      const customDynamicJson = JSON.stringify(custom_dynamic_fields || custom_data || {});
      const willingBool = willing_to_relocate ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0);
      
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
