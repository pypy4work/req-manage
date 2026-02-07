const express = require('express');
const router = express.Router();
const { query, getDialect, insertAndGetId, withTransaction } = require('../services/db-service');
const { requirePermission } = require('../rbac');
const { requireSupabaseActive } = require('../db-guards');
const { appendWebhookLog } = require('../utils/webhook-logger');
const SAFE_TABLE_RE = /^[a-zA-Z0-9_]+$/;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const toNull = (val) => (val === undefined || val === '' ? null : val);
const toNumberOrNull = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
};
const toBool = (val) => val === true || val === 1 || val === '1' || val === 'true';

const DEFAULT_SETTINGS = {
  setting_id: 1,
  mode_type: 'Manual',
  n8n_webhook_url: '',
  appeals_webhook_url: '',
  system_title: 'SCA Requests',
  system_subtitle: 'Suez Canal Authority',
  system_logo_url: '',
  logo_source: 'url',
  sidebar_pattern_style: 'stars',
  updated_at: new Date().toISOString(),
  db_config: { connection_type: 'postgres', is_connected: true }
};

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
    await appendWebhookLog({ type: 'n8n', url, payload, error: e?.message || String(e) });
    throw e;
  }
};

// Import existing admin module for lists
const existingAdminRoutes = require('./admin');

