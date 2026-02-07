-- ============================================================
-- Demo seed data for Postgres (SCA Requests Management)
-- Safe to run multiple times (idempotent where possible)
-- ============================================================

BEGIN;

-- System settings
INSERT INTO sca.system_settings (setting_id, settings_json)
VALUES (1, '{"app_name":"SCA ERMS","seeded_at":"2026-02-07","environment":"demo"}'::jsonb)
ON CONFLICT (setting_id)
DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_at = NOW();

-- Minimal geography seed (Egypt)
INSERT INTO sca.governorates (name_ar, name_en, code, geoname_id, latitude, longitude)
SELECT 'القاهرة', 'Cairo', 'C01', 360631, 30.0444, 31.2357
WHERE NOT EXISTS (SELECT 1 FROM sca.governorates WHERE code = 'C01');

INSERT INTO sca.centers (governorate_id, name_ar, name_en, geoname_id, latitude, longitude)
SELECT g.governorate_id, 'مركز القاهرة', 'Cairo Center', 999001, 30.0444, 31.2357
FROM sca.governorates g
WHERE g.code = 'C01'
  AND NOT EXISTS (SELECT 1 FROM sca.centers WHERE name_en = 'Cairo Center');

INSERT INTO sca.cities (governorate_id, center_id, name_ar, name_en, geoname_id, population, latitude, longitude)
SELECT g.governorate_id, c.center_id, 'مدينة القاهرة', 'Cairo City', 360630, 9500000, 30.0444, 31.2357
FROM sca.governorates g
JOIN sca.centers c ON c.governorate_id = g.governorate_id
WHERE g.code = 'C01'
  AND c.name_en = 'Cairo Center'
  AND NOT EXISTS (SELECT 1 FROM sca.cities WHERE name_en = 'Cairo City');

INSERT INTO sca.villages (center_id, name_ar, name_en, geoname_id, population, latitude, longitude)
SELECT c.center_id, 'قرية تجريبية', 'Demo Village', 999101, 1500, 30.0500, 31.2400
FROM sca.centers c
WHERE c.name_en = 'Cairo Center'
  AND NOT EXISTS (SELECT 1 FROM sca.villages WHERE name_en = 'Demo Village');

INSERT INTO sca.neighborhoods (city_id, village_id, name_ar, name_en, geoname_id, latitude, longitude)
SELECT ci.city_id, v.village_id, 'حي تجريبي', 'Demo Neighborhood', 999201, 30.0470, 31.2370
FROM sca.cities ci
JOIN sca.villages v ON v.center_id = ci.center_id
WHERE ci.name_en = 'Cairo City'
  AND v.name_en = 'Demo Village'
  AND NOT EXISTS (SELECT 1 FROM sca.neighborhoods WHERE name_en = 'Demo Neighborhood');

-- Extra org units (optional demo)
INSERT INTO sca.organizational_units (unit_name, unit_type_id, parent_unit_id, manager_id, cost_center_code)
SELECT 'قسم الموارد البشرية', t.type_id, u.unit_id, NULL, 'CC-HR'
FROM sca.org_unit_types t
JOIN sca.organizational_units u ON u.unit_name = 'مكتب رئيس الهيئة'
WHERE t.type_name_ar = 'قسم'
  AND NOT EXISTS (SELECT 1 FROM sca.organizational_units WHERE unit_name = 'قسم الموارد البشرية');

-- Users
INSERT INTO sca.users (employee_number, full_employee_number, full_name, username, email, role, org_unit_id, job_id, grade_id, type_id, salary)
SELECT '10002', 'EMP-10002', 'Test Manager', 'manager1', 'manager1@sca.local', 'Manager',
       ou.unit_id, jt.job_id, jg.grade_id, et.type_id, 12000
FROM sca.organizational_units ou, sca.job_titles jt, sca.job_grades jg, sca.employment_types et
WHERE ou.unit_name = 'إدارة التحركات'
  AND jt.job_title_en = 'Marine Engineer'
  AND jg.grade_code = 'GM'
  AND et.type_name = 'دائم'
ON CONFLICT (username) DO NOTHING;

INSERT INTO sca.users (employee_number, full_employee_number, full_name, username, email, role, org_unit_id, job_id, grade_id, type_id, salary)
SELECT '10003', 'EMP-10003', 'Test Employee One', 'employee1', 'employee1@sca.local', 'Employee',
       ou.unit_id, jt.job_id, jg.grade_id, et.type_id, 7000
