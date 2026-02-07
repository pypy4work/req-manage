const express = require('express');
const router = express.Router();
const { query, getDialect, insertAndGetId, withTransaction } = require('../services/db-service');
const { appendWebhookLog } = require('../utils/webhook-logger');

const parseSettingsJson = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

const normalizeDecision = (response) => {
  if (!response) return null;
  const raw = String(
    response.recommendation ||
    response.status ||
    response.decision ||
    ''
  ).toUpperCase();
  if (!raw) return null;
  if (['APPROVE', 'APPROVED'].includes(raw)) return 'APPROVE';
  if (['REJECT', 'REJECTED', 'DECLINE', 'DENY'].includes(raw)) return 'REJECT';
  if (['MANAGER_REVIEW', 'MANUAL_REVIEW', 'HUMAN_REVIEW', 'ESCALATE', 'ESCALATED'].includes(raw)) return 'MANAGER_REVIEW';
  return null;
};

const mapDecisionToStatus = (decision, isTransfer) => {
  if (!decision) return null;
  if (decision === 'APPROVE') return isTransfer ? 'HR_APPROVED' : 'APPROVED';
  if (decision === 'REJECT') return 'REJECTED';
  if (decision === 'MANAGER_REVIEW') return 'MANAGER_REVIEW';
  return null;
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
    process.env.N8N_WEBHOOK_URL ||
    process.env.N8N_WEBHOOK ||
    '';
  try {
    const rows = await query('SELECT settings_json FROM sca.system_settings WHERE setting_id = 1');
    const settings = parseSettingsJson(rows?.[0]?.settings_json);
    return {
      url: (settings?.appeals_webhook_url || settings?.n8n_webhook_url || envUrl || '').trim()
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
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { success: resp.ok, message: text.slice(0, 200) }; }
    await appendWebhookLog({ type: 'n8n', url, payload, response: parsed, status: resp.status, ok: resp.ok });
    return parsed;
  } catch (e) {
    console.warn('N8N webhook failed', e);
    await appendWebhookLog({ type: 'n8n', url, payload, error: e?.message || String(e) });
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
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { success: resp.ok, message: text.slice(0, 200) }; }
    await appendWebhookLog({ type: 'appeals', url, payload, response: parsed, status: resp.status, ok: resp.ok });
    return parsed;
  } catch (e) {
    console.warn('Appeals webhook failed', e);
    await appendWebhookLog({ type: 'appeals', url, payload, error: e?.message || String(e) });
    return null;
  }
};

