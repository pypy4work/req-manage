
// Enums
export enum Role {
  EMPLOYEE = 'Employee',
  MANAGER = 'Manager',
  ADMIN = 'Admin'
}

// --- Fine-grained Permissions ---
export type PermissionKey =
  | 'admin:overview'
  | 'admin:stats'
  | 'admin:users'
  | 'admin:request-types'
  | 'admin:transfers'
  | 'admin:allocation-criteria'
  | 'admin:org-structure'
  | 'admin:database'
  | 'admin:settings'
  | 'admin:permissions';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description?: string;
  group: string;
}

export interface UserPermissionRecord {
  user_id: number;
  permissions: PermissionKey[];
  updated_at?: string;
}

export enum RequestStatusCode {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  DRAFT = 'DRAFT'
}

// Aliases for compatibility
export { RequestStatusCode as RequestStatus };

export enum ModeType {
  MANUAL = 'Manual',
  N8N = 'N8N'
}

export type Language = 'ar' | 'en';
export type DecisionSource = 'AI_Manager' | 'Human_Manager' | 'System_Rule' | 'System_Decision';
export type TimeFilter = 'day' | 'month' | 'year';
export type SidebarPattern = 'stars' | 'circuit' | 'grid' | 'custom';
export type BackgroundAnimation = 'flow' | 'spin' | 'pulse' | 'static';
// Expanded Palettes
export type CosmicPalette = 'default' | 'cyberpunk' | 'golden' | 'ice' | 'nebula' | 'inferno' | 'matrix'; 
// New Structure Types
export type CosmicStructure = 'spiral' | 'atomic' | 'universe' | 'chaos'; 

// --- Database Configuration ---
export interface DatabaseConfig {
  connection_type: 'local_mock' | 'sql_server';
  host?: string;
  database_name?: string;
  username?: string;
  password?: string;
  encrypt?: boolean;
  is_connected?: boolean;
}

// --- System Settings ---
export interface SystemSettings {
  setting_id: number;
  mode_type: ModeType;
  n8n_webhook_url: string;
  system_title: string;
  system_subtitle: string;
  system_logo_url: string;
  logo_source: 'url' | 'upload';
  logo_remove_background?: boolean; // NEW: Control logo container style
  title_font_size?: number;
  subtitle_font_size?: number;
  enable_biometric_login?: boolean;
  
  // New Sidebar Customization
  sidebar_pattern_style: SidebarPattern;
  sidebar_pattern_url?: string;
  sidebar_animation?: BackgroundAnimation; 
  
  // Advanced Cosmic Controls
  cosmic_chaos_level?: number; // 0 to 1
  cosmic_speed?: number; // 0.1 to 5
  cosmic_zoom?: number; // Camera Z pos
  cosmic_palette?: CosmicPalette;
  cosmic_structure?: CosmicStructure; // New: Shape of the galaxy

  // Travel API (car routing) configuration – URL فقط، المفتاح في متغير بيئة
  travel_api_provider?: string;   // مثال: OSRM, OpenRouteService, Google
  travel_api_url?: string;        // مسار خدمة حساب زمن السفر

  db_config: DatabaseConfig;
  updated_at: string;
  /** Unit IDs eligible for transfer (admin selection). If empty, all units are shown. */
  transfer_eligible_unit_ids?: number[];
}

// --- NEW: Profile View Configuration ---
export type ProfileFieldCategory = 'personal' | 'professional' | 'contact' | 'financial';

export interface ProfileFieldConfig {
    id: string; // Matches User property name e.g., 'national_id', 'salary'
    label_ar: string;
    label_en: string;
    category: ProfileFieldCategory;
    isVisible: boolean;
    isSensitive: boolean; // Visual indicator for admin
}

// --- HR & Org Structure (New Tables) ---
export interface JobGrade {
  grade_id: number;
  grade_code: string;
  grade_name: string;
  min_salary?: number;
  max_salary?: number;
}

export interface EmploymentType {
  type_id: number;
  type_name: string;
  is_benefits_eligible: boolean;
}

export interface JobTitle {
  job_id: number;
  job_title_ar: string;
  job_title_en: string;
}

export interface OrgUnitType {
  type_id: number;
  type_name_ar: string;
  type_name_en: string;
  level_order: number;
}

export interface OrganizationalUnit {
  unit_id: number;
  unit_name: string;
  unit_type_id: number;
  parent_unit_id: number | null;
  manager_id?: number | null;
  cost_center_code?: string;
  
  // UI Helpers
  manager_name?: string;
  unit_type_name?: string;
  
