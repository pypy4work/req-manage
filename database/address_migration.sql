-- ============================================================
-- Migration Script: Hybrid Address System & Unit Grade Limits
-- For SCA Request Management System
-- ============================================================

USE [SCA_RequestManagement];
GO

-- ============================================================
-- 1. Create Addresses Table
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'addresses'
)
BEGIN
    CREATE TABLE [sca].[addresses] (
        [address_id] INT IDENTITY(1,1) PRIMARY KEY,
        [entity_type] NVARCHAR(50) NOT NULL CHECK ([entity_type] IN ('EMPLOYEE_RESIDENCE', 'EMPLOYEE_BIRTHPLACE', 'ORG_UNIT')),
        [entity_id] INT NOT NULL,
        [governorate] NVARCHAR(100) NOT NULL,        -- المحافظة
        [city] NVARCHAR(100) NOT NULL,                -- المدينة/المركز
        [district] NVARCHAR(100) NOT NULL,           -- الحي/القرية
        [street] NVARCHAR(200) NULL,                 -- الشارع
        [building] NVARCHAR(100) NULL,                -- العقار
        [apartment] NVARCHAR(50) NULL,               -- الشقة
        [longitude] DECIMAL(10,7) NULL,             -- خط الطول
        [latitude] DECIMAL(10,7) NULL,               -- خط العرض
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME NULL,
        
        -- Indexes for performance
        INDEX IX_addresses_entity (entity_type, entity_id),
        INDEX IX_addresses_coordinates (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    );
    
    PRINT 'Table [sca].[addresses] created successfully';
END
ELSE
BEGIN
    PRINT 'Table [sca].[addresses] already exists';
END
GO

-- ============================================================
-- 2. Create Unit Grade Limits Table
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'unit_grade_limits'
)
BEGIN
    CREATE TABLE [sca].[unit_grade_limits] (
        [limit_id] INT IDENTITY(1,1) PRIMARY KEY,
        [unit_id] INT NOT NULL,
        [grade_id] INT NOT NULL,
        [max_employees] INT NOT NULL DEFAULT 10,     -- العدد الأقصى
        [current_count] INT NOT NULL DEFAULT 0,      -- العدد الحالي
        [created_date] DATETIME DEFAULT GETDATE(),
        [modified_date] DATETIME NULL,
        
        FOREIGN KEY ([unit_id]) REFERENCES [sca].[organizational_units]([unit_id]),
        FOREIGN KEY ([grade_id]) REFERENCES [sca].[job_grades]([grade_id]),
        UNIQUE ([unit_id], [grade_id]),
        
        INDEX IX_unit_grade_limits_unit (unit_id),
        INDEX IX_unit_grade_limits_grade (grade_id)
    );
    
    PRINT 'Table [sca].[unit_grade_limits] created successfully';
END
ELSE
BEGIN
    PRINT 'Table [sca].[unit_grade_limits] already exists';
END
GO

-- ============================================================
-- 3. Update request_types table to add transfer fields
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'is_transfer_type'
)
BEGIN
    ALTER TABLE [sca].[request_types]
    ADD [is_transfer_type] BIT DEFAULT 0,
        [transfer_config_json] NVARCHAR(MAX) NULL;
    
    PRINT 'Added transfer fields to [sca].[request_types]';
END
ELSE
BEGIN
    PRINT 'Transfer fields already exist in [sca].[request_types]';
END
GO

-- ============================================================
-- 4. Update users table to support addresses (optional)
-- Note: In production, addresses should be in separate table
-- This is just for backward compatibility
-- ============================================================
-- Keep existing address field for backward compatibility
-- New addresses should use the addresses table

-- ============================================================
-- 5. Seed Data: Create default unit grade limits
-- ============================================================
-- Insert default limits for all unit-grade combinations
INSERT INTO [sca].[unit_grade_limits] ([unit_id], [grade_id], [max_employees], [current_count])
SELECT 
    ou.[unit_id],
    jg.[grade_id],
    CASE 
        WHEN ou.[parent_unit_id] IS NULL THEN 20    -- Top-level units: 20 employees per grade
        ELSE 10                                     -- Sub-units: 10 employees per grade
    END AS [max_employees],
    0 AS [current_count]
FROM [sca].[organizational_units] ou
CROSS JOIN [sca].[job_grades] jg
WHERE NOT EXISTS (
    SELECT 1 FROM [sca].[unit_grade_limits] ugl
    WHERE ugl.[unit_id] = ou.[unit_id] 
    AND ugl.[grade_id] = jg.[grade_id]
);
GO

PRINT 'Default unit grade limits created';
GO

-- ============================================================
-- 6. Stored Procedure: Get or Create Address
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'usp_GetOrCreateAddress' AND schema_id = SCHEMA_ID('sca'))
    DROP PROCEDURE [sca].[usp_GetOrCreateAddress];
GO