const getEnrichedPayload = async ({ userId, typeId, requestId, isTransfer, extraData = {} }) => {
  try {
    // 1. Fetch User and Manager details
    const userRows = await query(`
      SELECT u.full_name, u.email, u.phone_number, u.employee_number, 
             u.job_id, u.grade_id, u.org_unit_id,
             ou.unit_name, ou.manager_id as unit_manager_id,
             g.grade_code, g.grade_name,
             m.full_name as manager_name, m.email as manager_email, m.phone_number as manager_phone
      FROM sca.users u
      LEFT JOIN sca.organizational_units ou ON u.org_unit_id = ou.unit_id
      LEFT JOIN sca.job_grades g ON u.grade_id = g.grade_id
      LEFT JOIN sca.users m ON ou.manager_id = m.user_id
      WHERE u.user_id = @UserId`, { UserId: userId });
    
    const userInfo = userRows?.[0] || {};

    // Use unit_manager_id as the primary manager reference for now
    const managerId = userInfo.unit_manager_id;

    // 2. Fetch Request Type and Rules
    const typeRows = await query(`
      SELECT rt.id, rt.name, rt.unit AS balance_unit, rt.fields AS fields_config_json
      FROM sca.request_types rt
      WHERE rt.id = @TypeId`, { TypeId: typeId });
    const typeInfo = typeRows?.[0] || {};

    // Fetch Rules linked to this type
    let rulesRows = [];
    try {
      rulesRows = await query(`
        SELECT vr.rule_name, vr.left_field_id, vr.operator, vr.right_source, vr.right_value, vr.suggested_action, vr.error_message_ar
        FROM sca.request_type_rules_link l
        JOIN sca.validation_rules vr ON l.rule_id = vr.rule_id
        WHERE l.request_type_id = @TypeId`, { TypeId: typeId });
    } catch (err) {
      console.warn('Rules fetch failed, continuing without rules');
    }

    // 3. Fetch Balances
    let balance = null;
    try {
      const balanceRows = await query(`
        SELECT remaining_balance AS remaining
        FROM sca.allowance_balances 
        WHERE user_id = @UserId AND request_type_id = @TypeId`, { UserId: userId, TypeId: typeId });
      balance = balanceRows?.[0] || null;
    } catch (err) {
      try {
        const altBalanceRows = await query(`
          SELECT remaining, total_entitlement as total
          FROM sca.leave_balances 
          WHERE user_id = @UserId AND request_type_id = @TypeId`, { UserId: userId, TypeId: typeId });
        balance = altBalanceRows?.[0] || null;
      } catch (e2) {
        console.warn('Balances fetch failed');
      }
    }

    // 4. Fetch Attachments
    let attachmentRows = [];
    try {
      attachmentRows = await query(`
        SELECT file_url, uploaded_at 
        FROM sca.request_attachments 
        WHERE request_id = @Id`, { Id: requestId });
    } catch (err) {
      console.warn('Attachments fetch failed');
    }

    // 5. If Transfer, fetch preferences with Unit Names
    let enrichedPreferences = [];
    if (isTransfer) {
      const prefRows = await query(`
        SELECT p.unit_id, p.preference_order, p.reason, ou.unit_name
        FROM sca.transfer_preferences p
        LEFT JOIN sca.organizational_units ou ON p.unit_id = ou.unit_id
        WHERE p.transfer_id = @Id
        ORDER BY p.preference_order`, { Id: requestId });
      enrichedPreferences = prefRows || [];
    }

    return {
      meta: {
        timestamp: new Date().toISOString(),
        source_system: 'SCA_Request_Management',
        event_type: extraData.appeal ? 'request_appeal' : (isTransfer ? 'transfer_request' : 'leave_request'),
        request_id: requestId,
        environment: process.env.NODE_ENV || 'production'
      },
      request: {
        id: requestId,
        type: {
          id: typeId,
          name: typeInfo.name,
          unit: typeInfo.balance_unit,
          config: parseSettingsJson(typeInfo.fields_config_json),
          workflow_id: typeInfo.workflow_id
        },
        timing: extraData.timing || {
          start_date: extraData.start_date || extraData.desired_start_date,
          end_date: extraData.end_date,
          duration: extraData.duration
        },
        custom_fields: extraData.custom_fields || extraData.custom_dynamic_fields || {},
        validation_rules: rulesRows || [],
        attachments: attachmentRows || [],
        transfer_details: isTransfer ? {
          reason: extraData.reason_for_transfer,
          willing_to_relocate: extraData.willing_to_relocate,
          preferred_units: enrichedPreferences
        } : null,
        appeal_details: extraData.appeal || null,
        original_request: extraData.original_request || null
      },
      employee: {
        id: userId,
        employee_number: userInfo.employee_number,
        full_name: userInfo.full_name,
        email: userInfo.email,
        phone: userInfo.phone_number,
        organization: {
          unit_id: userInfo.org_unit_id,
          unit_name: userInfo.unit_name,
          grade_code: userInfo.grade_code,
          grade_name: userInfo.grade_name
        },
        balance: balance
      },
      manager: managerId ? {
        id: managerId,
        full_name: userInfo.manager_name,
        email: userInfo.manager_email,
        phone: userInfo.manager_phone
      } : null,
      system_context: {
        auto_approval_eligible: rulesRows && rulesRows.length > 0,
        is_transfer: !!isTransfer,
        is_appeal: !!extraData.appeal
      }
    };
  } catch (err) {
    console.error('Error enriching payload', err);
    return {
      meta: { timestamp: new Date().toISOString(), event_type: isTransfer ? 'transfer_request' : 'leave_request' },
      request: { id: requestId, type_id: typeId, ...extraData },
      employee: { id: userId }
    };
  }
};