  // New Hybrid Address System
  address?: Address;  // عنوان الوحدة الإدارية
}

// --- New: Employee Suffix System ---
export interface EmployeeSuffix {
  suffix_id: number;
  suffix_code: string; // e.g., "IT", "HR", "ENG"
  suffix_name: string; // e.g., "Information Technology Sector"
}

// --- User & Security (Separated) ---
// 1. User Profile (Public/Internal)
export interface User {
  user_id: number;
  
  // New Numbering System
  employee_suffix_id?: number; 
  employee_sequence_number?: number; 
  full_employee_number?: string; // Computed: SUFFIX-NUMBER
  
  // Legacy aliases (kept for compatibility but mapped to new system)
  employee_number?: string; 
  employee_id?: number; 

  national_id: string;
  full_name: string;
  username: string;
  email?: string;
  phone_number?: string;
  
  // Linked IDs
  job_id?: number; // Job Title
  grade_id?: number;
  type_id?: number; // Employment Type
  org_unit_id?: number;
  role: Role; // Mapped from role_id for frontend simplicity
  manager_id?: number; // Direct Manager
  
  // Display Helpers
  job_title?: string;
  org_unit_name?: string;
  picture_url?: string;
  
  // Legacy address field (deprecated, use residence_address instead)
  address?: string;
  
  // New Hybrid Address System
  residence_address?: Address;      // عنوان محل الإقامة
  birthplace_address?: Address;    // محل الميلاد
  
  gender?: 'Male' | 'Female';
  birth_date?: string;
  join_date?: string;
  
  // Enhanced Mock Data for Rules
  salary?: number;

  // Security flags
  is_2fa_enabled?: boolean;
  biometric_credential_id?: string;
}

// 2. User Credentials (Sensitive - Used in Login/Profile Edit only)
export interface UserCredentials {
  user_id: number;
  username: string;
  email?: string;
  phone_number?: string;
  is_2fa_enabled: boolean;
  biometric_enabled: boolean;
  // password hash, salt, secrets are never sent to frontend
}

// Login Result combines basic User info + Status
export interface LoginResult {
  status: 'SUCCESS' | '2FA_REQUIRED' | 'ERROR';
  user?: User;
  credentials?: Partial<UserCredentials>; // Only safe fields
  userId?: number;
  contactMethod?: string;
  message?: string;
}

// --- ENTERPRISE TABLES (Added for DB Consistency) ---

export interface CareerHistory {
  history_id: number;
  user_id: number;
  change_date: string;
  reason: string; // Promotion, Transfer
  
  // Snapshots
  prev_job_title: string;
  new_job_title: string;
  prev_grade_code: string;
  new_grade_code: string;
  prev_dept: string;
  new_dept: string;
  
  changed_by_admin_id?: number;
}

export interface NotificationRecord {
    notif_id: number;
    user_id: number;
    title: string;
    message: string;
    type: 'Info' | 'Success' | 'Warning' | 'Error';
    is_read: boolean;
    created_at: string;
}

export interface RequestApproval {
    approval_id: number;
    request_id: number;
    step_name: string; // e.g., "Direct Manager", "HR Review"
    approver_id: number;
    approver_name: string;
    status: RequestStatusCode;
    comments: string;
    action_date: string;
}

// --- Generic Requests ---

export type UnitType = 'days' | 'hours' | 'amount' | 'none';

// Form Configuration
export type FieldType = 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'computed' | 'select-list' | 'boolean';
export type ComputationOp = 'sum' | 'subtract' | 'multiply' | 'date_diff';

// New: Structured Operand for Computed Fields
export interface ComputedOperandDef {
    source: DataSource;
    field: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  isVisible: boolean;
  isReadOnly: boolean;
  computedConfig?: {
    operation: ComputationOp;
    operands: ComputedOperandDef[]; // Changed from string[] to Object array
  };
  // Optional configuration for list-backed select fields
  listConfig?: {
    source: 'ORG_UNITS' | 'DB_TABLE' | 'ADMIN_LIST' | 'STATIC';
    tableName?: string; // when source === 'DB_TABLE'
    adminListId?: number; // when source === 'ADMIN_LIST'
    staticOptions?: { label: string; value: any }[]; // when source === 'STATIC'
    displayField?: string; // field name to use as label when reading table rows
    valueField?: string; // field name to use as value when reading table rows
    allowMultiple?: boolean;
    maxSelectable?: number; // optional limit enforced by UI
    hierarchical?: boolean; // when true and source === 'ORG_UNITS' show parent/child picks
  };
}