CREATE PROCEDURE [sca].[usp_GetOrCreateAddress]
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Governorate NVARCHAR(100),
    @City NVARCHAR(100),
    @District NVARCHAR(100),
    @Street NVARCHAR(200) = NULL,
    @Building NVARCHAR(100) = NULL,
    @Apartment NVARCHAR(50) = NULL,
    @Longitude DECIMAL(10,7) = NULL,
    @Latitude DECIMAL(10,7) = NULL,
    @AddressId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if address exists
    SELECT @AddressId = [address_id]
    FROM [sca].[addresses]
    WHERE [entity_type] = @EntityType
    AND [entity_id] = @EntityId;
    
    IF @AddressId IS NULL
    BEGIN
        -- Create new address
        INSERT INTO [sca].[addresses] (
            [entity_type], [entity_id], [governorate], [city], [district],
            [street], [building], [apartment], [longitude], [latitude]
        )
        VALUES (
            @EntityType, @EntityId, @Governorate, @City, @District,
            @Street, @Building, @Apartment, @Longitude, @Latitude
        );
        
        SET @AddressId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        -- Update existing address
        UPDATE [sca].[addresses]
        SET 
            [governorate] = @Governorate,
            [city] = @City,
            [district] = @District,
            [street] = @Street,
            [building] = @Building,
            [apartment] = @Apartment,
            [longitude] = @Longitude,
            [latitude] = @Latitude,
            [updated_at] = GETDATE()
        WHERE [address_id] = @AddressId;
    END
END
GO

-- ============================================================
-- 7. Stored Procedure: Calculate Distance Between Addresses
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'usp_CalculateAddressDistance' AND schema_id = SCHEMA_ID('sca'))
    DROP PROCEDURE [sca].[usp_CalculateAddressDistance];
GO

CREATE PROCEDURE [sca].[usp_CalculateAddressDistance]
    @AddressId1 INT,
    @AddressId2 INT,
    @DistanceKm DECIMAL(10,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Lat1 DECIMAL(10,7), @Lon1 DECIMAL(10,7);
    DECLARE @Lat2 DECIMAL(10,7), @Lon2 DECIMAL(10,7);
    
    -- Get coordinates for address 1
    SELECT @Lat1 = [latitude], @Lon1 = [longitude]
    FROM [sca].[addresses]
    WHERE [address_id] = @AddressId1;
    
    -- Get coordinates for address 2
    SELECT @Lat2 = [latitude], @Lon2 = [longitude]
    FROM [sca].[addresses]
    WHERE [address_id] = @AddressId2;
    
    -- Calculate distance using Haversine formula
    IF @Lat1 IS NOT NULL AND @Lon1 IS NOT NULL 
       AND @Lat2 IS NOT NULL AND @Lon2 IS NOT NULL
    BEGIN
        DECLARE @R DECIMAL(10,2) = 6371; -- Earth radius in km
        DECLARE @dLat FLOAT = RADIANS(@Lat2 - @Lat1);
        DECLARE @dLon FLOAT = RADIANS(@Lon2 - @Lon1);
        
        DECLARE @a FLOAT = 
            SIN(@dLat/2) * SIN(@dLat/2) +
            COS(RADIANS(@Lat1)) * COS(RADIANS(@Lat2)) *
            SIN(@dLon/2) * SIN(@dLon/2);
        
        DECLARE @c FLOAT = 2 * ATN2(SQRT(@a), SQRT(1-@a));
        
        SET @DistanceKm = @R * @c;
    END
    ELSE
    BEGIN
        SET @DistanceKm = NULL;
    END
END
GO

-- ============================================================
-- 8. Function: Get Employee Distance from Unit
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'fn_GetEmployeeUnitDistance' AND type = 'FN')
    DROP FUNCTION [sca].[fn_GetEmployeeUnitDistance];
GO

CREATE FUNCTION [sca].[fn_GetEmployeeUnitDistance]
(
    @EmployeeId INT,
    @UnitId INT
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    DECLARE @Distance DECIMAL(10,2);
    
    DECLARE @EmployeeAddressId INT, @UnitAddressId INT;
    
    -- Get employee residence address
    SELECT @EmployeeAddressId = [address_id]
    FROM [sca].[addresses]
    WHERE [entity_type] = 'EMPLOYEE_RESIDENCE'
    AND [entity_id] = @EmployeeId;
    
    -- Get unit address
    SELECT @UnitAddressId = [address_id]
    FROM [sca].[addresses]
    WHERE [entity_type] = 'ORG_UNIT'
    AND [entity_id] = @UnitId;
    
    -- Calculate distance
    IF @EmployeeAddressId IS NOT NULL AND @UnitAddressId IS NOT NULL
    BEGIN
        EXEC [sca].[usp_CalculateAddressDistance] 
            @EmployeeAddressId, @UnitAddressId, @Distance OUTPUT;
    END
    ELSE
    BEGIN
        SET @Distance = NULL;
    END
    
    RETURN @Distance;
END
GO

PRINT 'Migration completed successfully!';
PRINT 'New tables and procedures created:';
PRINT '  - [sca].[addresses]';
PRINT '  - [sca].[unit_grade_limits]';
PRINT '  - [sca].[usp_GetOrCreateAddress]';
PRINT '  - [sca].[usp_CalculateAddressDistance]';
PRINT '  - [sca].[fn_GetEmployeeUnitDistance]';
GO
