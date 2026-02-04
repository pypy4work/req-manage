-- ============================================================
-- Transfer & Fair Allocation System Schema
-- For SCA Request Management System
-- ============================================================

USE [sca_requests];
GO

-- ============================================================
-- 1. Transfer Preferences Table
-- ============================================================
CREATE TABLE [sca].[transfer_preferences] (
    [preference_id] INT PRIMARY KEY IDENTITY(1,1),
    [transfer_id] INT NOT NULL,
    [unit_id] INT NOT NULL,
    [preference_order] INT NOT NULL,  -- 1, 2, 3...
    [reason] NVARCHAR(500),
    FOREIGN KEY ([unit_id]) REFERENCES [sca].[organizational_units]([unit_id]),
    -- transfer_id will reference transfer_requests once created
    INDEX IX_transfer_preferences_transfer
        (transfer_id) INCLUDE (unit_id, preference_order)
);
GO

-- ============================================================
-- 2. Manager Assessment Table
-- ============================================================
CREATE TABLE [sca].[transfer_manager_assessments] (
    [assessment_id] INT PRIMARY KEY IDENTITY(1,1),
    [transfer_id] INT NOT NULL,
    [manager_id] INT NOT NULL,
    [performance_rating] NVARCHAR(20) NOT NULL,  -- EXCELLENT, GOOD, SATISFACTORY, NEEDS_IMPROVEMENT
    [readiness_for_transfer] NVARCHAR(20) NOT NULL,  -- READY, NEEDS_TRAINING, NOT_READY
    [recommendation] NVARCHAR(MAX),
    [assessment_date] DATETIME DEFAULT GETDATE(),
    FOREIGN KEY ([manager_id]) REFERENCES [sca].[users]([user_id]),
    INDEX IX_manager_assessments_transfer
        (transfer_id)
);
GO

-- ============================================================
-- 3. Unit Transfer Limits Table
-- ============================================================
CREATE TABLE [sca].[unit_transfer_limits] (
    [limit_id] INT PRIMARY KEY IDENTITY(1,1),
    [unit_id] INT NOT NULL,
    [max_transfers_in] INT DEFAULT 10,        -- Max employees that can transfer in per period
    [max_transfers_out] INT DEFAULT 5,        -- Max employees that can transfer out per period
    [min_employees] INT DEFAULT 3,            -- Minimum staffing level to maintain
    [created_date] DATETIME DEFAULT GETDATE(),
    [modified_date] DATETIME,
    FOREIGN KEY ([unit_id]) REFERENCES [sca].[organizational_units]([unit_id]),
    UNIQUE ([unit_id]),
    INDEX IX_unit_limits_unit
        (unit_id)
);
GO

-- ============================================================
-- 4. Allocation Criteria Table (Master data for fairness rules)
-- ============================================================
CREATE TABLE [sca].[allocation_criteria] (
    [criteria_id] INT PRIMARY KEY IDENTITY(1,1),
    [criterion_name] NVARCHAR(100) NOT NULL,
    [weight] DECIMAL(3,2) NOT NULL,           -- 0.00 to 1.00
    [calculation_method] NVARCHAR(255) NOT NULL,
    [description] NVARCHAR(MAX),
    [is_active] BIT DEFAULT 1,
    [created_date] DATETIME DEFAULT GETDATE(),
    [modified_date] DATETIME,
    INDEX IX_criteria_active
        (is_active) INCLUDE (criterion_name, weight)
);
GO

-- ============================================================
-- 5. Allocation History Table (For auditing and reporting)
-- ============================================================
CREATE TABLE [sca].[allocation_history] (
    [history_id] INT PRIMARY KEY IDENTITY(1,1),
    [allocation_date] DATETIME DEFAULT GETDATE(),
    [total_requests] INT,
    [matched_requests] INT,
    [unmatched_requests] INT,
    [fairness_score] DECIMAL(5,2),            -- 0.00 to 100.00
    [allocation_summary] NVARCHAR(MAX),       -- JSON data
    [created_by] INT,
    INDEX IX_allocation_history_date
        (allocation_date) INCLUDE (total_requests, fairness_score)
);
GO

-- ============================================================
-- 6. UPDATE REQUEST_TYPES TABLE
-- Add transfer-specific fields
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'is_transfer_type'
)
BEGIN
    ALTER TABLE [sca].[request_types]
    ADD [is_transfer_type] BIT DEFAULT 0;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'transfer_config'
)
BEGIN
    ALTER TABLE [sca].[request_types]
    ADD [transfer_config] NVARCHAR(MAX) NULL;
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'transfer_requests'
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'transfer_requests'
        AND COLUMN_NAME = 'custom_dynamic_fields'
    )
    BEGIN
        ALTER TABLE [sca].[transfer_requests]
        ADD [custom_dynamic_fields] NVARCHAR(MAX) NULL;
    END
