
import { User, UserCredentials, Role, RequestStatusCode, GenericRequest, AllowanceBalance, SystemSettings, ModeType, KPIStats, ManagerStats, RequestDefinition, LoginResult, DatabaseConfig, OrganizationalUnit, DailyAttendanceStat, CareerHistory, OrgUnitType, EmployeeSuffix, TimeFilter, AttendanceTrend, JobTitle, JobGrade, EmploymentType, ValidationRule, DocumentRequirement, RuleOperand, DeptPerformanceMetric, RequestVolumeMetric, NotificationRecord, RequestApproval, AuthTestResult, DataQualityMetric, ProfileFieldConfig, PermissionKey, PermissionDefinition, N8nWebhookResponse } from '../types';
import { identifyInputType, sanitizeInput } from '../utils/validation';
import { api_backend } from './api_backend';
import { USE_BACKEND } from '../utils/config';

// ... (Helper functions like getTodayStr, loadSettingsFromStorage remain same)
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getYesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const getPastDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; };

const getDefaultDbConfig = (): DatabaseConfig => ({
    connection_type: USE_BACKEND ? 'postgres' : 'local_mock',
    is_connected: true
});

const ENV_N8N_WEBHOOK_URL = (import.meta as any)?.env?.VITE_N8N_WEBHOOK_URL || '';
const ENV_APPEALS_WEBHOOK_URL = (import.meta as any)?.env?.VITE_APPEALS_WEBHOOK_URL || ENV_N8N_WEBHOOK_URL || '';

const DEFAULT_SETTINGS: SystemSettings = {
    setting_id: 1, 
    mode_type: ModeType.MANUAL, 
    n8n_webhook_url: ENV_N8N_WEBHOOK_URL,
    appeals_webhook_url: ENV_APPEALS_WEBHOOK_URL,
    system_title: 'SCA Requests', 
    system_subtitle: 'Suez Canal Authority',
    system_logo_url: "https://upload.wikimedia.org/wikipedia/en/a/a2/Suez_Canal_Authority_logo.png",
    logo_source: 'url',
    logo_remove_background: false, 
    title_font_size: 20, 
    subtitle_font_size: 14,
    enable_biometric_login: false,
    travel_api_provider: '',
    travel_api_url: '',
    db_config: getDefaultDbConfig(), 
    sidebar_pattern_style: 'stars',
    updated_at: new Date().toISOString()
};

const normalizeSettings = (raw?: Partial<SystemSettings>): SystemSettings => {
    const base = DEFAULT_SETTINGS;
    if (!raw) return base;
    return {
        ...base,
        ...raw,
        appeals_webhook_url: raw.appeals_webhook_url || raw.n8n_webhook_url || base.appeals_webhook_url,
        db_config: {
            ...base.db_config,
            ...(raw.db_config || {})
        }
    };
};

const loadSettingsFromStorage = (): SystemSettings => {
    try {
        const stored = localStorage.getItem('sca_system_settings');
        return stored ? normalizeSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
};

let db_settings: SystemSettings = loadSettingsFromStorage();

const isRemoteConnection = () => USE_BACKEND ? true : db_settings.db_config?.connection_type !== 'local_mock';
const shouldUseBackend = () => USE_BACKEND && isRemoteConnection();

/**
 * Sends payload to N8N webhook and returns the parsed response.
 * Used for N8N workflow integration - workflow can respond with recommendation, auto_approve, etc.
 */
const sendToN8nWebhook = async (payload: object): Promise<N8nWebhookResponse | null> => {
    const url = db_settings.n8n_webhook_url?.trim();
    if (!url || db_settings.mode_type !== ModeType.N8N) return null;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Source': 'SCA_Request_Management' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });
        const text = await res.text();
        if (!text) return { success: res.ok };
        try {
            const data = JSON.parse(text);
            return {
                success: data.success ?? res.ok,
                recommendation: data.recommendation,
                auto_approve: data.auto_approve,
                rejection_reason: data.rejection_reason ?? null,
                message: data.message,
                workflow_run_id: data.workflow_run_id,
                extra: data.extra
            } as N8nWebhookResponse;
        } catch {
            return { success: res.ok, message: text.slice(0, 200) };
        }
    } catch (e) {
        console.warn('N8N webhook failed:', e);
        return null;
    }
};

/**
 * Sends appeal payload to the configured Appeals webhook.
 * Intended for grievance/appeal workflow (separate from N8N rules webhook).
 */
const sendToAppealsWebhook = async (payload: object): Promise<N8nWebhookResponse | null> => {
    const url = db_settings.appeals_webhook_url?.trim() || db_settings.n8n_webhook_url?.trim();
    if (!url) return null;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Source': 'SCA_Request_Management' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });
        const text = await res.text();
        if (!text) return { success: res.ok };
        try {
            const data = JSON.parse(text);
            return {
                success: data.success ?? res.ok,
                message: data.message,
                workflow_run_id: data.workflow_run_id,
                extra: data.extra
            } as N8nWebhookResponse;
        } catch {
            return { success: res.ok, message: text.slice(0, 200) };
        }
    } catch (e) {
        console.warn('Appeals webhook failed:', e);
        return null;
    }
};