// --- Advanced Validation Rules (Refactored) ---
export type DataSource = 'FORM' | 'DB_FIELD' | 'SYSTEM' | 'STATIC';
// Changed to string to allow custom functions
export type DataTransformation = 'NONE' | 'YEARS_SINCE' | 'DAYS_SINCE' | 'YEAR' | 'MONTH' | 'DAY' | string;
export type SuggestedAction = 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';

export interface RuleOperand {
    source: DataSource;
    field: string; // Field ID, DB Column Name, or Static Value
    transformation: DataTransformation;
}

export interface ValidationRule {
  id: number; // Backend ID
  name: string; // Rule Name
  
  // Left Operand (e.g., Form Duration, or User Age)
  left: RuleOperand;
  
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  
  // Right Operand (e.g., Static 60, or User Balance)
  right: RuleOperand;
  
  suggested_action: SuggestedAction;
  errorMessage: string;
}

// Deprecated fields kept for TS compatibility during migration if needed, but logic uses new structure
export type ComparisonSource = DataSource;

// Document Definitions (Decoupled)
export interface DocumentRequirement {
  id: number; // Backend ID (Def ID)
  label: string; // Document Name
  allowedTypes: string[]; // ['pdf', 'jpg', 'png']
  type: 'original' | 'copy' | 'certified_copy'; // Type of doc
  is_mandatory_default: boolean; // Default setting
  
  // UI Helper when linked
  required?: boolean; 
}

export interface RequestDefinition {
  id: number; // Mapped from type_id
  type_id?: number;
  name: string;
  description?: string;
  category?: string;
  unit: UnitType;
  is_system?: boolean;
  fields: FormField[];
  
  // Relationships (Linking to global pools)
  linked_documents: { doc_def_id: number; required: boolean }[];
  linked_rules: { rule_id: number; priority: number }[];
  
  // Hydrated for Frontend Use (Optional)
  documents?: DocumentRequirement[];
  rules?: ValidationRule[];
  
  // Transfer Type Configuration
  is_transfer_type?: boolean;
  transfer_config?: {
    preferred_units_field?: {
      enabled: boolean;
      required: boolean;
      max_selectable?: number;
      description?: string;
      allow_drag_drop?: boolean;
    };
  };
}

// Allowances
export interface AllowanceBalance {
  balance_id: number;
  request_type_id: number;
  request_name: string;
  remaining: number;
  
  // Aliases for UI components
  leave_name?: string;
  remaining_days?: number;
}
export type LeaveBalance = AllowanceBalance;

// Uploaded File
export interface UploadedFile {
    fileId: string;
    documentId: number; // Links to doc_def_id
    fileName: string;
    fileUrl: string;
    mimeType: string;
}

// The Request Transaction
export interface GenericRequest {
  request_id: number;
  request_code?: string;
  
  user_id: number;
  employee_id?: number; // Added
  employee_name: string;
  
  type_id?: number;
  type_name?: string;
  leave_type_id?: number; // Alias
  leave_name?: string; // Alias
  
  status: RequestStatusCode;
  
  // Common Data
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  quantity?: number; // Duration or Amount
  duration?: number; // Alias for quantity
  unit: UnitType;
  
  custom_data: Record<string, any>;
  attachments: { doc_def_id: number; file_url: string; file_name: string }[];
  
  // --- The Logic Engine Result ---
  validation_results: (number | null)[]; // e.g. [1, 1, 0, 1]
  document_results: number[]; // e.g. [1, 1]
  
  created_at: string;
  decision_at?: string;
  decision_by?: DecisionSource;
  rejection_reason?: string;
  
  // History
  audit_logs?: RequestAuditLog[]; // Legacy UI helper
  is_edited?: boolean; // NEW: Track if user modified it
}
export type LeaveRequest = GenericRequest;

export interface RequestAuditLog {
  log_id: number;
  date: string;
  action_by: string;
  prev_status: string;
  new_status: string;
  comments: string;
}

// --- Analytics ---
export interface DailyAttendanceStat {
  date: string;
  unit_name: string;
  total_strength: number;
  present: number;
  absent: number;
  on_leave: number;
  attendance_percentage: number;
}

export interface AttendanceTrend {
  label: string; // Time label (9:00, Jan 1, Jan, etc.)
  total: number;
  present: number;
  rate: number;
}

export interface ManagerStats {
  pendingCount: number;
  processedToday: number;
  unitStats: DailyAttendanceStat; // Today's stats for manager's unit
  