FROM sca.organizational_units ou, sca.job_titles jt, sca.job_grades jg, sca.employment_types et
WHERE ou.unit_name = 'الإدارة الهندسية'
  AND jt.job_title_en = 'IT Specialist'
  AND jg.grade_code = 'HIGH'
  AND et.type_name = 'دائم'
ON CONFLICT (username) DO NOTHING;

INSERT INTO sca.users (employee_number, full_employee_number, full_name, username, email, role, org_unit_id, job_id, grade_id, type_id, salary)
SELECT '10004', 'EMP-10004', 'Test Employee Two', 'employee2', 'employee2@sca.local', 'Employee',
       ou.unit_id, jt.job_id, jg.grade_id, et.type_id, 6500
FROM sca.organizational_units ou, sca.job_titles jt, sca.job_grades jg, sca.employment_types et
WHERE ou.unit_name = 'إدارة شئون العاملين'
  AND jt.job_title_en = 'Senior Pilot'
  AND jg.grade_code = 'GM'
  AND et.type_name = 'انتداب'
ON CONFLICT (username) DO NOTHING;

-- User credentials (bcrypt hashes)
INSERT INTO sca.user_credentials (user_id, password_hash, password_algo, password_updated_at, is_active)
SELECT u.user_id, '$2a$10$bq5SltUKWCilPkbGgmRfUONoAoAwdSNfNFWIf1x9rUpLoRgXEL1Ly', 'bcrypt', NOW(), TRUE
FROM sca.users u
WHERE u.username = 'admin'
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_updated_at = EXCLUDED.password_updated_at,
    is_active = TRUE,
    must_change_password = TRUE;

INSERT INTO sca.user_credentials (user_id, password_hash, password_algo, password_updated_at, is_active)
SELECT u.user_id, '$2a$10$m40P9omejZk1YlklZu1yeumjIoOzEJECAY5PSRD1uru1LcF0KNk7C', 'bcrypt', NOW(), TRUE
FROM sca.users u
WHERE u.username = 'manager1'
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_updated_at = EXCLUDED.password_updated_at,
    is_active = TRUE,
    must_change_password = TRUE;

INSERT INTO sca.user_credentials (user_id, password_hash, password_algo, password_updated_at, is_active)
SELECT u.user_id, '$2a$10$alTtbqELJvPPUOGzxIh6Mu1NWS1wHcQORpy6kICCgmocnqQFL.7.a', 'bcrypt', NOW(), TRUE
FROM sca.users u
WHERE u.username = 'employee1'
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_updated_at = EXCLUDED.password_updated_at,
    is_active = TRUE,
    must_change_password = TRUE;

-- Career history (one record)
INSERT INTO sca.career_history (user_id, reason, prev_job_title, new_job_title, prev_grade_code, new_grade_code, prev_dept, new_dept, changed_by_admin_id)
SELECT u.user_id, 'Promotion', 'IT Specialist', 'Senior IT Specialist', 'HIGH', 'GM', 'Engineering', 'Engineering', a.user_id
FROM sca.users u
JOIN sca.users a ON a.username = 'admin'
WHERE u.username = 'employee1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.career_history ch
    WHERE ch.user_id = u.user_id AND ch.reason = 'Promotion'
  );

-- Request types
INSERT INTO sca.request_types (name, description, category, unit, is_system, is_transfer_type, fields)
SELECT 'Annual Leave', 'Annual leave request', 'leave', 'days', FALSE, FALSE,
       '{"fields":[{"id":"start_date","type":"date"},{"id":"end_date","type":"date"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sca.request_types WHERE name = 'Annual Leave');

INSERT INTO sca.request_types (name, description, category, unit, is_system, is_transfer_type, fields)
SELECT 'Sick Leave', 'Sick leave request', 'leave', 'days', FALSE, FALSE,
       '{"fields":[{"id":"start_date","type":"date"},{"id":"end_date","type":"date"},{"id":"attachment","type":"file"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sca.request_types WHERE name = 'Sick Leave');

INSERT INTO sca.request_types (name, description, category, unit, is_system, is_transfer_type, fields)
SELECT 'Hourly Permission', 'Permission by hours', 'permission', 'hours', FALSE, FALSE,
       '{"fields":[{"id":"date","type":"date"},{"id":"hours","type":"number"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sca.request_types WHERE name = 'Hourly Permission');

