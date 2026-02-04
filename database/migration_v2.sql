
/*
   SCA Leave Management System - Enterprise Upgrade V2
   Target: MSSQL Server 2019+
   Description: Adds HR Core, Advanced Workflows, Governance, and Auditing.
   Prerequisite: V1 Schema must be applied.
*/

USE SCA_LeaveManagement;
GO

-- =========================================================
-- 1. HR CORE & CAREER MANAGEMENT
-- =========================================================

-- 1.1 Employee Types (e.g., Permanent, Contract, Consultant)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employee_types')
BEGIN
    CREATE TABLE employee_types (
        type_id INT IDENTITY(1,1) PRIMARY KEY,
        type_name NVARCHAR(100) NOT NULL UNIQUE,
        is_benefits_eligible BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
    );
    
    -- Seed Standard Types
    INSERT INTO employee_types (type_name, is_benefits_eligible) VALUES 
    (N'Permanent', 1), (N'Contract', 1), (N'Intern', 0), (N'Consultant', 0);
END
GO

-- 1.2 Job Grades (Financial/Seniority Levels)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'job_grades')
BEGIN
    CREATE TABLE job_grades (
        grade_id INT IDENTITY(1,1) PRIMARY KEY,
        grade_code NVARCHAR(20) UNIQUE NOT NULL, -- e.g., L1, L2
        grade_name NVARCHAR(100),
        min_salary DECIMAL(18,2),
        max_salary DECIMAL(18,2),
        created_at DATETIME DEFAULT GETDATE()
    );

    -- Seed Grades
    INSERT INTO job_grades (grade_code, grade_name) VALUES 
    ('J1', 'Junior'), ('S1', 'Senior'), ('M1', 'Manager'), ('EX', 'Executive');
END
GO

-- 1.3 Enhance Users Table with HR Fields
-- We use dynamic SQL or checks to avoid errors if columns exist (Idempotent script)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'employee_number')
BEGIN
    ALTER TABLE users ADD 
        employee_number NVARCHAR(50),
        type_id INT,
        grade_id INT,
        manager_id INT; -- Direct Line Manager (overrides Unit Manager if set)

    -- Add Constraints
    ALTER TABLE users ADD CONSTRAINT UQ_EmployeeNumber UNIQUE (employee_number);
    ALTER TABLE users ADD CONSTRAINT FK_User_Type FOREIGN KEY (type_id) REFERENCES employee_types(type_id);
    ALTER TABLE users ADD CONSTRAINT FK_User_Grade FOREIGN KEY (grade_id) REFERENCES job_grades(grade_id);
    ALTER TABLE users ADD CONSTRAINT FK_User_Manager FOREIGN KEY (manager_id) REFERENCES users(user_id);
END
GO

-- 1.4 Career History (Promotions/Transfers Log)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'career_history')
BEGIN
    CREATE TABLE career_history (
        history_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        prev_job_id INT,
        new_job_id INT,
        prev_grade_id INT,
        new_grade_id INT,
        change_date DATETIME DEFAULT GETDATE(),
        change_reason NVARCHAR(500), -- Promotion, Transfer, Reorg
        changed_by INT, -- Admin who performed the action
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (changed_by) REFERENCES users(user_id)
    );
END
GO

-- =========================================================
-- 2. ORGANIZATIONAL GOVERNANCE
-- =========================================================

-- 2.0 Unit Types (Best Practice: Normalized types)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'organizational_unit_types')
BEGIN
    CREATE TABLE organizational_unit_types (
        type_id INT IDENTITY(1,1) PRIMARY KEY,
        type_name_ar NVARCHAR(100) NOT NULL,
        type_name_en NVARCHAR(100) NOT NULL,
        level_order INT NOT NULL -- 1=Sector, 5=Unit (For sorting)
    );

    INSERT INTO organizational_unit_types (type_name_ar, type_name_en, level_order) VALUES
    (N'قطاع', 'Sector', 1),
    (N'إدارة عامة', 'General Department', 2),
    (N'إدارة', 'Department', 3),
    (N'قسم', 'Section', 4),
    (N'فرع', 'Branch', 5);
