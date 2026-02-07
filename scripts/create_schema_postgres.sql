-- ============================================================
-- Postgres schema for SCA Requests Management
-- Compatible with routes using sca.* tables
-- ============================================================

-- ملاحظة:
-- - تم تحويل الأنواع من NVARCHAR إلى TEXT
-- - تم استخدام SERIAL/BIGSERIAL بدلاً من IDENTITY
-- - التواريخ تستخدم TIMESTAMPTZ / DATE
-- - الحقول التي كانت NVARCHAR(MAX) أصبحت TEXT أو JSONB حسب الاستخدام

CREATE SCHEMA IF NOT EXISTS sca;

-- =========================
-- Governance & Audit
-- =========================

CREATE TABLE IF NOT EXISTS sca.schema_versions (
  version_id BIGSERIAL PRIMARY KEY,
  version_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT,
  schema_hash TEXT,
  execution_ms INT,
  rollback_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sca.db_logs (
  log_id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  database_type TEXT NOT NULL,
  operation TEXT,
  sql_text TEXT,
  params JSONB,
  affected_rows INT,
  execution_ms INT,
  user_id TEXT,
  endpoint TEXT,
  request_id TEXT,
  status TEXT,
  error_message TEXT,
  verification_status TEXT,
  verification_details JSONB,
  source_service TEXT,
  is_verification BOOLEAN NOT NULL DEFAULT FALSE,
  environment TEXT
);

-- =========================
-- System Settings & Profile View Config
-- =========================

CREATE TABLE IF NOT EXISTS sca.system_settings (
  setting_id INT PRIMARY KEY,
  settings_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.profile_view_config (
  id TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  category TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Reference / HR tables
-- =========================

CREATE TABLE IF NOT EXISTS sca.job_grades (
  grade_id SERIAL PRIMARY KEY,
  grade_code TEXT NOT NULL,
  grade_name TEXT NOT NULL,
  min_salary NUMERIC(18,2),
  max_salary NUMERIC(18,2)
);

CREATE TABLE IF NOT EXISTS sca.job_titles (
  job_id SERIAL PRIMARY KEY,
  job_title_ar TEXT NOT NULL,
  job_title_en TEXT
);

CREATE TABLE IF NOT EXISTS sca.employment_types (
  type_id SERIAL PRIMARY KEY,
  type_name TEXT NOT NULL,
  is_benefits_eligible BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sca.org_unit_types (
  type_id SERIAL PRIMARY KEY,
  type_name_ar TEXT NOT NULL,
  type_name_en TEXT,
  level_order INT NOT NULL
);

-- =========================
-- Geography Reference Tables (Egypt)
-- =========================

CREATE TABLE IF NOT EXISTS sca.governorates (
  governorate_id SERIAL PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  code TEXT,
  geoname_id INT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.centers (
  center_id SERIAL PRIMARY KEY,
  governorate_id INT NOT NULL REFERENCES sca.governorates(governorate_id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  geoname_id INT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.cities (
  city_id SERIAL PRIMARY KEY,
  governorate_id INT NOT NULL REFERENCES sca.governorates(governorate_id) ON DELETE CASCADE,
  center_id INT REFERENCES sca.centers(center_id),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  geoname_id INT,
  population INT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.villages (
  village_id SERIAL PRIMARY KEY,
  center_id INT REFERENCES sca.centers(center_id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  geoname_id INT,
  population INT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.neighborhoods (
  neighborhood_id SERIAL PRIMARY KEY,
  city_id INT REFERENCES sca.cities(city_id) ON DELETE CASCADE,
  village_id INT REFERENCES sca.villages(village_id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  geoname_id INT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.organizational_units (
  unit_id SERIAL PRIMARY KEY,
  unit_name TEXT NOT NULL,
  unit_type_id INT NOT NULL REFERENCES sca.org_unit_types(type_id),
  parent_unit_id INT REFERENCES sca.organizational_units(unit_id),
  manager_id INT,
  cost_center_code TEXT
);

CREATE TABLE IF NOT EXISTS sca.users (
  user_id SERIAL PRIMARY KEY,
  employee_number TEXT,
  full_employee_number TEXT,
  full_name TEXT NOT NULL,
  national_id TEXT,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  phone_number TEXT,
  job_id INT REFERENCES sca.job_titles(job_id),
  grade_id INT REFERENCES sca.job_grades(grade_id),
  type_id INT REFERENCES sca.employment_types(type_id),
  org_unit_id INT REFERENCES sca.organizational_units(unit_id),
  role TEXT NOT NULL,
  salary NUMERIC(18,2),
  picture_url TEXT,
  join_date DATE,
  birth_date DATE,
  is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.user_credentials (
  user_id INT PRIMARY KEY REFERENCES sca.users(user_id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'bcrypt',
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  session_version INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.career_history (
  history_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  prev_job_title TEXT,
  new_job_title TEXT,
  prev_grade_code TEXT,
  new_grade_code TEXT,
  prev_dept TEXT,
  new_dept TEXT,
  changed_by_admin_id INT
);

-- =========================
-- Request System
-- =========================

CREATE TABLE IF NOT EXISTS sca.request_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'none',
  info_bar_content TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_transfer_type BOOLEAN NOT NULL DEFAULT FALSE,
  transfer_config JSONB,
  fields JSONB
);

CREATE TABLE IF NOT EXISTS sca.requests (
  request_id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  employee_id INT,
  employee_name TEXT,
  type_id INT REFERENCES sca.request_types(id),
  status TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  quantity NUMERIC(18,2),
  duration NUMERIC(18,2),
  unit TEXT,
  custom_data JSONB,
  attachments JSONB,
  validation_results JSONB,
  document_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_at TIMESTAMPTZ,
  decision_by TEXT,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS sca.request_approvals (
  approval_id SERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES sca.requests(request_id),
  step_name TEXT,
  approver_id INT,
  approver_name TEXT,
  status TEXT,
  comments TEXT,
  action_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sca.leave_balances (
  balance_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  request_type_id INT NOT NULL REFERENCES sca.request_types(id),
  total_entitlement NUMERIC(18,2) NOT NULL DEFAULT 0,
  remaining NUMERIC(18,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'days',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_type_id)
);

-- =========================
-- Documents, Rules
-- =========================

CREATE TABLE IF NOT EXISTS sca.document_requirements (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  allowedTypes TEXT,
  type TEXT,
  is_mandatory_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sca.validation_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  definition JSONB
);

-- =========================
-- Admin Lists (Managed by admin UI)
-- =========================

CREATE TABLE IF NOT EXISTS sca.admin_lists (
  list_id SERIAL PRIMARY KEY,
  list_name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sca.admin_list_items (
  item_id SERIAL PRIMARY KEY,
  list_id INT NOT NULL REFERENCES sca.admin_lists(list_id) ON DELETE CASCADE,
  item_label TEXT NOT NULL,
  item_value TEXT,
  sort_order INT,
  meta JSONB
);

-- =========================
-- Capacity & Transfers (مبسطة)
-- =========================

CREATE TABLE IF NOT EXISTS sca.unit_capacity (
  capacity_id SERIAL PRIMARY KEY,
  unit_id INT NOT NULL REFERENCES sca.organizational_units(unit_id),
  job_id INT REFERENCES sca.job_titles(job_id),
  desired_headcount INT NOT NULL DEFAULT 0,
  current_headcount INT NOT NULL DEFAULT 0,
  workload_index NUMERIC(8,2),
  effective_from DATE,
  effective_to DATE
);

CREATE TABLE IF NOT EXISTS sca.transfer_requests (
  transfer_id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  employee_id INT,
  employee_name TEXT,
  template_id INT REFERENCES sca.request_types(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  current_unit_id INT REFERENCES sca.organizational_units(unit_id),
  current_job_id INT REFERENCES sca.job_titles(job_id),
  current_grade_id INT REFERENCES sca.job_grades(grade_id),
  reason_for_transfer TEXT,
  willing_to_relocate BOOLEAN,
  desired_start_date DATE,
  additional_notes TEXT,
  allocated_unit_id INT REFERENCES sca.organizational_units(unit_id),
  allocated_job_id INT REFERENCES sca.job_titles(job_id),
  allocation_score NUMERIC(5,2),
  allocation_reason TEXT,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_by INT,
  approval_date DATE,
  rejection_reason TEXT,
  decision_by TEXT,
  decision_at TIMESTAMPTZ,
  custom_dynamic_fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assignee_id INT
);

CREATE TABLE IF NOT EXISTS sca.transfer_preferences (
  preference_id SERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES sca.transfer_requests(transfer_id) ON DELETE CASCADE,
  unit_id INT NOT NULL REFERENCES sca.organizational_units(unit_id),
  preference_order INT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS sca.transfer_manager_assessments (
  assessment_id SERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES sca.transfer_requests(transfer_id) ON DELETE CASCADE,
  manager_id INT NOT NULL REFERENCES sca.users(user_id),
  performance_rating TEXT,
  readiness_for_transfer TEXT,
  recommendation TEXT,
  assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Permissions
-- =========================

CREATE TABLE IF NOT EXISTS sca.permissions (
  permission_id SERIAL PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  group_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sca.user_permissions (
  user_id INT NOT NULL REFERENCES sca.users(user_id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES sca.permissions(permission_key) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);

-- =========================
-- Demo Seeds
-- =========================

INSERT INTO sca.org_unit_types (type_name_ar, type_name_en, level_order)
VALUES
  ('رئاسة الهيئة', 'Headquarters', 1),
  ('إدارة عامة', 'Sector', 2),
  ('إدارة', 'Department', 3),
  ('قسم', 'Section', 4),
  ('موقع خارجي', 'Site', 5)
ON CONFLICT DO NOTHING;

INSERT INTO sca.organizational_units (unit_name, unit_type_id, parent_unit_id, manager_id)
VALUES
  ('مكتب رئيس الهيئة', 1, NULL, NULL),
  ('إدارة التحركات', 2, 1, NULL),
  ('الإدارة الهندسية', 2, 1, NULL),
  ('إدارة شئون العاملين', 2, 1, NULL),
  ('نظم المعلومات والاتصالات', 3, 3, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO sca.job_grades (grade_code, grade_name, min_salary, max_salary)
VALUES
  ('EXC', 'الدرجة الممتازة', 25000, 45000),
  ('HIGH', 'الدرجة العالية', 18000, 24000),
  ('GM', 'مدير عام', 14000, 17000)
ON CONFLICT DO NOTHING;

INSERT INTO sca.job_titles (job_title_ar, job_title_en)
VALUES
  ('مرشد أول', 'Senior Pilot'),
  ('مهندس بحري', 'Marine Engineer'),
  ('أخصائي نظم معلومات', 'IT Specialist')
ON CONFLICT DO NOTHING;

INSERT INTO sca.employment_types (type_name, is_benefits_eligible)
VALUES
  ('دائم', TRUE),
  ('مؤقت', FALSE),
  ('انتداب', TRUE)
ON CONFLICT DO NOTHING;

-- Demo admin list: transfer_reasons
INSERT INTO sca.admin_lists (list_name, description)
VALUES ('transfer_reasons', 'Reasons for internal transfers')
ON CONFLICT (list_name) DO NOTHING;

INSERT INTO sca.admin_list_items (list_id, item_label, item_value)
SELECT l.list_id, v.label, v.val
FROM sca.admin_lists l
CROSS JOIN (
  VALUES
    ('Organizational Restructure', 'restructure'),
    ('Capacity Need', 'capacity'),
    ('Employee Request', 'employee_request')
) AS v(label, val)
ON CONFLICT DO NOTHING;

-- Lightweight admin user seed
INSERT INTO sca.users (employee_number, full_employee_number, full_name, username, email, role, org_unit_id, job_id, grade_id, salary)
VALUES ('10001','ADM-10001', 'مسؤول النظام الرئيسي', 'admin', 'admin@sca.gov.eg', 'Admin', 1, 3, 2, 16000)
ON CONFLICT (username) DO NOTHING;

-- Seed default leave balances (can be adjusted later)
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

-- Seed default profile view config
INSERT INTO sca.profile_view_config (id, label_ar, label_en, category, is_visible, is_sensitive)
VALUES
  ('picture_url', 'الصورة الشخصية', 'Profile Picture', 'personal', TRUE, FALSE),
  ('full_name', 'الاسم بالكامل', 'Full Name', 'personal', TRUE, FALSE),
  ('full_employee_number', 'كود الموظف', 'Employee Code', 'professional', TRUE, FALSE),
  ('national_id', 'الرقم القومي', 'National ID', 'personal', FALSE, TRUE),
  ('job_title', 'المسمى الوظيفي', 'Job Title', 'professional', TRUE, FALSE),
  ('org_unit_name', 'الجهة الإدارية', 'Department', 'professional', TRUE, FALSE),
  ('org_units_history', 'الوحدات التي عمل بها', 'Units History', 'professional', TRUE, FALSE),
  ('salary', 'الراتب الأساسي', 'Salary', 'financial', FALSE, TRUE),
  ('join_date', 'تاريخ التعيين', 'Join Date', 'professional', TRUE, FALSE),
  ('phone_number', 'رقم الهاتف', 'Phone', 'contact', TRUE, FALSE),
  ('email', 'البريد الإلكتروني', 'Email', 'contact', TRUE, FALSE),
  ('address', 'العنوان', 'Address', 'contact', FALSE, TRUE),
  ('birth_date', 'تاريخ الميلاد', 'Date of Birth', 'personal', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Indexes
ALTER TABLE sca.request_types ADD COLUMN IF NOT EXISTS info_bar_content TEXT;
ALTER TABLE sca.transfer_requests ADD COLUMN IF NOT EXISTS decision_by TEXT;
ALTER TABLE sca.transfer_requests ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS IX_requests_user ON sca.requests(user_id);
CREATE INDEX IF NOT EXISTS IX_requests_type ON sca.requests(type_id);

-- Example permissions seed (optional)
INSERT INTO sca.permissions (permission_key, label, description, group_name)
VALUES
  ('admin:overview', 'لوحة الإدارة', 'عرض لوحة الإدارة العامة', 'لوحة الإدارة'),
  ('admin:stats', 'التقارير والإحصائيات', 'الوصول إلى صفحة الإحصائيات', 'لوحة الإدارة'),
  ('admin:users', 'إدارة المستخدمين', 'إضافة وتعديل وحذف المستخدمين', 'المستخدمون'),
  ('admin:request-types', 'إدارة أنواع الطلبات', 'تعديل نماذج وأنواع الطلبات', 'الطلبات'),
  ('admin:transfers', 'إدارة صفحة التنقلات', 'عرض ومراجعة طلبات النقل', 'التنقلات'),
  ('admin:allocation-criteria', 'معايير التوزيع العادل', 'تعديل معايير التوزيع', 'التنقلات'),
  ('admin:org-structure', 'الهيكل التنظيمي', 'إدارة الوحدات التنظيمية', 'الهيكل التنظيمي'),
  ('admin:database', 'تحرير قاعدة البيانات', 'الوصول لإدارة الجداول والبيانات', 'قاعدة البيانات'),
  ('admin:settings', 'إعدادات النظام', 'تعديل إعدادات النظام', 'النظام'),
  ('admin:permissions', 'إدارة الصلاحيات', 'تعيين صلاحيات المستخدمين', 'النظام'),
  ('manager:home', 'الرئيسية', 'الوصول إلى الصفحة الرئيسية للمدير', 'لوحة المدير'),
  ('manager:my-requests', 'طلباتي', 'الوصول إلى طلبات المدير الشخصية', 'لوحة المدير'),
  ('manager:incoming', 'الطلبات الواردة', 'عرض الطلبات الواردة للمدير', 'لوحة المدير'),
  ('manager:kpis', 'مؤشرات الأداء', 'عرض مؤشرات الأداء للمدير', 'لوحة المدير')
ON CONFLICT (permission_key) DO NOTHING;