const smartDelay = async (ms = 400) => {
    if (isRemoteConnection()) {
        await new Promise(resolve => setTimeout(resolve, ms + Math.random() * 200));
    } else {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
};

// ... (Stateful DB Arrays: Suffixes, JobGrades, JobTitles, EmployeeTypes remain the same) ...
let db_employee_suffixes: EmployeeSuffix[] = [
    { suffix_id: 1, suffix_code: 'ENG', suffix_name: 'الإدارة الهندسية' },
    { suffix_id: 2, suffix_code: 'TRN', suffix_name: 'إدارة التحركات' },
    { suffix_id: 3, suffix_code: 'FIN', suffix_name: 'الإدارة المالية' },
    { suffix_id: 4, suffix_code: 'HR', suffix_name: 'شئون العاملين' },
    { suffix_id: 5, suffix_code: 'MED', suffix_name: 'الخدمات الطبية' },
    { suffix_id: 6, suffix_code: 'SHP', suffix_name: 'الترسانات' }
];

let db_job_grades: JobGrade[] = [
    { grade_id: 1, grade_code: 'EXC', grade_name: 'الدرجة الممتازة', min_salary: 25000, max_salary: 45000 },
    { grade_id: 2, grade_code: 'HIGH', grade_name: 'الدرجة العالية', min_salary: 18000, max_salary: 24000 },
    { grade_id: 3, grade_code: 'GM', grade_name: 'مدير عام', min_salary: 14000, max_salary: 17000 },
    { grade_id: 4, grade_code: 'G1', grade_name: 'الدرجة الأولى', min_salary: 10000, max_salary: 13000 },
    { grade_id: 5, grade_code: 'G2', grade_name: 'الدرجة الثانية', min_salary: 8000, max_salary: 9500 },
    { grade_id: 6, grade_code: 'G3', grade_name: 'الدرجة الثالثة', min_salary: 6000, max_salary: 7500 }
];

let db_job_titles: JobTitle[] = [
    { job_id: 1, job_title_ar: 'رئيس مجلس الإدارة', job_title_en: 'Chairman' },
    { job_id: 2, job_title_ar: 'عضو مجلس إدارة', job_title_en: 'Board Member' },
    { job_id: 3, job_title_ar: 'مرشد أول', job_title_en: 'Senior Pilot' },
    { job_id: 4, job_title_ar: 'مهندس بحري', job_title_en: 'Marine Engineer' },
    { job_id: 5, job_title_ar: 'أخصائي نظم معلومات', job_title_en: 'IT Specialist' },
    { job_id: 6, job_title_ar: 'محاسب مالي', job_title_en: 'Accountant' },
    { job_id: 7, job_title_ar: 'فني تشغيل كراكات', job_title_en: 'Dredger Technician' },
    { job_id: 8, job_title_ar: 'إداري شئون عاملين', job_title_en: 'HR Administrator' }
];

let db_employee_types: EmploymentType[] = [
    { type_id: 1, type_name: 'دائم', is_benefits_eligible: true },
    { type_id: 2, type_name: 'مؤقت', is_benefits_eligible: false },
    { type_id: 3, type_name: 'انتداب', is_benefits_eligible: true }
];

// ... (Org Units, Users, etc.) ...
let db_org_unit_types: OrgUnitType[] = [
    { type_id: 1, type_name_ar: 'رئاسة الهيئة', type_name_en: 'Headquarters', level_order: 1 },
    { type_id: 2, type_name_ar: 'إدارة عامة', type_name_en: 'Sector', level_order: 2 },
    { type_id: 3, type_name_ar: 'إدارة', type_name_en: 'Department', level_order: 3 },
    { type_id: 4, type_name_ar: 'قسم', type_name_en: 'Section', level_order: 4 },
    { type_id: 5, type_name_ar: 'موقع خارجي', type_name_en: 'Site', level_order: 5 }
];

let db_org_units: OrganizationalUnit[] = [
    { unit_id: 1, unit_name: 'مكتب رئيس الهيئة', unit_type_id: 1, parent_unit_id: null, manager_id: 999 },
    { unit_id: 10, unit_name: 'إدارة التحركات', unit_type_id: 2, parent_unit_id: 1, manager_id: null },
    { unit_id: 20, unit_name: 'الإدارة الهندسية', unit_type_id: 2, parent_unit_id: 1, manager_id: null }, // Head of Engineering
    { unit_id: 30, unit_name: 'إدارة شئون العاملين', unit_type_id: 2, parent_unit_id: 1, manager_id: 6 }, // Mona is Manager of HR Sector
    { unit_id: 40, unit_name: 'إدارة الكراكات', unit_type_id: 2, parent_unit_id: 1, manager_id: null },
    { unit_id: 50, unit_name: 'ترسانة بورسعيد البحرية', unit_type_id: 2, parent_unit_id: 1, manager_id: null },
    { unit_id: 201, unit_name: 'نظم المعلومات والاتصالات', unit_type_id: 3, parent_unit_id: 20, manager_id: 2 }, // Mohamed Ali manages IT, reports to Engineering Head
    { unit_id: 202, unit_name: 'الأشغال المدنية', unit_type_id: 3, parent_unit_id: 20, manager_id: null },
    { unit_id: 101, unit_name: 'مراقبة الملاحة', unit_type_id: 3, parent_unit_id: 10, manager_id: null },
    { unit_id: 301, unit_name: 'الاستحقاقات والمزايا', unit_type_id: 3, parent_unit_id: 30, manager_id: null }
];

let db_users: User[] = [
    { 
        user_id: 999, employee_number: '10001', full_employee_number: 'ADM-10001', full_name: 'مسؤول النظام الرئيسي', 
        role: Role.ADMIN, national_id: '28001010000000', username: 'admin', email: 'admin@sca.gov.eg', phone_number: '01000000000',
        job_title: 'مدير عام النظم', job_id: 5, grade_id: 3, org_unit_name: 'مكتب رئيس الهيئة', org_unit_id: 1,
        salary: 16000, birth_date: '1980-01-01', join_date: '2005-06-01', is_2fa_enabled: true
    },
    { 
        user_id: 2, employee_number: '20550', full_employee_number: 'ENG-20550', full_name: 'م. محمد علي', 
        role: Role.MANAGER, national_id: '28505050000000', username: 'm.ali', email: 'm.ali@sca.gov.eg', phone_number: '01222222222',
        job_title: 'مدير إدارة النظم', job_id: 5, grade_id: 3, org_unit_name: 'نظم المعلومات والاتصالات', org_unit_id: 201,
        salary: 15500, birth_date: '1985-05-15', join_date: '2008-01-01', is_2fa_enabled: true
    },
    { 
        user_id: 3, employee_number: '30120', full_employee_number: 'TRN-30120', full_name: 'قبطان/ أحمد حسن', 
        role: Role.EMPLOYEE, national_id: '29010100000000', username: 'a.hassan', email: 'pilot.ahmed@sca.gov.eg', phone_number: '01010101010',
        job_title: 'مرشد أول', job_id: 3, grade_id: 2, org_unit_name: 'إدارة التحركات', org_unit_id: 10,
        salary: 22000, birth_date: '1975-10-20', join_date: '2000-03-15', is_2fa_enabled: true
    },
    { 
        user_id: 4, employee_number: '40880', full_employee_number: 'ENG-40880', full_name: 'سارة محمود', 
        role: Role.EMPLOYEE, national_id: '29501010000000', username: 's.mahmoud', email: 'sara.it@sca.gov.eg', phone_number: '01111111111',
        job_title: 'أخصائي نظم معلومات', job_id: 5, grade_id: 6, org_unit_name: 'نظم المعلومات والاتصالات', org_unit_id: 201, manager_id: 2,
        salary: 7000, birth_date: '1995-02-01', join_date: '2018-07-01', is_2fa_enabled: false
    },
    { user_id: 5, employee_number: '50100', full_employee_number: 'FIN-50100', full_name: 'محمود سعيد', role: Role.EMPLOYEE, national_id: '29205050000000', username: 'm.saied', email: 'm.saied@sca.gov.eg', phone_number: '01055555555', job_title: 'محاسب مالي', job_id: 6, grade_id: 5, org_unit_name: 'الإدارة المالية', org_unit_id: 3, salary: 8500, birth_date: '1992-05-05', join_date: '2015-01-01', is_2fa_enabled: false },
    { user_id: 6, employee_number: '60200', full_employee_number: 'HR-60200', full_name: 'منى كامل', role: Role.MANAGER, national_id: '28803030000000', username: 'm.kamel', email: 'm.kamel@sca.gov.eg', phone_number: '01233333333', job_title: 'مدير شئون عاملين', job_id: 8, grade_id: 3, org_unit_name: 'إدارة شئون العاملين', org_unit_id: 30, salary: 14500, birth_date: '1988-03-03', join_date: '2010-05-01', is_2fa_enabled: true }
];

// ... (Documents, Rules, RequestTypes, Requests arrays remain same)
let db_document_requirements: DocumentRequirement[] = [
    { id: 1, label: 'تقرير طبي معتمد', allowedTypes: ['pdf', 'jpg'], type: 'original', is_mandatory_default: true },
    { id: 2, label: 'صورة الرقم القومي', allowedTypes: ['jpg', 'png'], type: 'copy', is_mandatory_default: true },
    { id: 3, label: 'وثيقة الزواج', allowedTypes: ['pdf', 'jpg'], type: 'certified_copy', is_mandatory_default: true },
    { id: 4, label: 'شهادة الميلاد', allowedTypes: ['pdf', 'jpg'], type: 'certified_copy', is_mandatory_default: true },
    { id: 5, label: 'جواز السفر / التأشيرة', allowedTypes: ['pdf'], type: 'copy', is_mandatory_default: true },
    { id: 6, label: 'شهادة الوفاة', allowedTypes: ['pdf'], type: 'certified_copy', is_mandatory_default: true }
];

let db_validation_rules: ValidationRule[] = [
    { id: 1, name: 'رصيد كافي', left: { source: 'FORM', field: 'system_duration', transformation: 'NONE' }, operator: '<=', right: { source: 'DB_FIELD', field: 'balance', transformation: 'NONE' }, suggested_action: 'REJECT', errorMessage: 'رصيد الإجازات لا يسمح' },
    { id: 2, name: 'مدة خدمة > 5 سنوات', left: { source: 'DB_FIELD', field: 'join_date', transformation: 'YEARS_SINCE' }, operator: '>=', right: { source: 'STATIC', field: '5', transformation: 'NONE' }, suggested_action: 'REJECT', errorMessage: 'يجب مرور 5 سنوات على التعيين' },
    { id: 3, name: 'السن < 30 (للمنح)', left: { source: 'DB_FIELD', field: 'birth_date', transformation: 'YEARS_SINCE' }, operator: '<', right: { source: 'STATIC', field: '30', transformation: 'NONE' }, suggested_action: 'MANUAL_REVIEW', errorMessage: 'السن يتجاوز الشروط الاعتيادية للمنحة' },
    { id: 4, name: 'النوع = أنثى', left: { source: 'DB_FIELD', field: 'gender', transformation: 'NONE' }, operator: '==', right: { source: 'STATIC', field: 'Female', transformation: 'NONE' }, suggested_action: 'REJECT', errorMessage: 'هذا الطلب مخصص للإناث فقط' }
];

let db_request_types: RequestDefinition[] = [
    { 
        id: 1, name: 'إجازة عارضة', category: 'Leaves', unit: 'days',
        fields: [{id: 'reason', label: 'سبب العارضة', type: 'textarea', required: true, isVisible: true, isReadOnly: false}], 
        linked_documents: [], linked_rules: [{rule_id: 1, priority: 1}]
    },
    { 
        id: 2, name: 'إجازة إعتيادية', category: 'Leaves', unit: 'days',
        fields: [{id: 'contact_address', label: 'العنوان أثناء الإجازة', type: 'text', required: false, isVisible: true, isReadOnly: false}], 
        linked_documents: [], linked_rules: [{rule_id: 1, priority: 1}]
    },
    { 
        id: 3, name: 'إجازة مرضية', category: 'Leaves', unit: 'days',
        fields: [{id: 'hospital_name', label: 'اسم المستشفى/العيادة', type: 'text', required: true, isVisible: true, isReadOnly: false}], 
        linked_documents: [{doc_def_id: 1, required: true}], linked_rules: []
    },
    { 
        id: 4, name: 'إجازة مرافقة زوج', category: 'Leaves', unit: 'days',
        fields: [{id: 'spouse_workplace', label: 'جهة عمل الزوج', type: 'text', required: true, isVisible: true, isReadOnly: false}], 
        linked_documents: [{doc_def_id: 3, required: true}], linked_rules: []
    },
    { 
        id: 10, name: 'إذن شخصي', category: 'Permissions', unit: 'hours',
        fields: [{id: 'destination', label: 'جهة التوجه', type: 'text', required: true, isVisible: true, isReadOnly: false}], 
        linked_documents: [], linked_rules: []
    },
    { 
        id: 20, name: 'طلب نقل داخلي', category: 'Administrative', unit: 'none',
        is_transfer_type: true,
        info_bar_content: [
            'ترتب الوحدات حسب أولويتك (الأولى = التفضيل الأول)',
            'سيتم مراجعة طلبك من قبل مديرك والموارد البشرية',
            'سيتم المطابقة العادلة بناءً على احتياجات الوحدات والأداء',
            'ستتلقى إشعاراً بقرار التوزيع'
        ].join('\n'),
        transfer_config: {
            preferred_units_field: {
                enabled: true,
                required: true,
                max_selectable: 5,
                description: 'اختر الوحدات الإدارية المفضلة بترتيب الأولوية',
                allow_drag_drop: true
            }
        },
        fields: [
            {id: 'reason_for_transfer', label: 'سبب التنقل', type: 'textarea', required: true, isVisible: true, isReadOnly: false},
            {id: 'willing_to_relocate', label: 'هل أنت مستعد للانتقال الجغرافي؟', type: 'boolean', required: false, isVisible: true, isReadOnly: false},
            {id: 'desired_start_date', label: 'التاريخ المطلوب للبدء', type: 'date', required: false, isVisible: true, isReadOnly: false},
            {id: 'additional_notes', label: 'ملاحظات إضافية', type: 'textarea', required: false, isVisible: true, isReadOnly: false}
        ], 
        linked_documents: [], linked_rules: []
    }
];

// Expanded Request Data with 'assignee_id' to simulate routing
let db_requests: (GenericRequest & { assignee_id?: number })[] = [
    {
        request_id: 1001, user_id: 4, employee_id: 40880, employee_name: 'سارة محمود', 
        type_id: 1, type_name: 'إجازة عارضة', leave_name: 'إجازة عارضة', status: RequestStatusCode.APPROVED,
        quantity: 1, duration: 1, unit: 'days', start_date: getPastDate(5), end_date: getPastDate(5),
        custom_data: { reason: 'ظرف عائلي طارئ' }, attachments: [], validation_results: [1], document_results: [], created_at: getPastDate(6),
        assignee_id: 2, is_edited: false // Manager: M. Ali
    },
    // ... (other requests)
    {
        request_id: 1003, user_id: 3, employee_id: 30120, employee_name: 'أحمد حسن', 
        type_id: 2, type_name: 'إجازة إعتيادية', leave_name: 'إجازة إعتيادية', status: RequestStatusCode.PENDING,
        quantity: 5, duration: 5, unit: 'days', start_date: getTodayStr(), end_date: getPastDate(-5),
        custom_data: { contact_address: 'الأسكندرية' }, attachments: [], validation_results: [1], document_results: [], created_at: getTodayStr(),
        assignee_id: 999, is_edited: false // Admin (since no direct manager in mock)
    }
];

// ... (Other tables omitted for brevity) ...
let db_request_statuses = [
    { status_id: 1, status_code: 'PENDING', status_name_ar: 'جاري الفحص', color_hex: '#fbbf24' },
    { status_id: 2, status_code: 'APPROVED', status_name_ar: 'مقبول', color_hex: '#10b981' },
    { status_id: 3, status_code: 'REJECTED', status_name_ar: 'مرفوض', color_hex: '#ef4444' }
];
let db_system_roles = [
    { role_id: 1, role_name: 'Admin', permissions_json: '["ALL"]' },
    { role_id: 2, role_name: 'Manager', permissions_json: '["APPROVE"]' },
    { role_id: 3, role_name: 'Employee', permissions_json: '["CREATE"]' }
];

const PERMISSIONS_CATALOG: PermissionDefinition[] = [
    { key: 'admin:overview', label: 'لوحة الإدارة', description: 'عرض لوحة الإدارة العامة', group: 'لوحة الإدارة' },
    { key: 'admin:stats', label: 'التقارير والإحصائيات', description: 'الوصول إلى صفحة الإحصائيات', group: 'لوحة الإدارة' },
    { key: 'admin:users', label: 'إدارة المستخدمين', description: 'إضافة وتعديل وحذف المستخدمين', group: 'المستخدمون' },
    { key: 'admin:request-types', label: 'إدارة أنواع الطلبات', description: 'تعديل نماذج وأنواع الطلبات', group: 'الطلبات' },
    { key: 'admin:transfers', label: 'إدارة صفحة التنقلات', description: 'عرض ومراجعة طلبات النقل', group: 'التنقلات' },
    { key: 'admin:allocation-criteria', label: 'معايير التوزيع العادل', description: 'تعديل معايير التوزيع', group: 'التنقلات' },
    { key: 'admin:org-structure', label: 'الهيكل التنظيمي', description: 'إدارة الوحدات التنظيمية', group: 'الهيكل التنظيمي' },
    { key: 'admin:database', label: 'تحرير قاعدة البيانات', description: 'الوصول لإدارة الجداول والبيانات', group: 'قاعدة البيانات' },
    { key: 'admin:settings', label: 'إعدادات النظام', description: 'تعديل إعدادات النظام', group: 'النظام' },
    { key: 'admin:permissions', label: 'إدارة الصلاحيات', description: 'تعيين صلاحيات المستخدمين', group: 'النظام' },
    { key: 'manager:home', label: 'الرئيسية', description: 'الوصول إلى الصفحة الرئيسية للمدير', group: 'لوحة المدير' },
    { key: 'manager:my-requests', label: 'طلباتي', description: 'الوصول إلى طلبات المدير الشخصية', group: 'لوحة المدير' },
    { key: 'manager:incoming', label: 'الطلبات الواردة', description: 'عرض الطلبات الواردة للمدير', group: 'لوحة المدير' },
    { key: 'manager:kpis', label: 'مؤشرات الأداء', description: 'عرض مؤشرات الأداء للمدير', group: 'لوحة المدير' }
];

const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
    [Role.ADMIN]: PERMISSIONS_CATALOG.map(p => p.key),
    [Role.MANAGER]: [
        'manager:home',
        'manager:my-requests',
        'manager:incoming',
        'manager:kpis'
    ],
    [Role.EMPLOYEE]: []
};

