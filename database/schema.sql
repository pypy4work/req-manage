
/* =========================================================
   SCA Enterprise Request Management System (ERMS)
   Target: MSSQL Server 2019+
   ========================================================= */

USE master;
GO

IF DB_ID('SCA_RequestManagement') IS NOT NULL
BEGIN
    ALTER DATABASE SCA_RequestManagement SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SCA_RequestManagement;
END
GO

CREATE DATABASE SCA_RequestManagement;
GO
USE SCA_RequestManagement;
GO

/* =========================================================
   1. ORGANIZATIONAL STRUCTURE & HR CORE
   ========================================================= */
-- (Standard Tables same as previous, omitted for brevity, assuming standard HR Core exists)
-- ... [organizational_unit_types, organizational_units, job_titles, job_grades, employment_types, system_roles, employee_suffixes] ...

CREATE TABLE employee_suffixes (
    suffix_id INT IDENTITY(1,1) PRIMARY KEY,
    suffix_code NVARCHAR(10) NOT NULL UNIQUE, 
    suffix_name NVARCHAR(100)
);
GO

/* =========================================================
   2. USERS & SECURITY
   ========================================================= */
-- ... [users, user_credentials, career_history] ...

CREATE TABLE users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(200),
    username NVARCHAR(100) UNIQUE,
    -- ... other fields
    created_at DATETIME DEFAULT GETDATE()
);
GO

/* =========================================================
   3. DEFINITIONS (Decoupled Architecture)
   ========================================================= */

-- 3.1 Global Validation Rules Repository
CREATE TABLE validation_rules (
    rule_id INT IDENTITY(1,1) PRIMARY KEY,
    rule_name NVARCHAR(100) NOT NULL,
    left_field_id NVARCHAR(100) NOT NULL, -- Field name or System Variable
    operator NVARCHAR(10) NOT NULL, -- >, <, ==, etc.
    right_source NVARCHAR(20) CHECK (right_source IN ('static', 'field', 'balance')),
    right_value NVARCHAR(200), -- Value or Field Name
    suggested_action NVARCHAR(20) CHECK (suggested_action IN ('APPROVE', 'REJECT', 'MANUAL_REVIEW')),
    error_message_ar NVARCHAR(MAX),
    is_active BIT DEFAULT 1
);
GO

-- 3.2 Global Document Repository
CREATE TABLE document_requirements (
    doc_def_id INT IDENTITY(1,1) PRIMARY KEY,
    doc_label NVARCHAR(200) NOT NULL,
    allowed_types_json NVARCHAR(200), -- ['pdf', 'jpg']
    doc_type NVARCHAR(20) CHECK (doc_type IN ('original', 'copy', 'certified_copy')),
    is_mandatory_default BIT DEFAULT 1
);
GO

-- 3.3 Request Types
CREATE TABLE request_types (
    type_id INT IDENTITY(1,1) PRIMARY KEY,
    type_name_ar NVARCHAR(200) NOT NULL,
    category NVARCHAR(50),
    balance_unit NVARCHAR(20) CHECK (balance_unit IN ('days', 'hours', 'amount', 'none')),
    fields_config_json NVARCHAR(MAX), 
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 3.4 Request Type <-> Rules (Many-to-Many)
CREATE TABLE request_type_rules_link (
    link_id INT IDENTITY(1,1) PRIMARY KEY,
    request_type_id INT REFERENCES request_types(type_id) ON DELETE CASCADE,
    rule_id INT REFERENCES validation_rules(rule_id),
    priority INT DEFAULT 0
);
GO

-- 3.5 Request Type <-> Documents (Many-to-Many)
CREATE TABLE request_type_docs_link (
    link_id INT IDENTITY(1,1) PRIMARY KEY,
    request_type_id INT REFERENCES request_types(type_id) ON DELETE CASCADE,
    doc_def_id INT REFERENCES document_requirements(doc_def_id),
    is_mandatory BIT DEFAULT 1
);
GO

/* =========================================================
   4. REQUESTS EXECUTION
   ========================================================= */

-- 4.1 Request Statuses
CREATE TABLE request_statuses (
    status_id INT IDENTITY(1,1) PRIMARY KEY,
    status_code NVARCHAR(50) UNIQUE
);
GO

-- 4.2 Allowances
CREATE TABLE allowance_balances (
    balance_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    request_type_id INT REFERENCES request_types(type_id),
    remaining_balance DECIMAL(18,2)
);
GO

-- 4.3 The REQUESTS Table
CREATE TABLE requests (
    request_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    request_type_id INT REFERENCES request_types(type_id),
    
    status_code NVARCHAR(50), -- Denormalized for easier query
    
    start_date DATE,
    end_date DATE,
    quantity DECIMAL(18,2), -- Duration
    
    form_data_json NVARCHAR(MAX),
    
    -- The Logic Engine Results
    validation_results_json NVARCHAR(MAX), -- Stored as [1, 0, 1, 1]
    
    decision_by NVARCHAR(50), -- System_Rule, Human_Manager, etc.
    rejection_reason NVARCHAR(MAX),
    
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 4.4 Attachments
CREATE TABLE request_attachments (
    attachment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id),
    doc_def_id INT REFERENCES document_requirements(doc_def_id),
    file_url NVARCHAR(MAX),
    uploaded_at DATETIME DEFAULT GETDATE()
);
GO