END
GO

-- ============================================================
-- 7. Seed Data: Default Allocation Criteria
-- ============================================================
INSERT INTO [sca].[allocation_criteria] 
([criterion_name], [weight], [calculation_method], [description], [is_active])
VALUES
    (N'Preference Match', 0.30, N'exact_match_bonus', N'Weight for matching employee''s preferred units', 1),
    (N'Performance Rating', 0.20, N'rating_to_score', N'Excellent(100), Good(85), Satisfactory(70)', 1),
    (N'Unit Needs', 0.20, N'unit_position_required', N'How urgently the unit needs this job category', 1),
    (N'Qualifications', 0.15, N'job_grade_match', N'Employee qualification alignment', 1),
    (N'Special Circumstances', 0.10, N'family_health_score', N'Family, health conditions (+10% adjustment)', 1),
    (N'Application Date', 0.05, N'tenure_in_unit', N'Longer tenure gets priority (fairness)', 1);
GO

-- ============================================================
-- 8. Seed Data: Default Unit Transfer Limits
-- ============================================================
-- This assumes standard units exist; adjust based on actual structure
INSERT INTO [sca].[unit_transfer_limits] 
([unit_id], [max_transfers_in], [max_transfers_out], [min_employees])
SELECT 
    [unit_id],
    CASE 
        WHEN [parent_unit_id] IS NULL THEN 20    -- Top-level units can transfer more
        ELSE 10                                    -- Sub-units more conservative
    END,
    CASE 
        WHEN [parent_unit_id] IS NULL THEN 10
        ELSE 5
    END,
    3
FROM [sca].[organizational_units]
WHERE NOT EXISTS (
    SELECT 1 FROM [sca].[unit_transfer_limits]
    WHERE [unit_transfer_limits].[unit_id] = [organizational_units].[unit_id]
);
GO

-- ============================================================
-- 9. Stored Procedure: Get Transfer Requests with Preferences
-- ============================================================
CREATE PROCEDURE [sca].[usp_GetTransferRequests]
    @Status NVARCHAR(30) = NULL,              -- Filter by status
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL
AS
BEGIN
    SELECT 
        tr.[transfer_id],
        tr.[employee_id],
        u.[full_name] AS [employee_name],
        tr.[template_id],
        tr.[status],
        tr.[current_unit_id],
        ou1.[unit_name] AS [current_unit_name],
        tr.[current_job_id],
        jt.[job_title] AS [current_job_title],
        tr.[current_grade_id],
        jg.[grade_code],
        tr.[reason_for_transfer],
        tr.[willing_to_relocate],
        tr.[desired_start_date],
        tr.[allocated_unit_id],
        ou2.[unit_name] AS [allocated_unit_name],
        tr.[allocated_job_id],
        tr.[allocation_score],
        tr.[submission_date],
        (
            SELECT COUNT(*) 
            FROM [sca].[transfer_preferences] 
            WHERE [transfer_id] = tr.[transfer_id]
        ) AS [preference_count]
    FROM [sca].[transfer_requests] tr
    INNER JOIN [sca].[users] u ON tr.[employee_id] = u.[user_id]
    LEFT JOIN [sca].[organizational_units] ou1 ON tr.[current_unit_id] = ou1.[unit_id]
    LEFT JOIN [sca].[organizational_units] ou2 ON tr.[allocated_unit_id] = ou2.[unit_id]
    LEFT JOIN [sca].[job_titles] jt ON tr.[current_job_id] = jt.[job_id]
    LEFT JOIN [sca].[job_grades] jg ON tr.[current_grade_id] = jg.[grade_id]
    WHERE 
        (@Status IS NULL OR tr.[status] = @Status)
        AND (@FromDate IS NULL OR tr.[submission_date] >= @FromDate)
        AND (@ToDate IS NULL OR tr.[submission_date] <= @ToDate)
    ORDER BY tr.[submission_date] DESC;
END
GO

-- ============================================================
-- 10. Stored Procedure: Get Allocation Criteria
-- ============================================================
CREATE PROCEDURE [sca].[usp_GetAllocationCriteria]
AS
BEGIN
    SELECT 
        [criteria_id],
        [criterion_name],
        [weight],
        [calculation_method],
        [description],
        [is_active]
    FROM [sca].[allocation_criteria]
    WHERE [is_active] = 1
    ORDER BY [criteria_id];
END
GO

-- ============================================================
-- 11. Stored Procedure: Get Unit Transfer Limits
-- ============================================================
CREATE PROCEDURE [sca].[usp_GetUnitTransferLimits]
    @UnitId INT = NULL