  // Enhanced stats
  totalUnitEmployees?: number;
  presentToday?: number;
  onLeaveToday?: number;
  attendanceRate: number;
  leavesByType: { name: string; value: number }[];
}

export interface KPIStats {
  totalRequests: number;
  completionRate: number;
  workforceStrength: number;
  overallAttendanceRate: number;
  topLeaveTypes: { name: string; value: number }[];
  
  // Extended
  totalEmployees: number;
  presentCount: number;
  onLeaveCount: number;
  attendanceRate: number;
  activeLeavesByType: { name: string; value: number }[];
  departmentBreakdown: { name: string; value: number }[];
  completedRequests: number;
  pendingRequests: number;
}

// --- NEW ANALYTICS TYPES ---
export interface DeptPerformanceMetric {
    dept: string;
    attendance: number; // 0-100
    responsiveness: number; // 0-100
    satisfaction: number; // 0-100
    utilization: number; // 0-100
}

export interface RequestVolumeMetric {
    date: string;
    requests: number;
    approvals: number;
    rejections: number;
}

// --- DIAGNOSTICS & QUALITY TYPES (NEW) ---
export interface AuthTestResult {
    testName: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    latencyMs: number;
    message: string;
    timestamp: string;
}

export interface DataQualityMetric {
    metric: string;
    score: number; // 0-100
    status: 'Healthy' | 'Degraded' | 'Critical';
    details: string;
    affectedRecords: number;
}

/** Response from N8N Webhook - used when mode is N8N */
export interface N8nWebhookResponse {
    success?: boolean;
    /** Suggested action: APPROVE | REJECT | PENDING | ESCALATE */
    recommendation?: string;
    /** Auto-approve if true (workflow decided) */
    auto_approve?: boolean;
    /** Rejection reason when recommendation is REJECT */
    rejection_reason?: string | null;
    /** Human-readable message for the user */
    message?: string;
    /** Workflow execution ID for tracing */
    workflow_run_id?: string;
    /** Additional data from N8N (e.g. AI analysis, scores) */
    extra?: Record<string, unknown>;
}

// --- Theme ---
export interface ThemeConfig {
  mode: 'light' | 'dark';
  color: 'blue' | 'green' | 'purple' | 'red';
  scale: 'normal' | 'large' | 'xl';
}

// ==========================================
// --- HYBRID ADDRESS SYSTEM ---
// ==========================================

/**
 * نظام العناوين الهجين - بديل لحقل العنوان الواحد
 * يدعم إحداثيات GPS لحساب المسافات
 */
export interface Address {
  address_id?: number;
  entity_type: 'EMPLOYEE_RESIDENCE' | 'EMPLOYEE_BIRTHPLACE' | 'ORG_UNIT';
  entity_id: number;
  governorate: string;        // المحافظة
  city: string;               // المدينة/المركز
  district: string;           // الحي/القرية
  street?: string;            // الشارع
  building?: string;          // العقار
  apartment?: string;         // الشقة
  longitude?: number;         // خط الطول
  latitude?: number;         // خط العرض
  created_at?: string;
  updated_at?: string;
}

/**
 * حدود الوحدات حسب الدرجة الوظيفية
 * يحدد العدد الأقصى من الموظفين لكل درجة في كل وحدة
 */
export interface UnitGradeLimit {
  limit_id?: number;
  unit_id: number;
  grade_id: number;
  max_employees: number;      // العدد الأقصى
  current_count: number;      // العدد الحالي
  unit_name?: string;         // للعرض
  grade_name?: string;        // للعرض
}

// ==========================================
// --- TRANSFER & FAIR ALLOCATION SYSTEM ---
// ==========================================

export type TransferRequestStatus = 
  | 'DRAFT'
  | 'PENDING'
  | 'MANAGER_REVIEW'
  | 'HR_APPROVED'
  | 'ALLOCATED'
  | 'REJECTED'
  | 'CANCELLED';

export type PerformanceRating = 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT';
export type TransferReadiness = 'READY' | 'NEEDS_TRAINING' | 'NOT_READY';

/**
 * Transfer Request with preference units and manager assessment
 * Links to RequestDefinition via template_id
 */
export interface TransferRequest {
  transfer_id: number;
  employee_id: number;
  employee_name?: string;
  
  template_id: number; // Links to transfer request definition
  status: TransferRequestStatus;
  
  // Current position
  current_unit_id: number;
  current_unit_name?: string;
  current_job_id: number;
  current_job_title?: string;
  current_grade_id: number;
  
