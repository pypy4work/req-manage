/*
  create_schema_mssql.sql

  T-SQL script to create the production schema for SCA Requests Management
  - Creates core HR, requests, admin-lists, capacity and transfer tables
  - Adds stored procedures for admin-managed lists (safe, schema-driven)
  - Seeds essential reference data matching the frontend mock

  Usage (example):
    sqlcmd -S <server> -U <user> -P <password> -i create_schema_mssql.sql

  Or using PowerShell with Invoke-Sqlcmd (SqlServer module):
    Invoke-Sqlcmd -ServerInstance "<server>" -Username "<user>" -Password "<password>" -InputFile .\\scripts\\create_schema_mssql.sql

  NOTE: Review and adapt types, sizes, and constraints to your environment and security policies.
*/

SET NOCOUNT ON;

-- Create schema
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sca')
  EXEC('CREATE SCHEMA sca');

-- =========================
-- Reference / HR tables
-- =========================
CREATE TABLE sca.job_grades (
  grade_id INT IDENTITY(1,1) PRIMARY KEY,
  grade_code NVARCHAR(50) NOT NULL,
  grade_name NVARCHAR(200) NOT NULL,
  min_salary DECIMAL(18,2) NULL,
  max_salary DECIMAL(18,2) NULL
);

CREATE TABLE sca.job_titles (
  job_id INT IDENTITY(1,1) PRIMARY KEY,
  job_title_ar NVARCHAR(200) NOT NULL,
  job_title_en NVARCHAR(200) NULL
);

CREATE TABLE sca.employment_types (
  type_id INT IDENTITY(1,1) PRIMARY KEY,
  type_name NVARCHAR(100) NOT NULL,
  is_benefits_eligible BIT NOT NULL DEFAULT 0
);

CREATE TABLE sca.org_unit_types (
  type_id INT IDENTITY(1,1) PRIMARY KEY,
  type_name_ar NVARCHAR(200) NOT NULL,
  type_name_en NVARCHAR(200) NULL,
  level_order INT NOT NULL
);

CREATE TABLE sca.organizational_units (
  unit_id INT IDENTITY(1,1) PRIMARY KEY,
  unit_name NVARCHAR(300) NOT NULL,
  unit_type_id INT NOT NULL REFERENCES sca.org_unit_types(type_id),
  parent_unit_id INT NULL REFERENCES sca.organizational_units(unit_id),
  manager_id INT NULL,
  cost_center_code NVARCHAR(50) NULL
);