INSERT INTO sca.request_types (name, description, category, unit, is_system, is_transfer_type, fields)
SELECT 'Transfer Request', 'Internal transfer request', 'transfer', 'none', FALSE, TRUE,
       '{"fields":[{"id":"reason","type":"textarea"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sca.request_types WHERE name = 'Transfer Request');

-- Document requirements
INSERT INTO sca.document_requirements (label, allowedTypes, type, is_mandatory_default)
SELECT 'National ID Copy', 'pdf,jpg,png', 'copy', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sca.document_requirements WHERE label = 'National ID Copy');

INSERT INTO sca.document_requirements (label, allowedTypes, type, is_mandatory_default)
SELECT 'Medical Report', 'pdf,jpg,png', 'original', FALSE
WHERE NOT EXISTS (SELECT 1 FROM sca.document_requirements WHERE label = 'Medical Report');

-- Validation rules
INSERT INTO sca.validation_rules (name, definition)
SELECT 'leave_days_max_30', '{"if":{">": ["$duration",30]},"then":"REJECT"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM sca.validation_rules WHERE name = 'leave_days_max_30');

-- Admin list: request_statuses
INSERT INTO sca.admin_lists (list_name, description)
VALUES ('request_statuses', 'Request statuses')
ON CONFLICT (list_name) DO NOTHING;

INSERT INTO sca.admin_list_items (list_id, item_label, item_value, sort_order)
SELECT l.list_id, v.label, v.val, v.ord
FROM sca.admin_lists l
CROSS JOIN (
  VALUES
    ('Pending', 'PENDING', 1),
    ('Approved', 'APPROVED', 2),
    ('Rejected', 'REJECTED', 3)
) AS v(label, val, ord)
WHERE l.list_name = 'request_statuses'
  AND NOT EXISTS (
    SELECT 1 FROM sca.admin_list_items i
    WHERE i.list_id = l.list_id AND i.item_value = v.val
  );

-- Requests (seeded)
INSERT INTO sca.requests (user_id, employee_id, employee_name, type_id, status, start_date, end_date, quantity, duration, unit, custom_data)
SELECT u.user_id, u.user_id, u.full_name, rt.id, 'APPROVED', DATE '2026-02-01', DATE '2026-02-05', 5, 5, rt.unit,
       jsonb_build_object('seed_key','req_seed_1','notes','demo approved request')
FROM sca.users u
JOIN sca.request_types rt ON rt.name = 'Annual Leave'
WHERE u.username = 'employee1'
  AND NOT EXISTS (SELECT 1 FROM sca.requests r WHERE r.custom_data->>'seed_key' = 'req_seed_1');

INSERT INTO sca.requests (user_id, employee_id, employee_name, type_id, status, start_date, end_date, quantity, duration, unit, custom_data)
SELECT u.user_id, u.user_id, u.full_name, rt.id, 'PENDING', DATE '2026-02-10', DATE '2026-02-10', 2, 2, rt.unit,
       jsonb_build_object('seed_key','req_seed_2','notes','demo pending request')
FROM sca.users u
JOIN sca.request_types rt ON rt.name = 'Hourly Permission'
WHERE u.username = 'employee2'
  AND NOT EXISTS (SELECT 1 FROM sca.requests r WHERE r.custom_data->>'seed_key' = 'req_seed_2');

-- Request approvals
INSERT INTO sca.request_approvals (request_id, step_name, approver_id, approver_name, status, comments, action_date)
SELECT r.request_id, 'Manager Approval', m.user_id, m.full_name, 'APPROVED', 'Auto-approved (demo)', NOW()
FROM sca.requests r
JOIN sca.users m ON m.username = 'manager1'
WHERE r.custom_data->>'seed_key' = 'req_seed_1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.request_approvals a
    WHERE a.request_id = r.request_id AND a.step_name = 'Manager Approval'
  );

-- Unit capacity
INSERT INTO sca.unit_capacity (unit_id, job_id, desired_headcount, current_headcount, workload_index, effective_from)
SELECT ou.unit_id, jt.job_id, 10, 7, 0.75, CURRENT_DATE
FROM sca.organizational_units ou
JOIN sca.job_titles jt ON jt.job_title_en = 'IT Specialist'
WHERE ou.unit_name = 'نظم المعلومات والاتصالات'
  AND NOT EXISTS (
    SELECT 1 FROM sca.unit_capacity uc
    WHERE uc.unit_id = ou.unit_id AND uc.job_id = jt.job_id
  );