  // Transfer details
  reason_for_transfer: string;
  preferred_units: TransferPreference[];
  preferred_job_ids?: number[];
  willing_to_relocate?: boolean;
  desired_start_date?: string;
  additional_notes?: string;
  
  // Manager Assessment
  manager_assessment?: ManagerAssessment;
  
  // Allocation Result
  allocated_unit_id?: number;
  allocated_unit_name?: string;
  allocated_job_id?: number;
  allocated_job_title?: string;
  allocation_score?: number; // 0-100
  allocation_reason?: string;
  
  // Timestamps
  submission_date: string;
  approved_by?: number;
  approval_date?: string;
  
  custom_data?: Record<string, any>;
  custom_dynamic_fields?: Record<string, any>; // For dynamic form fields
}

/**
 * Preferred unit with priority order
 */
export interface TransferPreference {
  preference_id?: number;
  unit_id: number;
  unit_name?: string;
  preference_order: number; // 1, 2, 3...
  reason?: string;
}

/**
 * Manager's assessment of the transfer request
 */
export interface ManagerAssessment {
  assessment_id?: number;
  transfer_id?: number;
  manager_id: number;
  manager_name?: string;
  
  performance_rating: PerformanceRating;
  readiness_for_transfer: TransferReadiness;
  
  recommendation: string;
  assessment_date: string;
}

/**
 * Unit transfer capacity and limits
 */
export interface UnitTransferLimit {
  limit_id: number;
  unit_id: number;
  unit_name?: string;
  
  max_transfers_in: number;        // Max employees that can transfer in
  max_transfers_out: number;       // Max employees that can transfer out
  min_employees: number;            // Minimum staffing level to maintain
  
  current_headcount?: number;       // For validation
  available_positions?: number;     // Derived: max_transfers_in - allocated
}

/**
 * Fairness criteria configuration
 */
export interface AllocationCriteria {
  criteria_id: number;
  criterion_name: string;
  weight: number; // 0.0 to 1.0
  calculation_method: string;
  description?: string;
  is_active: boolean;
  min_value?: number;      // NEW: Minimum value for this criterion
  max_value?: number;      // NEW: Maximum value for this criterion
  priority_order?: number; // NEW: Order of priority when multiple criteria tie
}

/**
 * Fair Allocation Algorithm Input
 */
export interface AllocationInput {
  transfer_requests: TransferRequest[];
  unit_limits: UnitTransferLimit[];
  unit_grade_limits: UnitGradeLimit[];  // NEW: Limits per grade per unit
  criteria: AllocationCriteria[];
  employee_addresses?: Map<number, Address>;  // NEW: Employee residence addresses
  unit_addresses?: Map<number, Address>;      // NEW: Unit addresses
  distance_threshold_km?: number;              // NEW: Distance threshold for priority (default: 50km)
  min_tenure_years?: number;                  // NEW: Minimum years for tenure priority (default: 3)
}

/**
 * Fair Allocation Algorithm Output
 */
export interface AllocationResult {
  allocation_id?: number;
  allocation_date: string;
  
  total_requests: number;
  matched_requests: number;
  unmatched_requests: number;
  
  matched_allocations: TransferRequest[]; // With allocated_unit_id filled
  unmatched_requests_list: TransferRequest[];
  
  fairness_score: number; // 0-100
  fairness_details: {
    preference_satisfaction: number;    // % of requests matching preference
    performance_weights_applied: boolean;
    gender_balance_maintained: boolean;
    experience_distribution: number;    // 0-100
  };
  
  allocation_summary: string;
  recommendations: string[];
  
  // For reportingbatching info
  algorithm_version: string;
  processing_time_ms: number;
}

/**
 * Allocation candidate scoring
 */
export interface AllocationCandidate {
  transfer_id: number;
  employee_id: number;
  unit_id: number;
  
  // Score breakdownscores
  preference_score: number;          // Is this a preferred unit?
  performance_score: number;         // Rating of the employee
  preference_order: number;          // 1st, 2nd choice,ทec
  unit_priority: number;             // How urgent is the unit need?
  tenure_score: number;              // How long has employee been in current unit
  
  total_score: number;               // Final matching score
}

/**
 * Transfer allocation history (for auditing and reporting)
 */
export interface AllocationHistory {
  history_id: number;
  allocation_date: string;
  
  total_requests: number;
  matched_requests: number;
  unmatched_requests: number;
  fairness_score: number;
  
  allocation_summary: string;  // JSON stringified
  created_by?: number;
}
