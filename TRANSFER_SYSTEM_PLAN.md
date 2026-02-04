# خطة نظام التنقلات والتوزيع العادل للموظفين

## 1. الرؤية العامة

### الهدف الأساسي:
نظام **مستقل متكامل** لإدارة طلبات التنقل وتوزيع الموظفين بعدالة على الوحدات الإدارية، مع الأخذ في الاعتبار:
- احتياجات الوحدات (الوظائف المطلوبة)
- السعة المتاحة في كل وحدة
- تفضيلات الموظفين
- معايير العدالة والترقيات

### الفرق عن النظام الحالي:
- النظام الحالي: طلبات عامة (إجازات، تدريب، إلخ) من مدير النظام → موظف ← مدير
- النظام الجديد: **نموذج خاص للتنقلات** مع حقول متخصصة (اختيار وحدات، معايير توزيع)

---

## 2. معمارية النظام

### 2.1 مستويات المستخدمين والأدوار:

```
┌─────────────────────────────────────────────────────────────┐
│  مدير النظام (Admin)                                           │
│  - إنشاء نموذج طلب التنقل (Transfer Request Template)         │
│  - تحديد معايير العدالة والتوزيع                               │
│  - تكوين حدود السعة للوحدات                                     │
│  - مراجعة والموافقة على التوزيعات النهائية                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  مدير الموارد البشرية / مدير الوحدة (Manager)                 │
│  - مراجعة طلبات التنقل                                         │
│  - إضافة تقييم الأداء / الحاجة                                 │
│  - الموافقة الأولية على الطلبات                               │
│  - الموافقة على التوزيعات المقترحة                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  الموظف (Employee)                                           │
│  - ملء نموذج طلب التنقل                                        │
│  - اختيار الوحدات المفضلة                                       │
│  - ترتيب التفضيلات (أولويات)                                  │
│  - عرض حالة الطلب                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 تدفق العملية (Workflow):

```
1. إنشاء نموذج
   Admin → Create Transfer Template (with job grades, preferred units, etc.)

2. فتح فترة التقديم
   Admin → Open Transfer Period (from-date, to-date, max-requests per unit)

3. تقديم الطلبات
   Employee → Fill Transfer Request Form → Submit

4. المراجعة الأولية
   Manager → Review Request → Add Assessment (performance, needs)

5. الموافقة الأساسية
   HR Manager → Approve/Reject Request (fit with unit needs)

6. المطابقة والتوزيع العادل
   System → Run Fair Allocation Algorithm
   - خوارزمية المطابقة (Matching Algorithm)
   - موازنة التوزيع (Load Balancing)
   - تطبيق معايير العدالة

7. المراجعة النهائية
   Admin/HR → Review Allocations → Approve/Modify

8. الإشعار والتنفيذ
   Employee ← Notification with Allocation
   HR ← Implementation Report