END
GO

-- 2.1 Assign Managers to Units
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('organizational_units') AND name = 'manager_id')
BEGIN
    ALTER TABLE organizational_units ADD 
        manager_id INT,
        cost_center_code NVARCHAR(50),
        unit_type_id INT; -- Replace string based unit_type

    ALTER TABLE organizational_units ADD CONSTRAINT FK_Unit_Manager FOREIGN KEY (manager_id) REFERENCES users(user_id);
    ALTER TABLE organizational_units ADD CONSTRAINT FK_Unit_Type FOREIGN KEY (unit_type_id) REFERENCES organizational_unit_types(type_id);
    
    -- Optional: Drop old string column if migrating data
    -- ALTER TABLE organizational_units DROP COLUMN unit_type; 
END
GO

-- 2.2 Unit Management History (Audit who managed what & when)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'unit_managers_history')
BEGIN
    CREATE TABLE unit_managers_history (
        history_id INT IDENTITY(1,1) PRIMARY KEY,
        unit_id INT NOT NULL,
        manager_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        assigned_by INT,
        FOREIGN KEY (unit_id) REFERENCES organizational_units(unit_id),
        FOREIGN KEY (manager_id) REFERENCES users(user_id)
    );
END
GO

-- =========================================================
-- 3. ENTERPRISE WORKFLOW ENGINE
-- =========================================================

-- 3.1 Workflow Definitions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'workflows')
BEGIN
    CREATE TABLE workflows (
        workflow_id INT IDENTITY(1,1) PRIMARY KEY,
        workflow_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500),
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
    );

    INSERT INTO workflows (workflow_name, description) VALUES 
    ('Standard Approval', 'Direct Manager -> Approval'),
    ('Executive Approval', 'Direct Manager -> HR Director -> GM'),
    ('Sick Leave Workflow', 'Medical Check -> Direct Manager');
END
GO

-- 3.2 Workflow Steps configuration
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_steps')
BEGIN
    CREATE TABLE workflow_steps (
        step_id INT IDENTITY(1,1) PRIMARY KEY,
        workflow_id INT NOT NULL,
        step_order INT NOT NULL, -- 1, 2, 3
        step_name NVARCHAR(100) NOT NULL, -- e.g., "Manager Review"
        approver_role NVARCHAR(50), -- 'Manager', 'HR', 'Admin' (Maps to Role Enum)
        is_final BIT DEFAULT 0, -- If approved here, request is fully APPROVED
        sla_hours INT DEFAULT 24, -- Time allowed before escalation
        FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id)
    );

    -- Seed Steps
    INSERT INTO workflow_steps (workflow_id, step_order, step_name, approver_role, is_final) VALUES
    (1, 1, 'Direct Manager Review', 'Manager', 1),
    (2, 1, 'Direct Manager Review', 'Manager', 0),
    (2, 2, 'HR Review', 'Admin', 0),
    (2, 3, 'GM Final Approval', 'Admin', 1);
END
GO

-- 3.3 Link Request Types to Workflows
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('request_types') AND name = 'workflow_id')
BEGIN
    ALTER TABLE request_types ADD workflow_id INT;
    ALTER TABLE request_types ADD CONSTRAINT FK_Request_Workflow FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id);
END
GO

-- 3.4 Request Approval Transaction Log (The Lifecycle)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'request_approvals')
BEGIN
    CREATE TABLE request_approvals (
        approval_id INT IDENTITY(1,1) PRIMARY KEY,
        request_id INT NOT NULL,
        step_id INT NOT NULL,
        approver_id INT, -- Specific user who approved
        status NVARCHAR(50) CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Skipped')),
        comments NVARCHAR(MAX),
        assigned_at DATETIME DEFAULT GETDATE(),
        actioned_at DATETIME,
        FOREIGN KEY (request_id) REFERENCES leave_requests(request_id),
        FOREIGN KEY (step_id) REFERENCES workflow_steps(step_id),
        FOREIGN KEY (approver_id) REFERENCES users(user_id)
    );

    CREATE INDEX IDX_Request_Approval_ReqID ON request_approvals(request_id);