AS
BEGIN
    SELECT 
        utl.[limit_id],
        utl.[unit_id],
        ou.[unit_name],
        utl.[max_transfers_in],
        utl.[max_transfers_out],
        utl.[min_employees]
    FROM [sca].[unit_transfer_limits] utl
    INNER JOIN [sca].[organizational_units] ou ON utl.[unit_id] = ou.[unit_id]
    WHERE (@UnitId IS NULL OR utl.[unit_id] = @UnitId)
    ORDER BY ou.[unit_name];
END
GO

-- ============================================================
-- 12. Stored Procedure: Create Transfer Request
-- ============================================================
CREATE PROCEDURE [sca].[usp_CreateTransferRequest]
    @EmployeeId INT,
    @TemplateId INT,
    @Status NVARCHAR(30),
    @CurrentUnitId INT,
    @CurrentJobId INT,
    @CurrentGradeId INT,
    @ReasonForTransfer NVARCHAR(MAX),
    @WillingToRelocate BIT = 0,
    @DesiredStartDate DATETIME = NULL,
    @TransferId INT OUTPUT
AS
BEGIN
    INSERT INTO [sca].[transfer_requests] 
    (
        [employee_id], [template_id], [status],
        [current_unit_id], [current_job_id], [current_grade_id],
        [reason_for_transfer], [willing_to_relocate],
        [desired_start_date], [submission_date]
    )
    VALUES 
    (
        @EmployeeId, @TemplateId, @Status,
        @CurrentUnitId, @CurrentJobId, @CurrentGradeId,
        @ReasonForTransfer, @WillingToRelocate,
        @DesiredStartDate, GETDATE()
    );
    
    SET @TransferId = SCOPE_IDENTITY();
END
GO

-- ============================================================
-- 13. Stored Procedure: Add Transfer Preferences
-- ============================================================
CREATE PROCEDURE [sca].[usp_AddTransferPreference]
    @TransferId INT,
    @UnitId INT,
    @PreferenceOrder INT,
    @Reason NVARCHAR(500) = NULL
AS
BEGIN
    INSERT INTO [sca].[transfer_preferences]
    ([transfer_id], [unit_id], [preference_order], [reason])
    VALUES
    (@TransferId, @UnitId, @PreferenceOrder, @Reason);
END
GO

-- ============================================================
-- 14. Stored Procedure: Add Manager Assessment
-- ============================================================
CREATE PROCEDURE [sca].[usp_AddManagerAssessment]
    @TransferId INT,
    @ManagerId INT,
    @PerformanceRating NVARCHAR(20),
    @ReadinessForTransfer NVARCHAR(20),
    @Recommendation NVARCHAR(MAX)
AS
BEGIN
    INSERT INTO [sca].[transfer_manager_assessments]
    ([transfer_id], [manager_id], [performance_rating], [readiness_for_transfer], [recommendation], [assessment_date])
    VALUES
    (@TransferId, @ManagerId, @PerformanceRating, @ReadinessForTransfer, @Recommendation, GETDATE());
END
GO

-- ============================================================
-- 15. Stored Procedure: Update Transfer Allocation
-- ============================================================
CREATE PROCEDURE [sca].[usp_UpdateTransferAllocation]
    @TransferId INT,
    @AllocatedUnitId INT,
    @AllocatedJobId INT,
    @AllocationScore DECIMAL(5,2),
    @AllocationReason NVARCHAR(MAX),
    @ApprovedBy INT = NULL
AS
BEGIN
    UPDATE [sca].[transfer_requests]
    SET 
        [status] = 'ALLOCATED',
        [allocated_unit_id] = @AllocatedUnitId,
        [allocated_job_id] = @AllocatedJobId,
        [allocation_score] = @AllocationScore,
        [allocation_reason] = @AllocationReason,
        [approved_by] = @ApprovedBy,
        [approval_date] = GETDATE()
    WHERE [transfer_id] = @TransferId;
END
GO

-- ============================================================
-- 16. Stored Procedure: Record Allocation History
-- ============================================================
CREATE PROCEDURE [sca].[usp_RecordAllocationHistory]
    @TotalRequests INT,
    @MatchedRequests INT,
    @UnmatchedRequests INT,
    @FairnessScore DECIMAL(5,2),
    @AllocationSummary NVARCHAR(MAX),
    @CreatedBy INT = NULL
AS
BEGIN
    INSERT INTO [sca].[allocation_history]
    ([total_requests], [matched_requests], [unmatched_requests], [fairness_score], [allocation_summary], [created_by])
    VALUES
    (@TotalRequests, @MatchedRequests, @UnmatchedRequests, @FairnessScore, @AllocationSummary, @CreatedBy);
END
GO

PRINT 'Transfer & Allocation Schema Created Successfully!';
