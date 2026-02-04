-- ============================================================
-- جدول طلبات النقل - مطابق لهيكل Mock في التطبيق
-- يعمل مع transfer_schema.sql (تفضيلات الوحدات، التقييمات، إلخ)
-- ============================================================
-- الاستخدام: نفّذ هذا الملف قبل أو مع transfer_schema.sql إذا لم يكن
-- جدول transfer_requests موجوداً في قاعدة MSSQL.
-- ============================================================

USE [sca_requests];
-- أو استخدم اسم قاعدة البيانات الفعلية: SCA_RequestManagement
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'transfer_requests'
)
BEGIN
    CREATE TABLE [sca].[transfer_requests] (
        [transfer_id] INT IDENTITY(1,1) PRIMARY KEY,
        [request_id] INT NULL,                    -- ربط مع requests إذا أردت توحيد القائمة
        [user_id] INT NOT NULL,                  -- للمطابقة مع getMyRequests
        [employee_id] INT NOT NULL,
        [employee_name] NVARCHAR(200) NULL,
        [template_id] INT NOT NULL,
        [status] NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        [current_unit_id] INT NOT NULL,
        [current_job_id] INT NOT NULL,
        [current_grade_id] INT NOT NULL,
        [reason_for_transfer] NVARCHAR(MAX) NOT NULL,
        [willing_to_relocate] BIT DEFAULT 0,
        [desired_start_date] DATE NULL,
        [additional_notes] NVARCHAR(MAX) NULL,
        [custom_dynamic_fields] NVARCHAR(MAX) NULL,
        [submission_date] DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        [created_at] DATETIME DEFAULT GETDATE(),
        [allocated_unit_id] INT NULL,
        [allocated_job_id] INT NULL,
        [allocation_score] DECIMAL(5,2) NULL,
        [allocation_reason] NVARCHAR(MAX) NULL,
        [approved_by] INT NULL,
        [approval_date] DATETIME NULL,
        [rejection_reason] NVARCHAR(MAX) NULL,
        [decision_at] DATETIME NULL,
        [decision_by] NVARCHAR(50) NULL,
        [assignee_id] INT NULL,
        [is_edited] BIT DEFAULT 0,
        INDEX IX_transfer_requests_employee (employee_id),
        INDEX IX_transfer_requests_status (status),
        INDEX IX_transfer_requests_user (user_id),
        INDEX IX_transfer_requests_submission (submission_date)
    );
    PRINT 'Table [sca].[transfer_requests] created.';
END
ELSE
    PRINT 'Table [sca].[transfer_requests] already exists.';
GO

-- تفضيلات الوحدات تُخزّن في [sca].[transfer_preferences] (من transfer_schema.sql)
-- بحيث كل صف: transfer_id, unit_id, preference_order