// GET /api/admin/users
router.get('/users', requirePermission('admin:users'), async (req, res) => {
  try {
    const rows = await query('SELECT user_id, full_name, username, email, role, org_unit_id, job_id, grade_id, salary FROM sca.users ORDER BY full_name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/org-units
router.get('/org-units', requirePermission('admin:org-structure'), async (req, res) => {
  try {
    const rows = await query('SELECT unit_id, unit_name, unit_type_id, parent_unit_id, manager_id FROM sca.organizational_units ORDER BY unit_name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/request-types
router.get('/request-types', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const rows = await query('SELECT id, name, description, category, unit, info_bar_content, fields, is_transfer_type, transfer_config FROM sca.request_types ORDER BY name');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/settings
router.get('/settings', requirePermission('admin:settings'), async (req, res) => {
  try {
    const rows = await query('SELECT settings_json FROM sca.system_settings WHERE setting_id = 1');
    if (!rows || rows.length === 0) return res.json(DEFAULT_SETTINGS);
    const settings = parseSettingsJson(rows[0].settings_json) || DEFAULT_SETTINGS;
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/settings
router.put('/settings', requirePermission('admin:settings'), async (req, res) => {
  try {
    const payload = req.body || {};
    const settingsJson = JSON.stringify(payload);
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'SYSUTCDATETIME()';
    if (getDialect() === 'postgres') {
      await query(
        `INSERT INTO sca.system_settings (setting_id, settings_json, updated_at)
         VALUES (1, @SettingsJson, ${nowFunc})
         ON CONFLICT (setting_id) DO UPDATE
         SET settings_json = EXCLUDED.settings_json, updated_at = EXCLUDED.updated_at`,
        { SettingsJson: settingsJson }
      );
    } else {
      await query(
        `IF EXISTS (SELECT 1 FROM sca.system_settings WHERE setting_id = 1)
           UPDATE sca.system_settings SET settings_json = @SettingsJson, updated_at = ${nowFunc} WHERE setting_id = 1
         ELSE
           INSERT INTO sca.system_settings (setting_id, settings_json, updated_at) VALUES (1, @SettingsJson, ${nowFunc})`,
        { SettingsJson: settingsJson }
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/test-db
router.post('/test-db', requirePermission('admin:database'), async (req, res) => {
  try {
    const { initDbRouter, getRouterState } = require('../db-router');
    await initDbRouter();
    const state = getRouterState();

    const active = state.active || 'none';
    const supabaseOk = !!state.supabaseHealth?.ok;
    const mssqlOk = !!state.mssqlHealth?.ok;

    if (active === 'supabase' && supabaseOk) {
      return res.json({ success: true, active_database: 'supabase', latency_ms: state.supabaseHealth?.latencyMs || null });
    }

    if (active === 'mssql' && mssqlOk) {
      return res.json({ success: true, active_database: 'mssql', latency_ms: state.mssqlHealth?.latencyMs || null });
    }

    const message = state.degradedReason || 'Database not connected.';
    return res.status(503).json({
      success: false,
      message,
      active_database: active,
      supabase: state.supabaseHealth || null,
      mssql: state.mssqlHealth || null
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'DB test failed.' });
  }
});

// POST /api/admin/n8n-test
router.post('/n8n-test', requirePermission('admin:settings'), async (req, res) => {
  try {
    const { url, mode } = await getN8nConfig();
    if (!url) return res.status(400).json({ success: false, message: 'N8N webhook URL not configured.' });
    if (String(mode).toLowerCase() !== 'n8n') {
      return res.status(400).json({ success: false, message: 'System mode is not N8N.' });
    }
    const payload = {
      meta: { timestamp: new Date().toISOString(), source_system: 'SCA_Request_Management', event_type: 'n8n_test' },
      test: true,
      message: 'N8N connectivity test from SCA Requests'
    };
    const result = await sendToN8nWebhook(url, payload);
    res.json({ success: true, response: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/db/tables
router.get('/db/tables', requirePermission('admin:database'), requireSupabaseActive(), async (req, res) => {
  try {
    const rows = await query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'sca' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    res.json((rows || []).map(r => r.table_name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/db/table/:name
router.get('/db/table/:name', requirePermission('admin:database'), requireSupabaseActive(), async (req, res) => {
  try {
    const name = req.params.name;
    if (!SAFE_TABLE_RE.test(name)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const limitPrefix = getDialect() === 'postgres' ? '' : 'TOP 200';
    const limitSuffix = getDialect() === 'postgres' ? 'LIMIT 200' : '';
    const rows = await query(`SELECT ${limitPrefix} * FROM sca.${name} ${limitSuffix}`);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/request-types (create or update)
router.post('/request-types', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const def = req.body || {};

    const fieldsJson = getDialect() === 'postgres' 
      ? JSON.stringify(def.fields || [])
      : JSON.stringify(def.fields || []);
    const transferConfigJson = def.transfer_config ? JSON.stringify(def.transfer_config) : null;
    const isTransferBool = def.is_transfer_type ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0);
    const infoBarContent = def.info_bar_content || null;

    if (!def.id || Number(def.id) === 0) {
      const sqlText = `INSERT INTO sca.request_types (name, description, category, unit, info_bar_content, fields, is_transfer_type, transfer_config)
        VALUES (@Name, @Description, @Category, @Unit, @InfoBarContent, @Fields, @IsTransfer, @TransferConfig)`;
      const newId = await insertAndGetId(sqlText, {
        Name: def.name,
        Description: def.description || null,
        Category: def.category || null,
        Unit: def.unit || null,
        InfoBarContent: infoBarContent,
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
           info_bar_content = @InfoBarContent,
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
        InfoBarContent: infoBarContent,
        Fields: fieldsJson,
        IsTransfer: isTransferBool,
        TransferConfig: transferConfigJson
      }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/request-types/:id
router.delete('/request-types/:id', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM sca.request_types WHERE id = @Id', { Id: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-titles
router.get('/job-titles', requirePermission('admin:org-structure'), async (req, res) => {
  try {
    const rows = await query('SELECT job_id, job_title_ar, job_title_en FROM sca.job_titles ORDER BY job_title_ar');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/job-grades
router.get('/job-grades', requirePermission('admin:org-structure'), async (req, res) => {
  try {
    const rows = await query('SELECT grade_id, grade_code, grade_name, min_salary, max_salary FROM sca.job_grades ORDER BY grade_id');
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users
router.post('/users', requirePermission('admin:users'), async (req, res) => {
  try {
    const payload = req.body || {};
    const sqlText = `INSERT INTO sca.users (
        employee_number,
        full_employee_number,
        full_name,
        national_id,
        username,
        email,
        phone_number,
        job_id,
        grade_id,
        type_id,
        org_unit_id,
        role,
        salary,
        picture_url,
        join_date,
        birth_date,
        is_2fa_enabled
      ) VALUES (
        @EmployeeNumber,
        @FullEmployeeNumber,
        @FullName,
        @NationalId,
        @Username,
        @Email,
        @PhoneNumber,
        @JobId,
        @GradeId,
        @TypeId,
        @OrgUnitId,
        @Role,
        @Salary,
        @PictureUrl,
        @JoinDate,
        @BirthDate,
        @Is2fa
      )`;
    const roleValue = payload.role || payload.role_name || 'Employee';
    const userId = await insertAndGetId(sqlText, {
      EmployeeNumber: toNull(payload.employee_number || payload.employee_id),
      FullEmployeeNumber: toNull(payload.full_employee_number),
      FullName: payload.full_name,
      NationalId: toNull(payload.national_id),
      Username: payload.username,
      Email: toNull(payload.email),
      PhoneNumber: toNull(payload.phone_number),
      JobId: toNumberOrNull(payload.job_id),
      GradeId: toNumberOrNull(payload.grade_id),
      TypeId: toNumberOrNull(payload.type_id),
      OrgUnitId: toNumberOrNull(payload.org_unit_id),
      Role: roleValue,
      Salary: toNumberOrNull(payload.salary),
      PictureUrl: toNull(payload.picture_url),
      JoinDate: toNull(payload.join_date),
      BirthDate: toNull(payload.birth_date),
      Is2fa: toBool(payload.is_2fa_enabled) ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0)
    }, 'user_id');
    res.json({ user_id: userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/users/:id
router.put('/users/:id', requirePermission('admin:users'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id.' });

    const payload = req.body || {};
    const updates = [];
    const params = { Id: id };

    const setField = (key, column, value) => {
      updates.push(`${column} = @${key}`);
      params[key] = value;
    };

    if (hasOwn(payload, 'employee_number') || hasOwn(payload, 'employee_id')) {
      setField('EmployeeNumber', 'employee_number', toNull(payload.employee_number || payload.employee_id));
    }
    if (hasOwn(payload, 'full_employee_number')) setField('FullEmployeeNumber', 'full_employee_number', toNull(payload.full_employee_number));
    if (hasOwn(payload, 'full_name')) setField('FullName', 'full_name', toNull(payload.full_name));
    if (hasOwn(payload, 'national_id')) setField('NationalId', 'national_id', toNull(payload.national_id));
    if (hasOwn(payload, 'username')) setField('Username', 'username', toNull(payload.username));
    if (hasOwn(payload, 'email')) setField('Email', 'email', toNull(payload.email));
    if (hasOwn(payload, 'phone_number')) setField('PhoneNumber', 'phone_number', toNull(payload.phone_number));
    if (hasOwn(payload, 'job_id')) setField('JobId', 'job_id', toNumberOrNull(payload.job_id));
    if (hasOwn(payload, 'grade_id')) setField('GradeId', 'grade_id', toNumberOrNull(payload.grade_id));
    if (hasOwn(payload, 'type_id')) setField('TypeId', 'type_id', toNumberOrNull(payload.type_id));
    if (hasOwn(payload, 'org_unit_id')) setField('OrgUnitId', 'org_unit_id', toNumberOrNull(payload.org_unit_id));
    if (hasOwn(payload, 'role')) setField('Role', 'role', toNull(payload.role));
    if (hasOwn(payload, 'salary')) setField('Salary', 'salary', toNumberOrNull(payload.salary));
    if (hasOwn(payload, 'picture_url')) setField('PictureUrl', 'picture_url', toNull(payload.picture_url));
    if (hasOwn(payload, 'join_date')) setField('JoinDate', 'join_date', toNull(payload.join_date));
    if (hasOwn(payload, 'birth_date')) setField('BirthDate', 'birth_date', toNull(payload.birth_date));
    if (hasOwn(payload, 'is_2fa_enabled')) {
      setField('Is2fa', 'is_2fa_enabled', toBool(payload.is_2fa_enabled) ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    await query(`UPDATE sca.users SET ${updates.join(', ')} WHERE user_id = @Id`, params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users/import
router.post('/users/import', requirePermission('admin:users'), async (req, res) => {
  try {
    const payload = req.body || {};
    const users = Array.isArray(payload) ? payload : (Array.isArray(payload.users) ? payload.users : []);
    if (!users.length) return res.status(400).json({ error: 'No users provided.' });

    const results = [];
    for (const user of users) {
      try {
        const sqlText = `INSERT INTO sca.users (
            employee_number,
            full_employee_number,
            full_name,
            national_id,
            username,
            email,
            phone_number,
            job_id,
            grade_id,
            type_id,
            org_unit_id,
            role,
            salary,
            picture_url,
            join_date,
            birth_date,
            is_2fa_enabled
          ) VALUES (
            @EmployeeNumber,
            @FullEmployeeNumber,
            @FullName,
            @NationalId,
            @Username,
            @Email,
            @PhoneNumber,
            @JobId,
            @GradeId,
            @TypeId,
            @OrgUnitId,
            @Role,
            @Salary,
            @PictureUrl,
            @JoinDate,
            @BirthDate,
            @Is2fa
          )`;
        const roleValue = user.role || user.role_name || 'Employee';
        const newId = await insertAndGetId(sqlText, {
          EmployeeNumber: toNull(user.employee_number || user.employee_id),
          FullEmployeeNumber: toNull(user.full_employee_number),
          FullName: user.full_name,
          NationalId: toNull(user.national_id),
          Username: user.username,
          Email: toNull(user.email),
          PhoneNumber: toNull(user.phone_number),
          JobId: toNumberOrNull(user.job_id),
          GradeId: toNumberOrNull(user.grade_id),
          TypeId: toNumberOrNull(user.type_id),
          OrgUnitId: toNumberOrNull(user.org_unit_id),
          Role: roleValue,
          Salary: toNumberOrNull(user.salary),
          PictureUrl: toNull(user.picture_url),
          JoinDate: toNull(user.join_date),
          BirthDate: toNull(user.birth_date),
          Is2fa: toBool(user.is_2fa_enabled) ? (getDialect() === 'postgres' ? true : 1) : (getDialect() === 'postgres' ? false : 0)
        }, 'user_id');
        results.push({ status: 'ok', user_id: newId, username: user.username });
      } catch (err) {
        results.push({ status: 'error', username: user?.username, error: err.message || String(err) });
      }
    }

    res.json({ success: true, processed: results.length, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete user
router.delete('/users/:id', requirePermission('admin:users'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM sca.users WHERE user_id = @Id', { Id: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/transfer-requests
router.get('/transfer-requests', requirePermission('admin:transfers'), async (req, res) => {
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

// GET /api/admin/transfer-stats
router.get('/transfer-stats', requirePermission('admin:transfers'), async (req, res) => {
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
router.post('/transfer-requests/:id/approve', requirePermission('admin:transfers'), async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { nextStatus } = req.body;
    const status = nextStatus || 'HR_APPROVED';
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
    
    await query(
      `UPDATE sca.transfer_requests SET status = @Status, decision_at = ${nowFunc}, decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`,
      { TransferId: transferId, Status: status }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/reject
router.post('/transfer-requests/:id/reject', requirePermission('admin:transfers'), async (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const { reason } = req.body;
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
    
    await query(
      `UPDATE sca.transfer_requests SET status = 'REJECTED', rejection_reason = @Reason, decision_at = ${nowFunc}, decision_by = 'Human_Manager' WHERE transfer_id = @TransferId`,
      { TransferId: transferId, Reason: reason || null }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/transfer-requests/:id/status
router.post('/transfer-requests/:id/status', requirePermission('admin:transfers'), async (req, res) => {
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
router.get('/permissions', requirePermission('admin:permissions'), async (req, res) => {
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
router.get('/user-permissions/:userId', requirePermission('admin:permissions'), async (req, res) => {
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
router.put('/user-permissions/:userId', requirePermission('admin:permissions'), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    
    await withTransaction(async (tx) => {
      await tx.query('DELETE FROM sca.user_permissions WHERE user_id = @UserId', { UserId: userId });
      
      const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
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