-- Transfer request
INSERT INTO sca.transfer_requests (
  user_id, employee_id, employee_name, template_id, status,
  current_unit_id, current_job_id, current_grade_id,
  reason_for_transfer, willing_to_relocate, desired_start_date,
  custom_dynamic_fields
)
SELECT u.user_id, u.user_id, u.full_name, rt.id, 'PENDING',
       ou.unit_id, jt.job_id, jg.grade_id,
       'Looking for growth opportunities', TRUE, DATE '2026-03-01',
       jsonb_build_object('seed_key','transfer_seed_1')
FROM sca.users u
JOIN sca.request_types rt ON rt.name = 'Transfer Request'
JOIN sca.organizational_units ou ON ou.unit_name = 'الإدارة الهندسية'
JOIN sca.job_titles jt ON jt.job_title_en = 'IT Specialist'
JOIN sca.job_grades jg ON jg.grade_code = 'HIGH'
WHERE u.username = 'employee1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.transfer_requests tr
    WHERE tr.custom_dynamic_fields->>'seed_key' = 'transfer_seed_1'
  );

-- Transfer preferences
INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason)
SELECT tr.transfer_id, ou.unit_id, 1, 'Closer to family'
FROM sca.transfer_requests tr
JOIN sca.organizational_units ou ON ou.unit_name = 'إدارة التحركات'
WHERE tr.custom_dynamic_fields->>'seed_key' = 'transfer_seed_1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.transfer_preferences tp
    WHERE tp.transfer_id = tr.transfer_id AND tp.preference_order = 1
  );

INSERT INTO sca.transfer_preferences (transfer_id, unit_id, preference_order, reason)
SELECT tr.transfer_id, ou.unit_id, 2, 'Team experience'
FROM sca.transfer_requests tr
JOIN sca.organizational_units ou ON ou.unit_name = 'إدارة شئون العاملين'
WHERE tr.custom_dynamic_fields->>'seed_key' = 'transfer_seed_1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.transfer_preferences tp
    WHERE tp.transfer_id = tr.transfer_id AND tp.preference_order = 2
  );

-- Transfer manager assessment
INSERT INTO sca.transfer_manager_assessments (transfer_id, manager_id, performance_rating, readiness_for_transfer, recommendation)
SELECT tr.transfer_id, m.user_id, 'GOOD', 'READY', 'Recommended for transfer'
FROM sca.transfer_requests tr
JOIN sca.users m ON m.username = 'manager1'
WHERE tr.custom_dynamic_fields->>'seed_key' = 'transfer_seed_1'
  AND NOT EXISTS (
    SELECT 1 FROM sca.transfer_manager_assessments a
    WHERE a.transfer_id = tr.transfer_id AND a.manager_id = m.user_id
  );

-- Leave balances (ensure after request types)
INSERT INTO sca.leave_balances (user_id, request_type_id, total_entitlement, remaining, unit)
SELECT
  u.user_id,
  rt.id,
  CASE WHEN rt.unit = 'hours' THEN 16 WHEN rt.unit = 'days' THEN 30 ELSE 0 END AS total_entitlement,
  CASE WHEN rt.unit = 'hours' THEN 16 WHEN rt.unit = 'days' THEN 30 ELSE 0 END AS remaining,
  rt.unit
FROM sca.users u
JOIN sca.request_types rt ON rt.unit IN ('hours','days')
ON CONFLICT (user_id, request_type_id) DO NOTHING;

-- User permissions
INSERT INTO sca.user_permissions (user_id, permission_key)
SELECT u.user_id, p.permission_key
FROM sca.users u
JOIN sca.permissions p ON p.permission_key IN ('admin:overview','admin:users','admin:request-types')
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO sca.user_permissions (user_id, permission_key)
SELECT u.user_id, p.permission_key
FROM sca.users u
JOIN sca.permissions p ON p.permission_key IN ('manager:home','manager:incoming','manager:kpis')
WHERE u.username = 'manager1'
ON CONFLICT DO NOTHING;

-- Governance tables
INSERT INTO sca.schema_versions (version_key, checksum, applied_by, notes)
VALUES ('demo_seed', 'manual', 'codex', 'Demo seed data')
ON CONFLICT (version_key) DO NOTHING;

INSERT INTO sca.db_logs (database_type, operation, sql_text, status, source_service, is_verification, environment)
SELECT 'postgres', 'demo_seed', 'seed_demo_postgres.sql', 'ok', 'codex', FALSE, 'demo'
WHERE NOT EXISTS (SELECT 1 FROM sca.db_logs WHERE operation = 'demo_seed');

COMMIT;