-- Users table (simplified for production)
CREATE TABLE sca.users (
  user_id INT IDENTITY(1,1) PRIMARY KEY,
  employee_number NVARCHAR(50) NULL,
  full_employee_number NVARCHAR(100) NULL,
  full_name NVARCHAR(300) NOT NULL,
  national_id NVARCHAR(50) NULL,
  username NVARCHAR(100) NOT NULL UNIQUE,
  email NVARCHAR(200) NULL,
  phone_number NVARCHAR(50) NULL,
  job_id INT NULL REFERENCES sca.job_titles(job_id),
  grade_id INT NULL REFERENCES sca.job_grades(grade_id),
  type_id INT NULL REFERENCES sca.employment_types(type_id),
  org_unit_id INT NULL REFERENCES sca.organizational_units(unit_id),
  role NVARCHAR(50) NOT NULL,
  salary DECIMAL(18,2) NULL,
  picture_url NVARCHAR(1000) NULL,
  join_date DATE NULL,
  birth_date DATE NULL,
  is_2fa_enabled BIT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Career history
CREATE TABLE sca.career_history (
  history_id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  change_date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  reason NVARCHAR(500) NULL,
  prev_job_title NVARCHAR(200) NULL,
  new_job_title NVARCHAR(200) NULL,
  prev_grade_code NVARCHAR(50) NULL,
  new_grade_code NVARCHAR(50) NULL,
  prev_dept NVARCHAR(300) NULL,
  new_dept NVARCHAR(300) NULL,
  changed_by_admin_id INT NULL
);

-- =========================
-- Request System
-- =========================
CREATE TABLE sca.request_types (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  description NVARCHAR(1000) NULL,
  category NVARCHAR(100) NULL,
  unit NVARCHAR(20) NOT NULL DEFAULT 'none',
  is_system BIT NOT NULL DEFAULT 0,
  fields NVARCHAR(MAX) NULL -- JSON array of FormField objects (frontend-friendly)
);

CREATE TABLE sca.requests (
  request_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  employee_id INT NULL,
  employee_name NVARCHAR(300) NULL,
  type_id INT NULL REFERENCES sca.request_types(id),
  status NVARCHAR(50) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  quantity DECIMAL(18,2) NULL,
  duration DECIMAL(18,2) NULL,
  unit NVARCHAR(20) NULL,
  custom_data NVARCHAR(MAX) NULL, -- JSON
  attachments NVARCHAR(MAX) NULL, -- JSON array of uploaded file metadata
  validation_results NVARCHAR(MAX) NULL, -- JSON
  document_results NVARCHAR(MAX) NULL, -- JSON
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  decision_at DATETIME2 NULL,
  decision_by NVARCHAR(100) NULL,
  rejection_reason NVARCHAR(1000) NULL
);

CREATE TABLE sca.request_approvals (
  approval_id INT IDENTITY(1,1) PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES sca.requests(request_id),
  step_name NVARCHAR(200) NULL,
  approver_id INT NULL,
  approver_name NVARCHAR(300) NULL,
  status NVARCHAR(50) NULL,
  comments NVARCHAR(2000) NULL,
  action_date DATETIME2 NULL
);

-- =========================
-- Documents, Rules
-- =========================
CREATE TABLE sca.document_requirements (
  id INT IDENTITY(1,1) PRIMARY KEY,
  label NVARCHAR(300) NOT NULL,
  allowedTypes NVARCHAR(200) NULL, -- comma-separated
  type NVARCHAR(50) NULL,
  is_mandatory_default BIT NOT NULL DEFAULT 0
);

CREATE TABLE sca.validation_rules (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(300) NOT NULL,
  definition NVARCHAR(MAX) NULL -- JSON to describe operands/operator/action
);

-- =========================
-- Admin Lists (Managed by admin UI)
-- =========================
CREATE TABLE sca.admin_lists (
  list_id INT IDENTITY(1,1) PRIMARY KEY,
  list_name NVARCHAR(200) NOT NULL UNIQUE,
  description NVARCHAR(1000) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE sca.admin_list_items (
  item_id INT IDENTITY(1,1) PRIMARY KEY,
  list_id INT NOT NULL REFERENCES sca.admin_lists(list_id) ON DELETE CASCADE,
  item_label NVARCHAR(500) NOT NULL,
  item_value NVARCHAR(500) NULL,
  sort_order INT NULL,
  meta NVARCHAR(MAX) NULL -- JSON for arbitrary metadata
);

-- =========================
-- Capacity & Transfers
-- =========================
CREATE TABLE sca.unit_capacity (
  capacity_id INT IDENTITY(1,1) PRIMARY KEY,
  unit_id INT NOT NULL REFERENCES sca.organizational_units(unit_id),
  job_id INT NULL REFERENCES sca.job_titles(job_id),
  desired_headcount INT NOT NULL DEFAULT 0,
  current_headcount INT NOT NULL DEFAULT 0,
  workload_index DECIMAL(8,2) NULL,
  effective_from DATE NULL,
  effective_to DATE NULL
);

CREATE TABLE sca.transfer_requests (
  transfer_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES sca.users(user_id),
  from_unit_id INT NULL REFERENCES sca.organizational_units(unit_id),
  to_unit_id INT NULL REFERENCES sca.organizational_units(unit_id),
  reason NVARCHAR(1000) NULL,
  status NVARCHAR(50) NOT NULL DEFAULT 'PENDING',
  requested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  processed_at DATETIME2 NULL,
  processed_by INT NULL
);

-- =========================
-- Stored Procedures for admin lists
-- =========================
GO
-- Create or return list id by name
CREATE PROCEDURE sca.usp_CreateAdminList
  @ListName NVARCHAR(200),
  @Description NVARCHAR(1000) = NULL,
  @OutListId INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM sca.admin_lists WHERE list_name = @ListName)
  BEGIN
    SELECT @OutListId = list_id FROM sca.admin_lists WHERE list_name = @ListName;
    RETURN 0;
  END

  INSERT INTO sca.admin_lists (list_name, description) VALUES (@ListName, @Description);
  SELECT @OutListId = SCOPE_IDENTITY();
END
GO

CREATE PROCEDURE sca.usp_GetAdminListItems
  @ListName NVARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT i.*
  FROM sca.admin_list_items i
  JOIN sca.admin_lists l ON l.list_id = i.list_id
  WHERE l.list_name = @ListName
  ORDER BY i.sort_order, i.item_id;
END
GO

CREATE PROCEDURE sca.usp_AddAdminListItem
  @ListName NVARCHAR(200),
  @Label NVARCHAR(500),
  @Value NVARCHAR(500) = NULL,
  @Meta NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @lid INT;
  SELECT @lid = list_id FROM sca.admin_lists WHERE list_name = @ListName;
  IF @lid IS NULL
  BEGIN
    INSERT INTO sca.admin_lists (list_name) VALUES (@ListName); SET @lid = SCOPE_IDENTITY();
  END
  INSERT INTO sca.admin_list_items (list_id, item_label, item_value, meta) VALUES (@lid, @Label, @Value, @Meta);
END
GO

CREATE PROCEDURE sca.usp_UpdateAdminListItem
  @ItemId INT,
  @Label NVARCHAR(500),
  @Value NVARCHAR(500) = NULL,
  @Meta NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE sca.admin_list_items SET item_label = @Label, item_value = @Value, meta = @Meta WHERE item_id = @ItemId;
END
GO

CREATE PROCEDURE sca.usp_DeleteAdminListItem
  @ItemId INT
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM sca.admin_list_items WHERE item_id = @ItemId;
END
GO

-- =========================
-- Seed reference data (lightweight demo seeds)
-- =========================
INSERT INTO sca.org_unit_types (type_name_ar, type_name_en, level_order) VALUES
 (N'رئاسة الهيئة', 'Headquarters', 1), (N'إدارة عامة','Sector',2), (N'إدارة','Department',3), (N'قسم','Section',4), (N'موقع خارجي','Site',5);

INSERT INTO sca.organizational_units (unit_name, unit_type_id, parent_unit_id, manager_id) VALUES
 (N'مكتب رئيس الهيئة', 1, NULL, NULL),
 (N'إدارة التحركات', 2, 1, NULL),
 (N'الإدارة الهندسية', 2, 1, NULL),
 (N'إدارة شئون العاملين', 2, 1, NULL),
 (N'نظم المعلومات والاتصالات', 3, 3, NULL);

INSERT INTO sca.job_grades (grade_code, grade_name, min_salary, max_salary) VALUES
 ('EXC', N'الدرجة الممتازة', 25000, 45000),
 ('HIGH', N'الدرجة العالية', 18000, 24000),
 ('GM', N'مدير عام', 14000, 17000);

INSERT INTO sca.job_titles (job_title_ar, job_title_en) VALUES
 (N'مرشد أول', 'Senior Pilot'), (N'مهندس بحري', 'Marine Engineer'), (N'أخصائي نظم معلومات', 'IT Specialist');

INSERT INTO sca.employment_types (type_name, is_benefits_eligible) VALUES (N'دائم', 1), (N'مؤقت', 0), (N'انتداب', 1);

-- Demo admin list: transfer_reasons
DECLARE @lid INT; EXEC sca.usp_CreateAdminList @ListName = N'transfer_reasons', @Description=N'Reasons for internal transfers', @OutListId=@lid OUTPUT;
EXEC sca.usp_AddAdminListItem @ListName=N'transfer_reasons', @Label=N'Organizational Restructure', @Value=N'restructure';
EXEC sca.usp_AddAdminListItem @ListName=N'transfer_reasons', @Label=N'Capacity Need', @Value=N'capacity';
EXEC sca.usp_AddAdminListItem @ListName=N'transfer_reasons', @Label=N'Employee Request', @Value=N'employee_request';

GO

-- Lightweight admin user seed (please change admin password & account-provisioning in production)
INSERT INTO sca.users (employee_number, full_employee_number, full_name, username, email, role, org_unit_id, job_id, grade_id, salary) VALUES
 ('10001','ADM-10001', N'مسؤول النظام الرئيسي', 'admin', 'admin@sca.gov.eg', 'Admin', 1, 3, 2, 16000);

GO

-- Indexes for performance (examples)
CREATE INDEX IX_requests_user ON sca.requests(user_id);
CREATE INDEX IX_requests_type ON sca.requests(type_id);

PRINT 'Schema and demo data created. Review seeds and adjust as needed.';

/* End of script */
