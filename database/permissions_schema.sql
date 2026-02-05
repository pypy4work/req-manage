-- ============================================================
-- Fine-grained Permissions Schema (MSSQL)
-- ============================================================
USE [sca_requests];
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'permissions'
)
BEGIN
    CREATE TABLE [sca].[permissions] (
        [permission_key] NVARCHAR(100) PRIMARY KEY,
        [label] NVARCHAR(200) NOT NULL,
        [description] NVARCHAR(500) NULL,
        [group_name] NVARCHAR(100) NOT NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'sca' AND TABLE_NAME = 'user_permissions'
)
BEGIN
    CREATE TABLE [sca].[user_permissions] (
        [user_id] INT NOT NULL,
        [permission_key] NVARCHAR(100) NOT NULL,
        [granted_at] DATETIME DEFAULT GETDATE(),
        PRIMARY KEY ([user_id], [permission_key]),
        FOREIGN KEY ([user_id]) REFERENCES [sca].[users]([user_id]) ON DELETE CASCADE,
        FOREIGN KEY ([permission_key]) REFERENCES [sca].[permissions]([permission_key]) ON DELETE CASCADE
    );
END
GO

-- Seed permissions (skip existing)
MERGE [sca].[permissions] AS target
USING (VALUES
    ('admin:overview', N'لوحة الإدارة', N'عرض لوحة الإدارة العامة', N'لوحة الإدارة'),
    ('admin:stats', N'التقارير والإحصائيات', N'الوصول إلى صفحة الإحصائيات', N'لوحة الإدارة'),
    ('admin:users', N'إدارة المستخدمين', N'إضافة وتعديل وحذف المستخدمين', N'المستخدمون'),
    ('admin:request-types', N'إدارة أنواع الطلبات', N'تعديل نماذج وأنواع الطلبات', N'الطلبات'),
    ('admin:transfers', N'إدارة صفحة التنقلات', N'عرض ومراجعة طلبات النقل', N'التنقلات'),
    ('admin:allocation-criteria', N'معايير التوزيع العادل', N'تعديل معايير التوزيع', N'التنقلات'),
    ('admin:org-structure', N'الهيكل التنظيمي', N'إدارة الوحدات التنظيمية', N'الهيكل التنظيمي'),
    ('admin:database', N'تحرير قاعدة البيانات', N'الوصول لإدارة الجداول والبيانات', N'قاعدة البيانات'),
    ('admin:settings', N'إعدادات النظام', N'تعديل إعدادات النظام', N'النظام'),
    ('admin:permissions', N'إدارة الصلاحيات', N'تعيين صلاحيات المستخدمين', N'النظام'),
    ('manager:home', N'الرئيسية', N'الوصول إلى الصفحة الرئيسية للمدير', N'لوحة المدير'),
    ('manager:my-requests', N'طلباتي', N'الوصول إلى طلبات المدير الشخصية', N'لوحة المدير'),
    ('manager:incoming', N'الطلبات الواردة', N'عرض الطلبات الواردة للمدير', N'لوحة المدير'),
    ('manager:kpis', N'مؤشرات الأداء', N'عرض مؤشرات الأداء للمدير', N'لوحة المدير')
) AS src ([permission_key], [label], [description], [group_name])
ON target.[permission_key] = src.[permission_key]
WHEN NOT MATCHED THEN
    INSERT ([permission_key], [label], [description], [group_name])
    VALUES (src.[permission_key], src.[label], src.[description], src.[group_name]);
GO