const applyWorkflowDecision = async ({ decision, isTransfer, requestId, rejectionReason }) => {
  if (!decision || !requestId) return null;
  const status = mapDecisionToStatus(decision, isTransfer);
  if (!status) return null;
  const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';

  if (isTransfer) {
    await query(
      `UPDATE sca.transfer_requests
       SET status = @Status,
           decision_by = @DecisionBy,
           decision_at = ${nowFunc},
           rejection_reason = @Rejection
       WHERE transfer_id = @Id`,
      {
        Status: status,
        DecisionBy: 'N8N_Workflow',
        Rejection: rejectionReason || null,
        Id: requestId
      }
    );
    return status;
  }

  await query(
    `UPDATE sca.requests
     SET status = @Status,
         decision_by = @DecisionBy,
         decision_at = ${nowFunc},
         rejection_reason = @Rejection
     WHERE request_id = @Id`,
    {
      Status: status,
      DecisionBy: 'N8N_Workflow',
      Rejection: rejectionReason || null,
      Id: requestId
    }
  );
  return status;
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

    const { url: n8nUrl, mode } = await getN8nConfig();
    if (n8nUrl && String(mode).toLowerCase() === 'n8n') {
      const payload = await getEnrichedPayload({
        userId: user_id,
        typeId: type_id,
        requestId: reqId,
        isTransfer: false,
        extraData: {
          timing: { start_date, end_date, duration },
          custom_fields: custom_data || {}
        }
      });
      
      const n8nResponse = await sendToN8nWebhook(n8nUrl, payload);
      let decision = normalizeDecision(n8nResponse);
      if (decision === 'APPROVE' && n8nResponse?.auto_approve !== true) {
        decision = 'MANAGER_REVIEW';
      }
      rejectionReason = n8nResponse?.rejection_reason || null;
      const applied = await applyWorkflowDecision({
        decision,
        isTransfer: false,
        requestId: reqId,
        rejectionReason
      });
      if (applied) finalStatus = applied;
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

    const payload = await getEnrichedPayload({
      userId: userId,
      typeId: requestSnapshot.type_id || requestSnapshot.leave_type_id || 0,
      requestId: requestId,
      isTransfer: isTransfer,
      extraData: {
        appeal: { reason, submitted_at: submittedAt, attachments },
        original_request: requestSnapshot
      }
    });
    // Override event type for appeals
    payload.meta.event_type = 'request_appeal';

    const result = await sendToAppealsWebhook(url, payload);
    let decision = normalizeDecision(result);
    if (decision === 'APPROVE' && result?.auto_approve !== true) {
      decision = 'MANAGER_REVIEW';
    }
    const decisionStatus = await applyWorkflowDecision({
      decision,
      isTransfer,
      requestId,
      rejectionReason: result?.rejection_reason || null
    });

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

    res.json({ success: true, response: result, status: decisionStatus || null });
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
      const payload = await getEnrichedPayload({
        userId: userId,
        typeId: template_id,
        requestId: transferId,
        isTransfer: true,
        extraData: {
          reason_for_transfer,
          willing_to_relocate,
          desired_start_date,
          preferred_units,
          custom_fields: custom_dynamic_fields || custom_data || {}
        }
      });
      const n8nResponse = await sendToN8nWebhook(n8nUrl, payload);
      let decision = normalizeDecision(n8nResponse);
      if (decision === 'APPROVE' && n8nResponse?.auto_approve !== true) {
        decision = 'MANAGER_REVIEW';
      }
      rejectionReason = n8nResponse?.rejection_reason || null;
      const applied = await applyWorkflowDecision({
        decision,
        isTransfer: true,
        requestId: transferId,
        rejectionReason
      });
      if (applied) finalStatus = applied;
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