```

---

## 3. متطلبات النموذج (Transfer Template)

### 3.1 حقول نموذج طلب التنقل:

```typescript
TransferRequest {
  // الحقول الأساسية
  request_id: number
  employee_id: number
  request_template_id: number  // ربط بنموذج التنقل
  request_date: datetime
  status: 'PENDING' | 'MANAGER_REVIEW' | 'HR_APPROVED' | 'MATCHED' | 'ALLOCATED' | 'REJECTED'
  
  // معلومات الموظف الحالية
  current_unit_id: number
  current_job_id: number
  current_grade_id: number
  
  // الاختيارات والتفضيلات
  preferred_units: Array<{
    unit_id: number
    preference_order: number  // 1, 2, 3...
    reason?: string
  }>
  preferred_job_ids?: number[]
  
  // متطلبات إضافية
  reason_for_transfer: string
  willing_to_relocate?: boolean
  desired_start_date?: date
  health_conditions?: string
  family_circumstances?: string
  
  // تقييم المدير
  manager_assessment?: {
    performance_rating: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY'
    readiness_for_transfer: 'READY' | 'NEEDS_TRAINING' | 'NOT_READY'
    recommendation: string
    manager_id: number
    assessment_date: datetime
  }
  
  // النتيجة النهائية
  allocated_unit_id?: number
  allocated_job_id?: number
  allocation_score?: number  // درجة المطابقة (0-100)
  allocation_reason?: string
  approved_by?: number  // admin_id
  approval_date?: datetime
}
```

### 3.2 معايير الحقول المتخصصة:

| الحقل | النوع | الوصف | مثال |
|-------|--------|-------|-------|
| `preferred_units` | **select-list** | قائمة بكل الوحدات الإدارية (hierarchical) | إدارة الموارد البشرية > قسم التطوير |
| `preferred_job_ids` | **multi-select** | الوظائف المؤهل لها الموظف | مهندس أول، مهندس مشروع |
| `performance_rating` | **radio/select** | تقييم الأداء من المدير | ممتاز، جيد جداً، جيد |
| `willing_to_relocate` | **checkbox** | الاستعداد للانتقال الجغرافي | نعم/لا |

---

## 4. عناصر واجهة المستخدم (UI Components)

### 4.1 للموظف:
1. **TransferRequestForm** - نموذج ملء الطلب
   - عرض النموذج ديناميكياً حسب الحقول المعرّفة
   - اختيار الوحدات بترتيب الأولويات (Drag & Drop)
   - تحميل المستندات الداعمة

2. **MyTransferRequests** - عرض طلباتي
   - حالة الطلب (timeline)
   - التاريخ الزمني للتحديثات
   - النتيجة النهائية

### 4.2 لمدير الوحدة:
1. **TransferRequestsReview** - مراجعة الطلبات
   - عرض طلبات تنقل الموظفين من وحدته أو إليها
   - إضافة تقييم الأداء والملاحظات
   - الموافقة/الرفض

### 4.3 لإدارة الموارد البشرية:
1. **TransferRequestsManagement** - إدارة الطلبات
   - عرض جميع طلبات التنقل
   - مراجعة وموافقة على الطلبات
   - عرض إحصائيات

2. **FairAllocationDashboard** - لوحة التوزيع العادل
   - خوارزمية المطابقة
   - عرض النتائج المقترحة
   - معاينة قبل التنفيذ
   - تقارير العدالة

### 4.4 لمدير النظام:
1. **TransferTemplateBuilder** - بناء النموذج
   - استخدام نفس النظام الموجود لإنشاء النماذج
   - إضافة حقول متخصصة للتنقلات

2. **TransferSystemSettings** - إعدادات النظام
   - تحديد معايير التوزيع العادل
   - تحديد حدود السعة للوحدات
   - فترات التقديم

3. **TransferReports** - التقارير
   - إحصائيات التنقلات
   - تحليل العدالة
   - تقارير الأداء

---

## 5. خوارزمية التوزيع العادل (Fair Allocation)

### 5.1 معايير العدالة:

```
Score = (0.3 × تطابق_التفضيلات) + 
         (0.2 × تقييم_الأداء) +
         (0.2 × احتياجات_الوحدة) +
         (0.15 × المؤهلات) +
         (0.1 × الظروف_الخاصة) +
         (0.05 × تاريخ_الطلب)

حيث:
- تطابق_التفضيلات: هل الوحدة في قائمة التفضيلات (100%) أم لا (0%)
- تقييم_الأداء: ممتاز (100%), جيد جداً (85%), جيد (70%)
- احتياجات_الوحدة: درجة احتياج الوحدة للوظيفة المطلوبة
- المؤهلات: هل لدى الموظف المؤهلات المطلوبة
- الظروف_الخاصة: ظروف عائلية/صحية (تعديل +10%)
- تاريخ_الطلب: الموظفون الأقدم أولاً (تعديل تدريجي)
```

### 5.2 قيود التوزيع:

```
1. قيود الوحدة:
   - max_transfers_in = X (يمكن استقبال X موظف فقط)
   - min_capacity = Y (يجب الاحتفاظ بـ Y موظفين في الوحدة)
   - required_jobs = [job1, job2, job3] (الوظائف المطلوبة)

2. قيود الموظف:
   - max_transfers_per_year = 1 (لا يمكن نقل موظفين متكررين)
   - min_stay_in_unit = 2 years (يجب البقاء سنتين قبل التنقل)
   - grade_eligibility = [grade1, grade2] (المستويات المؤهلة للنقل)

3. قيود النظام:
   - لا يمكن نقل أكثر من X% من الموظفين في فترة واحدة
   - التوزيع يجب أن يعكس احتياجات الاستراتيجية
```

### 5.3 خطوات الخوارزمية:

```
1. جمع البيانات:
   - كل الطلبات المعتمدة
   - سعة كل وحدة
   - احتياجات كل وحدة
   - تاريخ كل موظف

2. حساب درجات الملائمة:
   - لكل موظف وكل وحدة متاحة
   - تطبيق معايير العدالة

3. مطابقة ثنائية الاتجاه:
   - للموظفين للوحدات المفضلة
   - مع احترام قيود السعة

4. إعادة موازنة:
   - إذا فشل الموظف في الحصول على خيار
   - اختيار الخيار التالي الأفضل

5. إنشاء التقرير:
   - النتائج المقترحة
   - تحليل العدالة
   - التنبيهات والتحذيرات
```

---

## 6. جداول قاعدة البيانات

### إضافات MSSQL:

```sql
-- نموذج طلب التنقل (Template)
CREATE TABLE sca.transfer_request_templates (
  template_id INT PRIMARY KEY IDENTITY(1,1),
  template_name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  status NVARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, ARCHIVED
  created_by INT,
  created_date DATETIME DEFAULT GETDATE(),
  modified_date DATETIME
)