END
GO

-- =========================================================
-- 4. RULE ENGINE & AUDITING
-- =========================================================

-- 4.1 Reusable Business Rules Repository
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'business_rules')
BEGIN
    CREATE TABLE business_rules (
        rule_id INT IDENTITY(1,1) PRIMARY KEY,
        rule_code NVARCHAR(50) UNIQUE NOT NULL, -- e.g., 'MAX_CONSECUTIVE_DAYS'
        description NVARCHAR(500),
        logic_expression NVARCHAR(MAX), -- SQL or JSON Logic for server-side evaluation
        is_active BIT DEFAULT 1,
        severity NVARCHAR(20) CHECK (severity IN ('Warning', 'Block')) DEFAULT 'Block'
    );
END
GO

-- 4.2 Linking rules to request types (Many-to-Many)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'request_type_rules')
BEGIN
    CREATE TABLE request_type_rules (
        mapping_id INT IDENTITY(1,1) PRIMARY KEY,
        type_id INT NOT NULL,
        rule_id INT NOT NULL,
        priority INT DEFAULT 0,
        parameter_json NVARCHAR(MAX), -- Override parameters e.g., {"max_days": 5}
        FOREIGN KEY (type_id) REFERENCES request_types(type_id),
        FOREIGN KEY (rule_id) REFERENCES business_rules(rule_id)
    );
END
GO

-- 4.3 Centralized Audit Logs
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
BEGIN
    CREATE TABLE audit_logs (
        log_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        table_name NVARCHAR(100) NOT NULL,
        record_id NVARCHAR(50) NOT NULL,
        action_type NVARCHAR(20) CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT')),
        old_value NVARCHAR(MAX), -- JSON snapshot
        new_value NVARCHAR(MAX), -- JSON snapshot
        changed_by INT, -- User ID
        ip_address NVARCHAR(50),
        user_agent NVARCHAR(200),
        created_at DATETIME DEFAULT GETDATE()
    );

    CREATE INDEX IDX_Audit_Table_Record ON audit_logs(table_name, record_id);
    CREATE INDEX IDX_Audit_Date ON audit_logs(created_at);
END
GO

-- =========================================================
-- 5. NOTIFICATION & IMPORTS
-- =========================================================

-- 5.1 Central Notifications Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE notifications (
        notif_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(200),
        message NVARCHAR(MAX),
        type NVARCHAR(20) CHECK (type IN ('Info', 'Success', 'Warning', 'Error')),
        reference_link NVARCHAR(500), -- e.g., '#/requests/100'
        is_read BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE INDEX IDX_Notif_User_Unread ON notifications(user_id, is_read);
END
GO

-- 5.2 Bulk Import Tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'data_imports')
BEGIN
    CREATE TABLE data_imports (
        import_id INT IDENTITY(1,1) PRIMARY KEY,
        file_name NVARCHAR(255) NOT NULL,
        entity_type NVARCHAR(50) NOT NULL, -- 'Users', 'Balances'
        imported_by INT NOT NULL,
        status NVARCHAR(20) CHECK (status IN ('Processing', 'Completed', 'Failed', 'Partial')),
        total_records INT DEFAULT 0,
        success_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        started_at DATETIME DEFAULT GETDATE(),
        completed_at DATETIME,
        FOREIGN KEY (imported_by) REFERENCES users(user_id)
    );

    CREATE TABLE data_import_logs (
        log_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        import_id INT NOT NULL,
        row_number INT,
        error_message NVARCHAR(MAX),
        raw_data NVARCHAR(MAX),
        FOREIGN KEY (import_id) REFERENCES data_imports(import_id)
    );
END
GO