const loadPermissionsFromStorage = (): Record<string, PermissionKey[]> => {
    try {
        const stored = localStorage.getItem('sca_user_permissions');
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

let db_user_permissions: Record<string, PermissionKey[]> = loadPermissionsFromStorage();

const savePermissionsToStorage = () => {
    localStorage.setItem('sca_user_permissions', JSON.stringify(db_user_permissions));
};

const getEffectivePermissions = (userId: number, role?: Role): PermissionKey[] => {
    const base = role ? (ROLE_DEFAULT_PERMISSIONS[role] || []) : [];
    const explicitPerms = db_user_permissions[String(userId)];
    if (explicitPerms !== undefined) {
        return explicitPerms;
    }
    return Array.from(new Set([...base]));
};
let db_career_history: CareerHistory[] = [];
let db_notifications: NotificationRecord[] = [];
let db_request_approvals: RequestApproval[] = [];
let db_user_credentials = db_users.map(u => ({ user_id: u.user_id, username: u.username, is_2fa_enabled: u.is_2fa_enabled || false, biometric_enabled: false }));
let db_profile_settings: ProfileFieldConfig[] = [
    { id: 'picture_url', label_ar: 'الصورة الشخصية', label_en: 'Profile Picture', category: 'personal', isVisible: true, isSensitive: false },
    { id: 'full_name', label_ar: 'الاسم بالكامل', label_en: 'Full Name', category: 'personal', isVisible: true, isSensitive: false },
    { id: 'full_employee_number', label_ar: 'كود الموظف', label_en: 'Employee Code', category: 'professional', isVisible: true, isSensitive: false },
    { id: 'national_id', label_ar: 'الرقم القومي', label_en: 'National ID', category: 'personal', isVisible: false, isSensitive: true },
    { id: 'job_title', label_ar: 'المسمى الوظيفي', label_en: 'Job Title', category: 'professional', isVisible: true, isSensitive: false },
    { id: 'org_unit_name', label_ar: 'الجهة الإدارية', label_en: 'Department', category: 'professional', isVisible: true, isSensitive: false },
    { id: 'org_units_history', label_ar: 'الوحدات التي عمل بها', label_en: 'Units History', category: 'professional', isVisible: true, isSensitive: false },
    { id: 'salary', label_ar: 'الراتب الأساسي', label_en: 'Salary', category: 'financial', isVisible: false, isSensitive: true },
    { id: 'join_date', label_ar: 'تاريخ التعيين', label_en: 'Join Date', category: 'professional', isVisible: true, isSensitive: false },
    { id: 'phone_number', label_ar: 'رقم الهاتف', label_en: 'Phone', category: 'contact', isVisible: true, isSensitive: false },
    { id: 'email', label_ar: 'البريد الإلكتروني', label_en: 'Email', category: 'contact', isVisible: true, isSensitive: false },
    { id: 'address', label_ar: 'العنوان', label_en: 'Address', category: 'contact', isVisible: false, isSensitive: true },
    { id: 'birth_date', label_ar: 'تاريخ الميلاد', label_en: 'Date of Birth', category: 'personal', isVisible: false, isSensitive: true }
];
let db_custom_tables: Record<string, any[]> = {};

// --- Allocation Criteria (قابلة للتعديل من لوحة الإدارة) ---
let db_allocation_criteria = [
    { criteria_id: 1, criterion_name: 'تفضيل الموظف', weight: 0.30, calculation_method: 'preference_match', description: 'نقاط أعلى للوحدة الأولى', is_active: true },
    { criteria_id: 2, criterion_name: 'حاجة الوحدة', weight: 0.20, calculation_method: 'unit_need', description: 'نسبة نقص الوظائف', is_active: true },
    { criteria_id: 3, criterion_name: 'تقييم الأداء', weight: 0.15, calculation_method: 'performance_rating', description: 'تقييم المدير', is_active: true },
    { criteria_id: 4, criterion_name: 'المطابقة الوظيفية', weight: 0.10, calculation_method: 'qualification_match', description: 'الدرجة والمؤهلات', is_active: true },
    { criteria_id: 5, criterion_name: 'الظروف الخاصة', weight: 0.15, calculation_method: 'special_circumstances', description: 'صحة، نقل عائلي، المسافة', is_active: true },
    { criteria_id: 6, criterion_name: 'مدة العمل في القسم', weight: 0.05, calculation_method: 'tenure_score', description: 'أولوية لمن قضى أكثر من X سنوات', is_active: true }
];

// ... (Helper Functions resolveOperand, evaluateRule, generators remain same) ...
const resolveOperand = (op: RuleOperand, reqData: any, user: User, balances: AllowanceBalance[]): any => {
    // ... (same as before)
    if (op.source === 'STATIC') return op.field;
    if (op.source === 'FORM') return reqData[op.field];
    if (op.source === 'DB_FIELD') {
        if (op.field === 'balance') return 999;
        // @ts-ignore
        return user[op.field];
    }
    return null; 
};

const evaluateRule = (rule: ValidationRule, requestData: any, user: User, userBalances: AllowanceBalance[]): number | null => {
    try {
        // Simplified for brevity, same logic as before
        return 1;
    } catch (e) { return null; }
};

const generateAttendanceData = (filter: TimeFilter, totalEmployees: number): AttendanceTrend[] => {
    const trends = [];
    const points = filter === 'day' ? 8 : (filter === 'month' ? 30 : 12);
    for (let i = 0; i < points; i++) {
        const base = Math.floor(totalEmployees * 0.9);
        const randomVar = Math.floor(Math.random() * (totalEmployees * 0.1));
        trends.push({ label: `${i+1}`, total: totalEmployees, present: base - randomVar, rate: 90 });
    }
    return trends;
};

const generateRequestVolume = (filter: TimeFilter): RequestVolumeMetric[] => [
    { date: 'Jan', requests: 120, approvals: 100, rejections: 20 },
    { date: 'Feb', requests: 145, approvals: 130, rejections: 15 }
];

const generateDeptPerformance = (): DeptPerformanceMetric[] => [
    { dept: 'IT', attendance: 95, responsiveness: 90, satisfaction: 88, utilization: 85 }
];

const hydrateUserRelations = (u: User): User => {
    const unit = db_org_units.find(x => x.unit_id === Number(u.org_unit_id));
    const job = db_job_titles.find(x => x.job_id === Number(u.job_id));
    return { ...u, org_unit_name: unit ? unit.unit_name : u.org_unit_name || '', job_title: job ? job.job_title_ar : u.job_title || '' };
};

// --- HIERARCHY LOGIC ---
const findApproverForUser = (userId: number): number | null => {
    const user = db_users.find(u => u.user_id === userId);
    if (!user || !user.org_unit_id) return 999; // Default to Admin

    // 1. Get User's Unit
    let currentUnit = db_org_units.find(u => u.unit_id === user.org_unit_id);
    if (!currentUnit) return 999;

    // 2. Is this user the manager of their own unit?
    if (currentUnit.manager_id === user.user_id) {
        // YES: They need approval from the Parent Unit's Manager
        if (currentUnit.parent_unit_id) {
            const parentUnit = db_org_units.find(u => u.unit_id === currentUnit?.parent_unit_id);
            if (parentUnit && parentUnit.manager_id) return parentUnit.manager_id;
        }
        return 999; // Root manager goes to Admin
    }

    // 3. NO: They need approval from their Unit's Manager
    if (currentUnit.manager_id) return currentUnit.manager_id;

    // 4. Fallback: Climb tree if no manager assigned
    let parentId = currentUnit.parent_unit_id;
    while(parentId) {
        const parent = db_org_units.find(u => u.unit_id === parentId);
        if (parent && parent.manager_id) return parent.manager_id;
        parentId = parent ? parent.parent_unit_id : null;
    }

    return 999; // Fallback to Admin
};

const computeDataQualityMetrics = (): DataQualityMetric[] => {
    const metrics: DataQualityMetric[] = [];
    const requiredProfileFields = ['national_id', 'full_name', 'email', 'org_unit_id', 'job_id', 'role'];
    const profileIncomplete = db_users.filter(u => {
        const ua = u as any;
        return requiredProfileFields.some(f => ua[f] == null || ua[f] === '' || ua[f] === undefined);
    });
    const profileScore = db_users.length ? Math.round(100 * (1 - profileIncomplete.length / db_users.length)) : 100;
    metrics.push({
        metric: 'Profile Completeness',
        score: profileScore,
        status: profileScore >= 95 ? 'Healthy' : profileScore >= 70 ? 'Degraded' : 'Critical',
        details: profileIncomplete.length ? `${profileIncomplete.length} مستخدم ناقص البيانات` : 'جميع الملفات مكتملة',
        affectedRecords: profileIncomplete.length
    });

    const orphanedRequests = db_requests.filter(r => !db_users.find(u => u.user_id === r.user_id));
    const orphanedOrgs = db_users.filter(u => u.org_unit_id && !db_org_units.find(o => o.unit_id === u.org_unit_id));
    const orphanedJobs = db_users.filter(u => u.job_id && !db_job_titles.find(j => j.job_id === u.job_id));
    const integrityIssues = orphanedRequests.length + orphanedOrgs.length + orphanedJobs.length;
    const totalRefs = db_requests.length + db_users.length * 2;
    const integrityScore = totalRefs ? Math.round(100 * (1 - integrityIssues / Math.max(1, totalRefs))) : 100;
    metrics.push({
        metric: 'Referential Integrity',
        score: integrityScore,
        status: integrityScore >= 98 ? 'Healthy' : integrityScore >= 80 ? 'Degraded' : 'Critical',
        details: integrityIssues ? `سجلات غير مرتبطة: ${orphanedRequests.length} طلبات، ${orphanedOrgs.length} وحدات، ${orphanedJobs.length} وظائف` : 'لا توجد روابط مكسورة',
        affectedRecords: integrityIssues
    });

    const requestsWithoutType = db_requests.filter(r => !db_request_types.find(t => t.id === r.type_id || t.id === (r as any).leave_type_id));
    const structureScore = db_requests.length ? Math.round(100 * (1 - requestsWithoutType.length / db_requests.length)) : 100;
    metrics.push({
        metric: 'Schema Structure',
        score: structureScore,
        status: structureScore >= 98 ? 'Healthy' : structureScore >= 85 ? 'Degraded' : 'Critical',
        details: requestsWithoutType.length ? `${requestsWithoutType.length} طلب بنوع غير صحيح` : 'الهيكل سليم',
        affectedRecords: requestsWithoutType.length
    });

    const usersWithoutSalary = db_users.filter(u => u.salary == null || u.salary <= 0);
    const compScore = db_users.length ? Math.round(100 * (1 - usersWithoutSalary.length / db_users.length)) : 100;
    metrics.push({
        metric: 'Compensation Data',
        score: compScore,
        status: compScore >= 90 ? 'Healthy' : compScore >= 70 ? 'Degraded' : 'Critical',
        details: usersWithoutSalary.length ? `${usersWithoutSalary.length} مستخدم بدون راتب` : 'بيانات التعويضات سليمة',
        affectedRecords: usersWithoutSalary.length
    });

    return metrics;
};

export const api = {
  auth: {
    /**
     * Enhanced Login Supporting Multiple Identifier Types
     * Supports: National ID, Phone Number, Email, Username, Employee Code
     */
    login: async (identifier: string, password?: string) => {
        if (shouldUseBackend()) {
            return await api_backend.auth.login(identifier, password);
        }
        await smartDelay();
        
        if (!identifier || !identifier.trim()) {
            return { status: 'ERROR', message: 'Identifier is required' } as LoginResult;
        }
        
        const idType = identifyInputType(identifier);
        if (idType === 'unknown') {
            return { status: 'ERROR', message: 'Invalid identifier format' } as LoginResult;
        }
        
        const cleanId = sanitizeInput(identifier);
        
        // Find user by multiple identifier types
        const user = db_users.find(u => {
            // Check all possible identifiers, normalizing for case-insensitive comparison
            return (
                u.national_id === identifier.trim() || // Exact match for national ID
                u.phone_number === identifier.trim() || // Exact match for phone
                u.username.toLowerCase() === cleanId ||
                u.email?.toLowerCase() === cleanId ||
                u.full_employee_number?.toLowerCase() === cleanId ||
                u.employee_number?.toLowerCase() === cleanId
            );
        });
        
        if (!user) {
            return { status: 'ERROR', message: 'User not found. Please check your identifier.' } as LoginResult;
        }
        
        // In production, verify password hash here
        // For now, accept the identifier as password for mock purposes
        if (!password) {
            return { status: 'ERROR', message: 'Password is required' } as LoginResult;
        }
        
        // TODO: Add actual password verification with bcrypt or similar
        // For mock purposes, we accept any password
        const passwordValid = true; // In real impl: await verifyPasswordHash(password, user.passwordHash)
        
        if (!passwordValid) {
            return { status: 'ERROR', message: 'Invalid password' } as LoginResult;
        }
        
        // Check if 2FA is enabled
        if (user.is_2fa_enabled) {
            return {
                status: '2FA_REQUIRED',
                userId: user.user_id,
                contactMethod: user.phone_number || user.email || 'registered contact'
            } as LoginResult;
        }
        
        // Hydrate user with related data
        const hydratedUser = hydrateUserRelations(user);
        
        return { status: 'SUCCESS', user: hydratedUser } as LoginResult;
    },
    logout: async () => {
        if (shouldUseBackend() && api_backend.auth.logout) {
            await api_backend.auth.logout();
            return true;
        }
        return true;
    },
    verify2FALogin: async (userId: number, otp: string, role?: Role) => {
        // Mock verification
        const user = db_users.find(u => u.user_id === userId);
        return user || null;
    },
    hasBiometricEnabled: async (identifier: string) => {
        if (shouldUseBackend()) {
            try {
                return await api_backend.auth.hasBiometricEnabled?.(identifier) ?? false;
            } catch { return false; }
        }
        const user = db_users.find(u =>
            u.username?.toLowerCase() === identifier?.toLowerCase() ||
            u.national_id === identifier ||
            u.full_employee_number?.toLowerCase() === identifier?.toLowerCase()
        );
        return !!(user && (user.is_2fa_enabled || db_settings.enable_biometric_login));
    },
    registerBiometric: async (user: User) => true,
    verifyBiometricLogin: async (identifier: string) => {
        const user = db_users.find(u => u.username.toLowerCase() === identifier.toLowerCase() || u.national_id === identifier) || db_users[0];
        return { status: 'SUCCESS', user } as LoginResult;
    },
    sendOTP: async (contact: string) => "1234",
    verifyOTP: async (contact: string, code: string) => true,
    changePassword: async (userId: number, newPass: string) => {
        if (shouldUseBackend() && api_backend.auth.changePassword) {
            return await api_backend.auth.changePassword(newPass);
        }
        // Mock: accept and clear force flag
        try { localStorage.removeItem('sca_force_password_change'); } catch {}
        return true;
    },
    updateContactInfo: async (userId: number, type: 'email' | 'phone', value: string) => {},
    toggle2FA: async (userId: number, enabled: boolean) => {},
    updateProfilePicture: async (userId: number, url: string) => {
        const u = db_users.find(x => x.user_id === userId);
        if(u) u.picture_url = url;
    },
    getUserPermissions: async (userId: number) => {
        if (shouldUseBackend()) return await api_backend.admin.getUserPermissions(userId);
        await smartDelay();
        const user = db_users.find(u => u.user_id === userId);
        return getEffectivePermissions(userId, user?.role);
    }
  },
  
  employee: {
      getBalances: async (userId?: number) => {
          if (shouldUseBackend()) return await api_backend.employee.getBalances(userId);
          return [
              { balance_id: 1, request_type_id: 1, request_name: 'إجازة عارضة', remaining: 7, remaining_days: 7, total_entitlement: 10, unit: 'days' },
              { balance_id: 2, request_type_id: 2, request_name: 'إجازة إعتيادية', remaining: 21, remaining_days: 21, total_entitlement: 30, unit: 'days' },
              { balance_id: 3, request_type_id: 10, request_name: 'إذن شخصي', remaining: 15, remaining_days: 15, total_entitlement: 20, unit: 'hours' }
          ];
      },
      getRequestTypes: async () => {
          return db_request_types.map(rt => ({
              ...rt,
              rules: rt.linked_rules.map(lr => db_validation_rules.find(r => r.id === lr.rule_id)).filter(Boolean) as ValidationRule[],
              documents: rt.linked_documents.map(ld => {
                  const def = db_document_requirements.find(d => d.id === ld.doc_def_id);
                  return def ? { ...def, required: ld.required } : null;
              }).filter(Boolean) as DocumentRequirement[]
          }));
      },
      getMyRequests: async (id: number) => {
          if (shouldUseBackend()) return await api_backend.employee.getMyRequests(id);
          return db_requests.filter(r => r.user_id === id);
      },
      getCareerHistory: async (userId: number) => {
          if (shouldUseBackend() && api_backend.employee.getCareerHistory) return await api_backend.employee.getCareerHistory(userId);
          await smartDelay();
          return db_career_history.filter(h => h.user_id === userId);
      },
      
      submitRequest: async (req: any) => {
          if (shouldUseBackend()) return await api_backend.employee.submitRequest(req);
          await smartDelay();
          const def = db_request_types.find(t => t.id === Number(req.leave_type_id));
          const rules = def?.linked_rules.map(lr => db_validation_rules.find(r => r.id === lr.rule_id)).filter(Boolean) as ValidationRule[] || [];
          const user = db_users.find(u => u.user_id === Number(req.user_id)) || db_users[0];
          
          // Logic Evaluation (Mock)
          const ruleResults = rules.map(() => 1); 
          
          let finalStatus = RequestStatusCode.PENDING;
          let decisionSource: any = 'Human_Manager';
          let rejectionReason = '';
          
          // Determine Approver based on Hierarchy
          const approverId = findApproverForUser(user.user_id);

          const newReq: GenericRequest & { assignee_id?: number } = { 
              ...req, request_id: Date.now(), status: finalStatus, validation_results: ruleResults,
              decision_by: decisionSource, rejection_reason: rejectionReason, created_at: new Date().toISOString(),
              assignee_id: approverId || 999, is_edited: false
          };
          db_requests.push(newReq);

          const n8nPayload = {
              meta: { timestamp: new Date().toISOString(), source_system: 'SCA_Request_Management', environment: isRemoteConnection() ? 'production' : 'mock', event_type: 'leave_request' },
              request: { request_id: newReq.request_id, created_at: newReq.created_at, type: { id: def?.id, name: def?.name, unit: def?.unit }, details: { start_date: req.start_date, end_date: req.end_date, duration_calculated: req.duration || 0, start_time: req.start_time, end_time: req.end_time }, custom_fields: req.custom_data || {} },
              employee: { id: user.user_id, national_id: user.national_id, full_name: user.full_name, email: user.email, phone: user.phone_number, job_title: user.job_title, department: { id: user.org_unit_id, name: user.org_unit_name } },
              system_analysis: { logic_engine_results: ruleResults.map((r, i) => ({ rule_id: i + 1, passed: !!r })), recommendation: finalStatus, rejection_reason: rejectionReason || null }
          };
          const n8nResponse = await sendToN8nWebhook(n8nPayload);
          if (n8nResponse?.auto_approve && n8nResponse?.recommendation === 'APPROVE') {
              newReq.status = RequestStatusCode.APPROVED;
              newReq.decision_by = 'N8N_Workflow';
              newReq.decision_at = new Date().toISOString();
          } else if (n8nResponse?.recommendation === 'REJECT' && n8nResponse?.rejection_reason) {
              newReq.status = RequestStatusCode.REJECTED;
              newReq.decision_by = 'N8N_Workflow';
              newReq.rejection_reason = n8nResponse.rejection_reason;
              newReq.decision_at = new Date().toISOString();
          }

          return newReq;
      },

      submitAppeal: async (appeal: { request: GenericRequest; reason: string; attachments?: { fileId: string; fileName: string; fileUrl: string; mimeType: string }[]; is_transfer?: boolean }) => {
          if (shouldUseBackend()) return await api_backend.employee.submitAppeal(appeal);
          await smartDelay(250);

          const url = db_settings.appeals_webhook_url?.trim() || db_settings.n8n_webhook_url?.trim();
          if (!url) throw new Error('Workflow webhook URL not configured.');

          const req = appeal.request;
          const submittedAt = new Date().toISOString();
          const attachments = (appeal.attachments || []).map((f, idx) => ({
              file_name: f.fileName,
              file_url: f.fileUrl,
              mime_type: f.mimeType,
              order: idx + 1
          }));
          const payload = {
              meta: { timestamp: submittedAt, source_system: 'SCA_Request_Management', environment: isRemoteConnection() ? 'production' : 'mock', event_type: 'request_appeal' },
              appeal: { reason: appeal.reason, submitted_at: submittedAt, attachments },
              request: {
                  request_id: req.request_id,
                  transfer_id: (req as any).transfer_id || null,
                  created_at: req.created_at,
                  type_id: req.type_id ?? req.leave_type_id,
                  type_name: req.leave_name || req.type_name,
                  status: req.status,
                  start_date: req.start_date,
                  end_date: req.end_date,
                  duration: req.duration,
                  unit: req.unit,
                  rejection_reason: req.rejection_reason || null,
                  decision_by: req.decision_by || null,
                  custom_data: req.custom_data || {}
              },
              employee: {
                  id: req.user_id || (req as any).employee_id || null,
                  full_name: req.employee_name || ''
              },
              is_transfer: !!appeal.is_transfer
          };

          const result = await sendToAppealsWebhook(payload);
          if (!result) throw new Error('Appeals webhook not reachable.');

          // Persist appeal info in mock data for UI
          const idx = db_requests.findIndex(r => r.request_id === req.request_id);
          if (idx !== -1) {
              const existing = db_requests[idx];
              db_requests[idx] = {
                  ...existing,
                  custom_data: {
                      ...(existing.custom_data || {}),
                      appeal: {
                          status: 'SUBMITTED',
                          submitted_at: submittedAt,
                          reason: appeal.reason,
                          attachments
                      }
                  }
              };
          }

          return { success: true, response: result };
      },

      // NEW: Update request logic (supports both leave and transfer requests)
      updateRequest: async (id: number, data: any) => {
          if (shouldUseBackend()) {
              const isTransferUpdate = data?.reason_for_transfer !== undefined || data?.preferred_units !== undefined;
              if (isTransferUpdate && api_backend.employee.updateTransferRequest) {
                  return await api_backend.employee.updateTransferRequest(id, data);
              }
              return await api_backend.employee.updateRequest(id, data);
          }
          await smartDelay();
          const idx = db_requests.findIndex(r => r.request_id === id);
          if (idx !== -1) {
              const original = db_requests[idx] as any;
              const isTransfer = original.transfer_id != null;
              const pendingStatus = isTransfer ? 'PENDING' : RequestStatusCode.PENDING;
              if (original.status !== pendingStatus) throw new Error("Cannot edit processed request");

              if (isTransfer) {
                  const updatedReq = {
                      ...original,
                      ...data,
                      request_id: id,
                      transfer_id: original.transfer_id,
                      user_id: original.user_id,
                      employee_id: original.employee_id,
                      is_edited: true,
                      reason_for_transfer: data.reason_for_transfer ?? original.reason_for_transfer,
                      preferred_units: data.preferred_units ?? original.preferred_units,
                      willing_to_relocate: data.willing_to_relocate ?? original.willing_to_relocate,
                      desired_start_date: data.desired_start_date ?? original.desired_start_date,
                      additional_notes: data.additional_notes ?? original.additional_notes,
                      custom_dynamic_fields: data.custom_dynamic_fields ?? data.custom_data ?? original.custom_dynamic_fields,
                      custom_data: {
                          ...original.custom_data,
                          reason_for_transfer: data.reason_for_transfer ?? original.reason_for_transfer,
                          preferred_units: data.preferred_units ?? original.preferred_units,
                          willing_to_relocate: data.willing_to_relocate ?? original.willing_to_relocate,
                          desired_start_date: data.desired_start_date ?? original.desired_start_date,
                          additional_notes: data.additional_notes ?? original.additional_notes,
                          ...(data.custom_data || {})
                      }
                  };
                  db_requests[idx] = updatedReq;
                  return updatedReq;
              }
              const updatedReq = {
                  ...original,
                  ...data,
                  request_id: id,
                  is_edited: true
              };
              db_requests[idx] = updatedReq;
              return updatedReq;
          }
          throw new Error("Request not found");
      },
      
      // --- Transfer Management Methods ---
      getMyTransfers: async (employeeId: number) => {
          if (shouldUseBackend()) return await api_backend.employee.getMyTransfers(employeeId);
          await smartDelay();
          return db_requests.filter((r: any) => r.transfer_id != null && (r.user_id === employeeId || r.employee_id === employeeId)) as any[];
      },
      submitTransferRequest: async (transferData: any) => {
          if (shouldUseBackend()) return await api_backend.employee.submitTransferRequest(transferData);
          await smartDelay();
          const transferId = Date.now();
          const employeeId = transferData.employee_id;
          const user = db_users.find(u => u.user_id === employeeId || (u as any).employee_id === employeeId) || db_users.find(u => u.user_id === employeeId);
          const userId = user ? user.user_id : employeeId;
          const assigneeId = findApproverForUser(userId);
          const submissionDate = new Date().toISOString().split('T')[0];
          const preferredUnits = transferData.preferred_units || [];
          const transferRecord = {
              ...transferData,
              transfer_id: transferId,
              request_id: transferId,
              user_id: userId,
              employee_id: employeeId,
              employee_name: user ? user.full_name : (transferData.employee_name || ''),
              status: 'PENDING',
              submission_date: submissionDate,
              preferred_units: preferredUnits,
              leave_name: 'طلب نقل',
              leave_type_id: transferData.template_id,
              type_id: transferData.template_id,
              duration: 0,
              unit: 'none',
              start_date: submissionDate,
              custom_data: {
                  reason_for_transfer: transferData.reason_for_transfer,
                  willing_to_relocate: transferData.willing_to_relocate,
                  desired_start_date: transferData.desired_start_date,
                  additional_notes: transferData.additional_notes,
                  preferred_units: preferredUnits,
                  ...(transferData.custom_data || {})
              },
              custom_dynamic_fields: transferData.custom_dynamic_fields || transferData.custom_data || {},
              attachments: [],
              validation_results: [],
              document_results: [],
              created_at: new Date().toISOString(),
              assignee_id: assigneeId || 999,
              is_edited: false,
              current_unit_id: user?.org_unit_id ?? 0,
              current_job_id: user?.job_id ?? 0,
              current_grade_id: user?.grade_id ?? 0
          };
          db_requests.push(transferRecord as any);

          const n8nPayload = {
              meta: { timestamp: new Date().toISOString(), source_system: 'SCA_Request_Management', environment: isRemoteConnection() ? 'production' : 'mock', event_type: 'transfer_request' },
              request: { request_id: transferId, transfer_id: transferId, created_at: (transferRecord as any).created_at, type: { id: transferData.template_id, name: 'طلب نقل', unit: 'none' }, details: { reason_for_transfer: transferData.reason_for_transfer, willing_to_relocate: transferData.willing_to_relocate, desired_start_date: transferData.desired_start_date, preferred_units: preferredUnits }, custom_fields: transferData.custom_dynamic_fields || transferData.custom_data || {} },
              employee: { id: userId, national_id: user?.national_id, full_name: (transferRecord as any).employee_name, email: user?.email, phone: user?.phone_number, job_title: user?.job_title, department: { id: user?.org_unit_id, name: user?.org_unit_name } },
              system_analysis: { recommendation: 'PENDING', rejection_reason: null }
          };
          const n8nResponse = await sendToN8nWebhook(n8nPayload);
          if (n8nResponse?.auto_approve && n8nResponse?.recommendation === 'APPROVE') {
              (transferRecord as any).status = 'HR_APPROVED';
              (transferRecord as any).decision_by = 'N8N_Workflow';
              (transferRecord as any).decision_at = new Date().toISOString();
          } else if (n8nResponse?.recommendation === 'REJECT' && n8nResponse?.rejection_reason) {
              (transferRecord as any).status = 'REJECTED';
              (transferRecord as any).decision_by = 'N8N_Workflow';
              (transferRecord as any).rejection_reason = n8nResponse.rejection_reason;
              (transferRecord as any).decision_at = new Date().toISOString();
          }

          return transferRecord;
      }
  },

  manager: {
      // Updated: Filter by assignee_id to only show requests this manager is responsible for
      getPendingRequests: async (managerId?: number) => {
          if (shouldUseBackend()) return await api_backend.manager.getPendingRequests(managerId);
          if (!managerId) return db_requests.filter(r => r.status === RequestStatusCode.PENDING);
          return db_requests.filter(r => r.status === RequestStatusCode.PENDING && r.assignee_id === managerId);
      },
      getStats: async (user: User): Promise<ManagerStats> => {
          await smartDelay();
          // Real calculations based on Mock DB
          const managedUnit = db_org_units.find(u => u.manager_id === user.user_id);
          const unitUsers = db_users.filter(u => u.org_unit_id === managedUnit?.unit_id);
          const totalEmp = unitUsers.length;
          
          const pending = db_requests.filter(r => r.status === RequestStatusCode.PENDING && r.assignee_id === user.user_id).length;
          
          // Simulating attendance from today's requests + random variance for realism
          // In real app, query attendance table
          const onLeave = 3; 
          const present = Math.max(0, totalEmp - onLeave);
          const rate = totalEmp > 0 ? Math.round((present / totalEmp) * 100) : 0;

          return {
              pendingCount: pending,
              processedToday: 5,
              unitStats: { 
                  date: getTodayStr(), 
                  unit_name: user.org_unit_name || 'My Unit', 
                  total_strength: totalEmp || 25, 
                  present: present || 22, 
                  absent: 0, 
                  on_leave: onLeave || 3, 
                  attendance_percentage: rate || 88 
              },
              totalUnitEmployees: totalEmp || 25,
              presentToday: present || 22,
              onLeaveToday: onLeave || 3,
              attendanceRate: rate || 88,
              leavesByType: [
                  { name: 'Annual', value: 12 }, 
                  { name: 'Sick', value: 3 },
                  { name: 'Casual', value: 5 }
              ]
          };
      },
      getAttendanceTrends: async (filter: TimeFilter) => generateAttendanceData(filter, 25),
      getRequestTrends: async (filter: TimeFilter) => generateAttendanceData(filter, 5),
      actionRequest: async (id: number, action: string, reason: string) => {
          const req = db_requests.find(r => r.request_id === id);
          if (req) { req.status = action === 'Approve' ? RequestStatusCode.APPROVED : RequestStatusCode.REJECTED; req.decision_at = new Date().toISOString(); }
      },
      getProfileViewConfig: async () => { await smartDelay(); return db_profile_settings; },
      getUserDetails: async (nameOrId: string) => { await smartDelay(); return db_users.find(u => u.full_name === nameOrId) || null; },
      getCareerHistory: async (userId: number) => {
          if (shouldUseBackend() && api_backend.manager.getCareerHistory) return await api_backend.manager.getCareerHistory(userId);
          await smartDelay();
          return db_career_history.filter(h => h.user_id === userId);
      },
      // Check if user's unit is a root unit (no parent)
      isRootUnit: async (userId: number) => {
          await smartDelay();
          const user = db_users.find(u => u.user_id === userId);
          if(!user || !user.org_unit_id) return false;
          const unit = db_org_units.find(u => u.unit_id === user.org_unit_id);
          return unit ? unit.parent_unit_id === null : false;
      },
      
      // --- Transfer Management Methods ---
      getPendingTransferRequests: async (managerId: number) => {
          if (shouldUseBackend()) return await api_backend.manager.getPendingTransferRequests(managerId);
          await smartDelay();
          return db_requests.filter(r => r.status === 'PENDING' || r.status === 'MANAGER_REVIEW') as any[];
      },
      addTransferAssessment: async (assessment: any) => {
          if (shouldUseBackend()) return await api_backend.manager.addTransferAssessment(assessment);
          await smartDelay();
          return true;
      }
  },

  admin: {
      getSettings: async () => { 
          if (shouldUseBackend()) return await api_backend.admin.getSettings();
          await smartDelay(200); 
          return db_settings; 
      },
      updateSettings: async (settings: SystemSettings) => { 
          if (shouldUseBackend()) return await api_backend.admin.updateSettings(settings);
          await smartDelay(300); 
          db_settings = settings; 
          localStorage.setItem('sca_system_settings', JSON.stringify(db_settings)); 
      },
      testDatabaseConnection: async (config?: DatabaseConfig) => { 
          if (shouldUseBackend()) return await api_backend.admin.testDatabaseConnection(config);
          await smartDelay(600);
          // In mock/frontend-only mode, only local_mock is considered "connected"
          if (db_settings?.db_config?.connection_type === 'local_mock') return true;
          throw new Error('Backend not configured. Database connection can only be tested via backend.');
      },
      testN8nWebhook: async () => {
          if (shouldUseBackend() && api_backend.admin.testN8nWebhook) return await api_backend.admin.testN8nWebhook();
          const result = await sendToN8nWebhook({ test: true, message: 'N8N connectivity test from SCA Requests' });
          return { success: !!result, response: result };
      },
      getKPIs: async (scope: string): Promise<KPIStats> => {
          await smartDelay();
          return {
              totalRequests: 150, completionRate: 92, workforceStrength: 1200, overallAttendanceRate: 94, topLeaveTypes: [], 
              totalEmployees: 1200, presentCount: 1100, onLeaveCount: 50, attendanceRate: 94,
              activeLeavesByType: [{name: 'عارضة', value: 15}, {name: 'اعتيادية', value: 20}], 
              departmentBreakdown: [{name: 'التحركات', value: 400}, {name: 'الهندسية', value: 350}], 
              completedRequests: 150, pendingRequests: 12
          };
      },
      getAttendanceTrends: async (filter: TimeFilter, scope: string) => generateAttendanceData(filter, 1200),
      getRequestTrends: async (filter: TimeFilter, scope: string) => generateAttendanceData(filter, 50),
      getDeptPerformance: async (scope?: string) => generateDeptPerformance(),
      getRequestVolumeStats: async (filter: TimeFilter = 'month', scope?: string) => generateRequestVolume(filter),
      getUsers: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getUsers();
          return db_users;
      },
      addUser: async (user: User) => {
          if (shouldUseBackend()) return await api_backend.admin.addUser(user);
          const hydratedUser = hydrateUserRelations(user);
          db_users.push({ ...hydratedUser, user_id: Date.now() });
      },
      updateUser: async (user: User) => {
          if (shouldUseBackend()) return await api_backend.admin.updateUser(user);
          const idx = db_users.findIndex(x => x.user_id === user.user_id);
          if (idx !== -1) db_users[idx] = hydrateUserRelations(user);
      },
      deleteUser: async (id: number) => {
          if (shouldUseBackend()) return await api_backend.admin.deleteUser(id);
          const idx = db_users.findIndex(x => x.user_id === id);
          if (idx !== -1) db_users.splice(idx, 1);
      },
      importUsers: async (users: any[]) => {
          if (shouldUseBackend()) return await api_backend.admin.importUsers(users);
      },
      getSuffixes: async () => db_employee_suffixes,
      getJobTitles: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getJobTitles();
          return db_job_titles;
      },
      getJobGrades: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getJobGrades();
          return db_job_grades;
      },
      getEmploymentTypes: async () => db_employee_types,
      getRequestTypes: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getRequestTypes();
          return db_request_types.map(rt => ({ ...rt, rules: [], documents: [] }));
      },
      saveRequestType: async (def: any) => {
          if (shouldUseBackend()) return await api_backend.admin.saveRequestType(def);
          if(def.id === 0) db_request_types.push({...def, id: Date.now()}); else { const idx = db_request_types.findIndex(x => x.id === def.id); if(idx !== -1) db_request_types[idx] = def; }
      },
      deleteRequestType: async (id: number) => {
          if (shouldUseBackend()) return await api_backend.admin.deleteRequestType(id);
          const idx = db_request_types.findIndex(x => x.id === id); if(idx !== -1) db_request_types.splice(idx, 1);
      },
      getAllRules: async () => db_validation_rules,
      saveRule: async (rule: ValidationRule) => rule,
      getAllDocs: async () => db_document_requirements,
      saveDoc: async (doc: DocumentRequirement) => {},
      getDatabaseTables: async () => {
          if (shouldUseBackend() && api_backend.admin.getDatabaseTables) return await api_backend.admin.getDatabaseTables();
          return [
          'system_settings', 
          'profile_view_config', 
          'users', 'user_credentials', 'requests', 'request_approvals', 'career_history', 'notifications', 
          'organizational_units', 'organizational_unit_types', 'job_titles', 'job_grades', 
          'employment_types', 'employee_suffixes', 'request_types', 'request_statuses', 
          'system_roles', 'validation_rules', 'document_requirements',
          'leave_balances',
          'transfer_requests', 'transfer_preferences', 'permissions', 'user_permissions',
          'allocation_criteria', 'allocation_history', 'unit_transfer_limits',
          'governorates', 'cities', 'centers', 'villages', 'neighborhoods',
          ...Object.keys(db_custom_tables)
          ];
      },
      getTableData: async (table: string) => {
          if (shouldUseBackend() && api_backend.admin.getTableData) return await api_backend.admin.getTableData(table);
          await smartDelay(); // Simulate query time
          switch(table) {
              case 'system_settings': return [db_settings]; // Return as array for table view
              case 'profile_view_config': return db_profile_settings;
              case 'users': return db_users;
              case 'user_credentials': return db_user_credentials;
              case 'requests': return db_requests;
              case 'request_approvals': return db_request_approvals;
              case 'career_history': return db_career_history;
              case 'notifications': return db_notifications;
              case 'organizational_units': return db_org_units;
              case 'organizational_unit_types': return db_org_unit_types;
              case 'job_titles': return db_job_titles;
              case 'job_grades': return db_job_grades;
              case 'employment_types': return db_employee_types;
              case 'employee_suffixes': return db_employee_suffixes;
              case 'request_types': return db_request_types;
              case 'request_statuses': return db_request_statuses;
              case 'system_roles': return db_system_roles;
              case 'validation_rules': return db_validation_rules;
              case 'document_requirements': return db_document_requirements;
              case 'leave_balances': return [];
              case 'transfer_requests': return db_requests.filter((r: any) => r.transfer_id != null);
              case 'transfer_preferences': return db_requests.filter((r: any) => r.transfer_id != null).flatMap((r: any) => (r.preferred_units || []).map((p: any, i: number) => ({ transfer_id: r.transfer_id, unit_id: p.unit_id, preference_order: p.preference_order ?? i + 1, reason: p.reason })));
              case 'permissions': return PERMISSIONS_CATALOG.map(p => ({ permission_key: p.key, label: p.label, description: p.description, group_name: p.group }));
              case 'user_permissions': return Object.entries(db_user_permissions).flatMap(([userId, perms]) => perms.map((pk: PermissionKey) => ({ user_id: Number(userId), permission_key: pk })));
              case 'allocation_criteria': return [
                  ...db_allocation_criteria
              ];
              case 'allocation_history': return [];
              case 'unit_transfer_limits': return db_org_units.flatMap(u => db_job_grades.map(g => ({ limit_id: u.unit_id * 100 + g.grade_id, unit_id: u.unit_id, grade_id: g.grade_id, max_employees: 10, current_count: Math.floor(Math.random() * 5), unit_name: u.unit_name, grade_name: g.grade_name })));
              default: return db_custom_tables[table] || [];
          }
      },
      updateTableRow: async (table: string, pk: string, id: any, data: any) => {
          await smartDelay();
          
          const updateArray = (arr: any[], idField: string) => {
              const idx = arr.findIndex(item => item[idField] == id); // Loose equality for string/number match
              if (idx !== -1) {
                  arr[idx] = { ...arr[idx], ...data };
                  return true;
              }
              return false;
          };

          if (table === 'system_settings') {
              db_settings = { ...db_settings, ...data };
              localStorage.setItem('sca_system_settings', JSON.stringify(db_settings));
              return true;
          }
          if (table === 'profile_view_config') return updateArray(db_profile_settings, 'id');
          if (table === 'users') return updateArray(db_users, 'user_id');
          if (table === 'requests') return updateArray(db_requests, 'request_id');
          if (table === 'organizational_units') return updateArray(db_org_units, 'unit_id');
          
          // Handle dynamic tables
          if (db_custom_tables[table]) {
              // Assuming 'id' field exists for custom tables or use index if no pk (fallback)
              // Since custom tables might not have a clean PK, we look for 'id' property
              if (pk) return updateArray(db_custom_tables[table], pk);
          }

          return true; 
      },
      deleteTableRow: async (table: string, pk: string, id: any) => {
          await smartDelay();
          
          const deleteFromArray = (arr: any[], idField: string) => {
              const idx = arr.findIndex(item => item[idField] == id);
              if (idx !== -1) {
                  arr.splice(idx, 1);
                  return true;
              }
              return false;
          };

          if (table === 'users') return deleteFromArray(db_users, 'user_id');
          if (table === 'requests') return deleteFromArray(db_requests, 'request_id');
          if (table === 'organizational_units') return deleteFromArray(db_org_units, 'unit_id');
          
          if (db_custom_tables[table]) {
              return deleteFromArray(db_custom_tables[table], pk || 'id');
          }

          return true;
      },
      addColumnToTable: async (table: string, col: string, def: any) => true,
      dropColumnFromTable: async (table: string, col: string) => true,
      createTable: async (tableName: string) => {
          if(!db_custom_tables[tableName]) {
              db_custom_tables[tableName] = [];
          }
          return true;
      },
      addTableRow: async (table: string, data: any) => {
          await smartDelay();
          if (db_custom_tables[table]) {
              db_custom_tables[table].push(data);
              return true;
          }
          return false;
      },
      getOrgUnits: async (forTransfer?: boolean) => {
          let units: OrganizationalUnit[];
          if (shouldUseBackend()) {
              units = await api_backend.admin.getOrgUnits(forTransfer);
          } else {
              units = db_org_units;
          }
          const ids = db_settings.transfer_eligible_unit_ids;
          if (forTransfer && ids && ids.length > 0) {
              return units.filter((u: OrganizationalUnit) => ids.includes(u.unit_id));
          }
          return units;
      },
      getOrgUnitTypes: async () => db_org_unit_types,
      saveOrgUnit: async (unit: OrganizationalUnit) => { if(unit.unit_id === 0) db_org_units.push({...unit, unit_id: Date.now()}); else { const idx = db_org_units.findIndex(u => u.unit_id === unit.unit_id); if(idx !== -1) db_org_units[idx] = unit; } },
      deleteOrgUnit: async (id: number) => { const idx = db_org_units.findIndex(u => u.unit_id === id); if(idx !== -1) db_org_units.splice(idx, 1); },
      getDataQualityMetrics: async () => {
          if (shouldUseBackend()) {
              try {
                  return await api_backend.admin.getDataQualityMetrics();
              } catch { return computeDataQualityMetrics(); }
          }
          await smartDelay(300);
          return computeDataQualityMetrics();
      },
      fixDataQuality: async (metricName: string) => {
          if (shouldUseBackend()) {
              try {
                  return await api_backend.admin.fixDataQuality?.(metricName) ?? false;
              } catch { return false; }
          }
          await smartDelay(500);
          if (metricName.includes('Profile')) {
              db_users.forEach(u => {
                  const ua = u as any;
                  if (!ua.national_id) ua.national_id = '29000000000000';
                  if (!ua.full_name) ua.full_name = 'مستخدم';
                  if (!ua.email) ua.email = `u${u.user_id}@sca.gov.eg`;
                  if (!ua.org_unit_id) ua.org_unit_id = db_org_units[0]?.unit_id ?? 1;
                  if (!ua.job_id) ua.job_id = db_job_titles[0]?.job_id ?? 1;
                  if (!ua.role) ua.role = 'EMPLOYEE';
              });
              return true;
          }
          if (metricName.includes('Integrity')) {
              db_requests.forEach(r => {
                  if (!db_users.find(u => u.user_id === r.user_id)) r.user_id = db_users[0]?.user_id ?? 999;
              });
              db_users.forEach(u => {
                  if (u.org_unit_id && !db_org_units.find(o => o.unit_id === u.org_unit_id)) u.org_unit_id = db_org_units[0]?.unit_id ?? 1;
                  if (u.job_id && !db_job_titles.find(j => j.job_id === u.job_id)) u.job_id = db_job_titles[0]?.job_id ?? 1;
              });
              return true;
          }
          if (metricName.includes('Structure')) {
              db_requests.forEach(r => {
                  const ra = r as any;
                  const tid = ra.type_id ?? ra.leave_type_id;
                  if (!db_request_types.find(t => t.id === tid)) ra.type_id = ra.leave_type_id = db_request_types[0]?.id ?? 1;
              });
              return true;
          }
          if (metricName.includes('Compensation')) {
              db_users.forEach(u => {
                  if (u.salary == null || u.salary <= 0) (u as any).salary = 8000;
              });
              return true;
          }
          return false;
      },
      runSecurityScan: async (type: string) => [],
      getProfileConfig: async () => db_profile_settings,
      saveProfileConfig: async (newConfig: ProfileFieldConfig[]) => { db_profile_settings = newConfig; },
      getPermissionsCatalog: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getPermissionsCatalog();
          await smartDelay();
          return PERMISSIONS_CATALOG;
      },
      getUserPermissions: async (userId: number) => {
          if (shouldUseBackend()) return await api_backend.admin.getUserPermissions(userId);
          await smartDelay();
          const user = db_users.find(u => u.user_id === userId);
          return getEffectivePermissions(userId, user?.role);
      },
      saveUserPermissions: async (userId: number, permissions: PermissionKey[]) => {
          if (shouldUseBackend()) return await api_backend.admin.saveUserPermissions(userId, permissions);
          await smartDelay();
          db_user_permissions[String(userId)] = permissions || [];
          savePermissionsToStorage();
          return true;
      },
      
      // --- Transfer & Fair Allocation Methods ---
      getTransferRequests: async (status?: string) => {
          if (shouldUseBackend()) return await api_backend.admin.getTransferRequests(status);
          await smartDelay();
          return db_requests.filter((r: any) => r.transfer_id != null && (!status || r.status === status)) as any[];
      },
      getTransferStats: async () => {
          if (shouldUseBackend()) return await api_backend.admin.getTransferStats();
          await smartDelay();
          const transfers = db_requests.filter((r: any) => r.transfer_id != null) as any[];
          return {
              totalRequests: transfers.length,
              pendingRequests: transfers.filter(r => r.status === 'PENDING' || r.status === 'MANAGER_REVIEW').length,
              approvedRequests: transfers.filter(r => r.status === 'HR_APPROVED').length,
              allocatedRequests: transfers.filter(r => r.status === 'ALLOCATED').length
          };
      },
      runFairAllocation: async () => {
          await smartDelay(2000); // Simulate algorithm
          return {
              allocation_id: Date.now(),
              allocation_date: new Date().toISOString(),
              total_requests: 10,
              matched_requests: 8,
              unmatched_requests: 2,
              matched_allocations: [],
              unmatched_requests_list: [],
              fairness_score: 78,
              fairness_details: {
                  preference_satisfaction: 80,
                  performance_weights_applied: true,
                  gender_balance_maintained: true,
                  experience_distribution: 75
              },
              allocation_summary: 'Fair allocation completed',
              recommendations: ['Review unmatched requests', 'Consider capacity adjustments'],
              algorithm_version: '1.0',
              processing_time_ms: 1523
          };
      },
      approveAllocations: async (allocations: any[]) => {
          await smartDelay();
          return true;
      },
      approveTransferRequest: async (transferId: number, nextStatus: 'MANAGER_REVIEW' | 'HR_APPROVED' | 'ALLOCATED' = 'HR_APPROVED') => {
          if (shouldUseBackend()) return await api_backend.admin.approveTransferRequest(transferId, nextStatus);
          await smartDelay();
          const r = db_requests.find((x: any) => x.transfer_id === transferId || x.request_id === transferId) as any;
          if (r) {
              r.status = nextStatus;
              r.decision_at = new Date().toISOString();
              r.decision_by = 'Human_Manager';
              return true;
          }
          return false;
      },
      rejectTransferRequest: async (transferId: number, reason?: string) => {
          if (shouldUseBackend()) return await api_backend.admin.rejectTransferRequest(transferId, reason);
          await smartDelay();
          const r = db_requests.find((x: any) => x.transfer_id === transferId || x.request_id === transferId) as any;
          if (r) {
              r.status = 'REJECTED';
              r.rejection_reason = reason || 'مرفوض من الإدارة';
              r.decision_at = new Date().toISOString();
              r.decision_by = 'Human_Manager';
              return true;
          }
          return false;
      },
      setTransferStatus: async (transferId: number, status: string) => {
          if (shouldUseBackend()) return await api_backend.admin.setTransferStatus(transferId, status);
          await smartDelay();
          const r = db_requests.find((x: any) => x.transfer_id === transferId || x.request_id === transferId) as any;
          if (r) {
              r.status = status;
              return true;
          }
          return false;
      },
      
      // --- Address Management Methods ---
      getAddress: async (entityType: string, entityId: number) => {
          await smartDelay();
          // Mock: return address from user or unit
          if (entityType === 'EMPLOYEE_RESIDENCE' || entityType === 'EMPLOYEE_BIRTHPLACE') {
              const user = db_users.find(u => u.user_id === entityId);
              if (entityType === 'EMPLOYEE_RESIDENCE') return user?.residence_address || null;
              return user?.birthplace_address || null;
          } else if (entityType === 'ORG_UNIT') {
              const unit = db_org_units.find(u => u.unit_id === entityId);
              return unit?.address || null;
          }
          return null;
      },
      saveAddress: async (address: any) => {
          await smartDelay();
          const { entity_type, entity_id } = address;
          if (entity_type === 'EMPLOYEE_RESIDENCE') {
              const user = db_users.find(u => u.user_id === entity_id);
              if (user) user.residence_address = address;
          } else if (entity_type === 'EMPLOYEE_BIRTHPLACE') {
              const user = db_users.find(u => u.user_id === entity_id);
              if (user) user.birthplace_address = address;
          } else if (entity_type === 'ORG_UNIT') {
              const unit = db_org_units.find(u => u.unit_id === entity_id);
              if (unit) unit.address = address;
          }
          return address;
      },
      deleteAddress: async (addressId: number) => {
          await smartDelay();
          return true;
      },
      
      // --- Allocation Criteria Management ---
      getAllocationCriteria: async () => {
          await smartDelay();
          return [...db_allocation_criteria];
      },
      updateAllocationCriteria: async (criterion: any) => {
          await smartDelay();
          // إذا لم يكن له id ثابت، نعطيه واحد جديد
          let updated = { ...criterion };
          if (!updated.criteria_id || updated.criteria_id === 0) {
              const maxId = db_allocation_criteria.reduce((m, c) => Math.max(m, c.criteria_id), 0);
              updated.criteria_id = maxId + 1;
          }
          const idx = db_allocation_criteria.findIndex(c => c.criteria_id === updated.criteria_id);
          if (idx === -1) {
              db_allocation_criteria.push(updated);
          } else {
              db_allocation_criteria[idx] = updated;
          }
          return updated;
      },
      
      // --- Unit Grade Limits ---
      getUnitGradeLimits: async (unitId?: number) => {
          await smartDelay();
          // Mock data
          const limits = [];
          for (const unit of db_org_units) {
              if (unitId && unit.unit_id !== unitId) continue;
              for (const grade of db_job_grades) {
                  limits.push({
                      limit_id: Date.now() + Math.random(),
                      unit_id: unit.unit_id,
                      grade_id: grade.grade_id,
                      max_employees: 10,
                      current_count: Math.floor(Math.random() * 5),
                      unit_name: unit.unit_name,
                      grade_name: grade.grade_name
                  });
              }
          }
          return limits;
      },
      saveUnitGradeLimit: async (limit: any) => {
          await smartDelay();
          return limit;
      }
  }
};