-- طلبات التنقل
CREATE TABLE sca.transfer_requests (
  transfer_id INT PRIMARY KEY IDENTITY(1,1),
  employee_id INT NOT NULL,
  template_id INT NOT NULL,
  status NVARCHAR(30) DEFAULT 'PENDING',
  current_unit_id INT,
  reason TEXT,
  submission_date DATETIME DEFAULT GETDATE(),
  allocated_unit_id INT,
  allocation_score DECIMAL(5,2),
  FOREIGN KEY (employee_id) REFERENCES sca.users(user_id),
  FOREIGN KEY (template_id) REFERENCES sca.transfer_request_templates(template_id)
)

-- تفضيلات الموظف (الوحدات المفضلة)
CREATE TABLE sca.transfer_preferences (
  preference_id INT PRIMARY KEY IDENTITY(1,1),
  transfer_id INT NOT NULL,
  unit_id INT NOT NULL,
  preference_order INT,  -- 1, 2, 3...
  FOREIGN KEY (transfer_id) REFERENCES sca.transfer_requests(transfer_id),
  FOREIGN KEY (unit_id) REFERENCES sca.organizational_units(unit_id)
)

-- معايير التوزيع العادل
CREATE TABLE sca.allocation_criteria (
  criteria_id INT PRIMARY KEY IDENTITY(1,1),
  criterion_name NVARCHAR(100),
  weight DECIMAL(3,2),  -- 0.1, 0.2, etc.
  calculation_method NVARCHAR(255),
  is_active BIT DEFAULT 1
)

-- حدود السعة للوحدات
CREATE TABLE sca.unit_transfer_limits (
  limit_id INT PRIMARY KEY IDENTITY(1,1),
  unit_id INT NOT NULL,
  max_transfers_in INT,  -- عدد التنقلات الداخلة المسموح
  max_transfers_out INT, -- عدد التنقلات الخارجة المسموح
  min_employees INT,     -- الحد الأدنى للموظفين
  FOREIGN KEY (unit_id) REFERENCES sca.organizational_units(unit_id)
)

-- تقييم المدير للطلب
CREATE TABLE sca.transfer_manager_assessments (
  assessment_id INT PRIMARY KEY IDENTITY(1,1),
  transfer_id INT NOT NULL,
  manager_id INT NOT NULL,
  performance_rating NVARCHAR(20),  -- EXCELLENT, GOOD, SATISFACTORY
  readiness NVARCHAR(20),  -- READY, NEEDS_TRAINING, NOT_READY
  comments TEXT,
  assessment_date DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (transfer_id) REFERENCES sca.transfer_requests(transfer_id),
  FOREIGN KEY (manager_id) REFERENCES sca.users(user_id)
)

-- سجل التوزيعات (للتقارير والتحليل)
CREATE TABLE sca.allocation_history (
  history_id INT PRIMARY KEY IDENTITY(1,1),
  allocation_date DATETIME DEFAULT GETDATE(),
  total_requests INT,
  matched_requests INT,
  unmatched_requests INT,
  fairness_score DECIMAL(5,2),
  allocation_summary NVARCHAR(MAX)  -- JSON
)
```

---

## 7. خطوات التنفيذ (Implementation Phases)

### المرحلة 1: البنية الأساسية (Week 1)
- [ ] إنشاء جداول قاعدة البيانات
- [ ] إضافة Transfer Request Template Builder (using existing FormField system)
- [ ] واجهات API الأساسية (CRUD)

### المرحلة 2: نماذج الموظفين (Week 2)
- [ ] TransferRequestForm - نموذج ملء الطلب
- [ ] MyTransferRequests - عرض الطلبات الشخصية
- [ ] واجهات API لتقديم الطلبات

### المرحلة 3: المراجعة والموافقة (Week 3)
- [ ] TransferRequestsReview - لمدير الوحدة
- [ ] TransferRequestsManagement - لإدارة الموارد البشرية
- [ ] إضافة workflow الموافقات

### المرحلة 4: خوارزمية التوزيع (Week 4)
- [ ] تطوير خوارزمية المطابقة العادلة
- [ ] FairAllocationDashboard
- [ ] تقارير العدالة

### المرحلة 5: التقارير والإحصائيات (Week 5)
- [ ] TransferReports
- [ ] لوحة المؤشرات الرئيسية
- [ ] التقارير التحليلية

---

## 8. معايير النجاح

✅ **معايير التقييم:**
- [ ] جميع الموظفين المؤهلين للتنقل يمكنهم تقديم طلبات
- [ ] معدل حل الطلبات = 85% على الأقل (match rate)
- [ ] درجة العدالة = 75% على الأقل
- [ ] رضا الموظفين عن الخيار الأول = 60% على الأقل
- [ ] لا توجد تسريبات بيانات أو مخاطر أمان
- [ ] الأداء: معالجة 1000 طلب في أقل من دقيقة

---

## 9. الميزات المتقدمة (Phase 2 - مستقبلية)

- تكامل مع نظام الدوام (Attendance)
- توقعات الطلب (Demand Forecasting)
- خطط التطوير الوظيفي (Career Pathing)
- تحليل الحراك الوظيفي (Mobility Analytics)
- تكامل مع نظام الأداء
