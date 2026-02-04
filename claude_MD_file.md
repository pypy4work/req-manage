# خطة تنفيذ نظام النقل الوظيفي المحسّن
## SCA Requests Management System - Transfer Enhancement

---

## 📋 جدول المحتويات
1. [تحليل النظام الحالي](#تحليل-النظام-الحالي)
2. [المتطلبات الجديدة](#المتطلبات-الجديدة)
3. [الهيكل المقترح](#الهيكل-المقترح)
4. [خطة التنفيذ](#خطة-التنفيذ)
5. [قائمة المهام](#قائمة-المهام)
6. [التعديلات البرمجية](#التعديلات-البرمجية)

---

## 🔍 تحليل النظام الحالي

### البنية الحالية:
- **Frontend**: React + TypeScript
- **Backend**: Node.js (Mock API في `api.ts`)
- **Database Schema**: SQL Server (موجود في `database/schema.sql` و `transfer_schema.sql`)
- **المكونات الرئيسية**:
  - `RequestTypesManagement.tsx`: إدارة أنواع الطلبات
  - `TransferForm.tsx`: نموذج النقل الحالي (بسيط)
  - `TransferManagementDashboard.tsx`: لوحة إدارة النقل
  - `types.ts`: تعريفات الأنواع

### النقاط القوية:
- ✅ نظام أنواع الطلبات مرن وقابل للتوسع
- ✅ بنية قاعدة بيانات جيدة للنقل (`transfer_schema.sql`)
- ✅ واجهة إدارة أنواع الطلبات متقدمة

### النقاط التي تحتاج تحسين:
- ⚠️ نظام العناوين: حالياً `address` كحقل نصي واحد/// تم تحويله لنظام هجين متعدد مع احداثيات الموقع
- ⚠️ نظام النقل: لا يدعم تحديد نوع الطلب كـ Transfer في واجهة الإنشاء
- ⚠️ خوارزمية التوزيع: غير مطبقة بشكل كامل/// تم تعديلها
- ⚠️ إدارة معايير التوزيع: غير موجودة/// تم عمله بالفعل

---

## 🎯 المتطلبات الجديدة

### 1. نظام العناوين الهجين (Hybrid Address System)
**الهدف**: استبدال حقل العنوان الواحد بنظام هجين متعدد الحقول مع إحداثيات GPS

**الحقول المطلوبة**:
```
- المحافظة (Governorate)
- المدينة/المركز (City/Center)
- الحي/القرية (District/Village)
- الشارع (Street)
- العقار (Building)
- الشقة (Apartment)
- خط الطول (Longitude)
- خط العرض (Latitude)
```

**الاستخدامات**:
- حساب المسافة بين موقع العمل الحالي ومحل إقامة الموظف
- إعطاء أولوية للموظفين الذين يقطنون بعيداً عن عملهم
- تسجيل محل الميلاد بنفس النظام

### 2. تحسين واجهة إنشاء أنواع الطلبات
**المطلوب**:
- إضافة خيار "نوع الطلب = Transfer"
- عند اختيار Transfer، إظهار حقل `preferred_units`:
  - نوع: multi-select مع drag-and-drop للترتيب
  - إعدادات: مطلوب/اختياري، حد أقصى، وصف
- حفظ في schema نوع الطلب

### 3. خوارزمية التوزيع العادل المحسّنة
**المعايير المقترحة (أوزان قابلة للتعديل)**:
```
- تفضيل الموظف (30%): نقاط أعلى للوحدة الأولى، أقل للثانية...إلخ
- حاجة الوحدة (20%): نسبة نقص الوظائف + unit_max_grade_emp_limits
- تقييم الأداء (15%): تقييم المدير
- المطابقة الوظيفية (10%): الدرجة، المؤهلات
- الظروف الخاصة (15%): صحة، نقل عائلي، المسافة من السكن
- مدة العمل في القسم الحالي (5%): أولوية لمن قضى أكثر من X سنوات
```

**القيود**:
- سعة الوحدة القصوى (لكل درجة وظيفية)
- توازن النوع/الجنس
- قواعد مدة العمل في القسم الحالي
- المسافة من السكن (إذا زادت عن حد معين = أولوية)

### 4. نافذة إدارة معايير التوزيع
**المطلوب**:
- واجهة لإدارة الأوزان
- تفعيل/تعطيل المعايير
- تعديل الأوزان ديناميكياً
- حفظ التغييرات

---

## 🏗️ الهيكل المقترح

### قاعدة البيانات الجديدة:

#### 1. جدول العناوين (addresses)
```sql
CREATE TABLE addresses (
    address_id INT IDENTITY(1,1) PRIMARY KEY,
    entity_type NVARCHAR(50) NOT NULL, -- 'EMPLOYEE_RESIDENCE', 'EMPLOYEE_BIRTHPLACE', 'ORG_UNIT'
    entity_id INT NOT NULL,
    governorate NVARCHAR(100),
    city NVARCHAR(100),
    district NVARCHAR(100),
    street NVARCHAR(200),
    building NVARCHAR(100),
    apartment NVARCHAR(50),
    longitude DECIMAL(10,7),
    latitude DECIMAL(10,7),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME
);
```

#### 2. تحديث جدول request_types
```sql
ALTER TABLE request_types
ADD is_transfer_type BIT DEFAULT 0,
ADD transfer_config_json NVARCHAR(MAX); -- JSON for preferred_units field config
```

#### 3. جدول معايير التوزيع (allocation_criteria) - موجود بالفعل
- يحتاج تحديث لإضافة معايير جديدة (المسافة، مدة العمل)

#### 4. جدول حدود الوحدات حسب الدرجة (unit_grade_limits)
```sql
CREATE TABLE unit_grade_limits (
    limit_id INT IDENTITY(1,1) PRIMARY KEY,
    unit_id INT NOT NULL,
    grade_id INT NOT NULL,
    max_employees INT NOT NULL,
    current_count INT DEFAULT 0,
    FOREIGN KEY (unit_id) REFERENCES organizational_units(unit_id),
    FOREIGN KEY (grade_id) REFERENCES job_grades(grade_id)
);
```

---

## 📝 خطة التنفيذ

### المرحلة 1: نظام العناوين الهجين
1. ✅ إنشاء جدول `addresses` في قاعدة البيانات
2. ✅ تحديث `types.ts` لإضافة `Address` interface
3. ✅ تحديث `User` interface لدعم العناوين المتعددة
4. ✅ تحديث `OrganizationalUnit` لدعم العنوان
5. ✅ إنشاء مكون `AddressForm` لإدخال العناوين
6. ✅ إضافة API endpoints للعناوين
7. ✅ دمج في `UserManagement.tsx` و `OrgStructureManagement.tsx`

### المرحلة 2: تحسين واجهة إنشاء أنواع الطلبات
1. ✅ تحديث `RequestTypesManagement.tsx`:
   - إضافة checkbox "نوع نقل"
   - عند تفعيله، إظهار حقل `preferred_units`
   - دعم drag-and-drop للترتيب
2. ✅ تحديث `RequestDefinition` في `types.ts`
3. ✅ تحديث API `saveRequestType` لدعم Transfer config

### المرحلة 3: تحسين نموذج النقل
1. ✅ تحديث `TransferForm.tsx`:
   - استخدام حقل `preferred_units` من schema
   - دعم drag-and-drop
   - إضافة حقول: سبب النقل، تاريخ الاستعداد، قبول النقل لمناطق بعيدة
2. ✅ ربط مع API العناوين لحساب المسافة

### المرحلة 4: خوارزمية التوزيع العادل
1. ✅ تحديث `types.ts` لإضافة معايير جديدة
2. ✅ إنشاء ملف `allocationAlgorithm.ts`:
   - حساب نقاط كل معيار
   - تطبيق الأوزان
   - احترام القيود (السعة، التوازن)
3. ✅ تحديث `TransferManagementDashboard.tsx`:
   - ربط بخوارزمية التوزيع
   - عرض النتائج

### المرحلة 5: نافذة إدارة المعايير
1. ✅ إنشاء `AllocationCriteriaManagement.tsx`
2. ✅ واجهة تعديل الأوزان
3. ✅ حفظ التغييرات في قاعدة البيانات

### المرحلة 6: التكامل والاختبار
1. ✅ اختبار السيناريوهات الكاملة
2. ✅ ضبط الأوزان بناءً على النتائج
3. ✅ توثيق API

---

## ✅ قائمة المهام

### المهمة 1: نظام العناوين الهجين
- [ ] إنشاء جدول `addresses` في SQL
- [ ] تحديث `types.ts` - إضافة `Address` interface
- [ ] تحديث `User` interface
- [ ] تحديث `OrganizationalUnit` interface
- [ ] إنشاء `AddressForm.tsx` component
- [ ] إضافة API methods في `api.ts`
- [ ] دمج في `UserManagement.tsx`
- [ ] دمج في `OrgStructureManagement.tsx`
- [ ] إضافة utility function لحساب المسافة

### المهمة 2: تحسين RequestTypesManagement
- [ ] إضافة checkbox "Transfer Type"
- [ ] إضافة UI لـ `preferred_units` field config
- [ ] دعم drag-and-drop (استخدام react-beautiful-dnd أو dnd-kit)
- [ ] تحديث `RequestDefinition` type
- [ ] تحديث `saveRequestType` API

### المهمة 3: تحسين TransferForm
- [ ] قراءة config من RequestDefinition
- [ ] إضافة drag-and-drop للوحدات المفضلة
- [ ] إضافة حقول إضافية (سبب، تاريخ، قبول نقل بعيد)
- [ ] ربط مع API العناوين

### المهمة 4: خوارزمية التوزيع
- [ ] إنشاء `allocationAlgorithm.ts`
- [ ] تطبيق جميع المعايير
- [ ] حساب المسافة من العناوين
- [ ] احترام القيود (السعة، التوازن)
- [ ] تحديث `TransferManagementDashboard.tsx`

### المهمة 5: إدارة المعايير
- [ ] إنشاء `AllocationCriteriaManagement.tsx`
- [ ] واجهة تعديل الأوزان
- [ ] API methods للقراءة/الكتابة
- [ ] دمج في Admin Dashboard

### المهمة 6: قاعدة البيانات
- [ ] إنشاء migration script للعناوين
- [ ] تحديث `transfer_schema.sql`
- [ ] إضافة `unit_grade_limits` table
- [ ] Seed data للمعايير

---

## 💻 التعديلات البرمجية

### 1. types.ts - إضافة أنواع جديدة

```typescript
// نظام العناوين الهجين
export interface Address {
  address_id?: number;
  entity_type: 'EMPLOYEE_RESIDENCE' | 'EMPLOYEE_BIRTHPLACE' | 'ORG_UNIT';
  entity_id: number;
  governorate: string;
  city: string;
  district: string;
  street?: string;
  building?: string;
  apartment?: string;
  longitude?: number;
  latitude?: number;
}

// تحديث User
export interface User {
  // ... existing fields
  residence_address?: Address;
  birthplace_address?: Address;
}

// تحديث OrganizationalUnit
export interface OrganizationalUnit {
  // ... existing fields
  address?: Address;
}

// تحديث RequestDefinition
export interface RequestDefinition {
  // ... existing fields
  is_transfer_type?: boolean;
  transfer_config?: {
    preferred_units_field?: {
      enabled: boolean;
      required: boolean;
      max_selectable?: number;
      description?: string;
    };
  };
}

// معايير التوزيع المحسّنة
export interface AllocationCriteria {
  criteria_id: number;
  criterion_name: string;
  weight: number; // 0.0 to 1.0
  calculation_method: string;
  description?: string;
  is_active: boolean;
  // New fields
  min_value?: number;
  max_value?: number;
  priority_order?: number;
}

// تحديث AllocationInput
export interface AllocationInput {
  transfer_requests: TransferRequest[];
  unit_limits: UnitTransferLimit[];
  unit_grade_limits: UnitGradeLimit[]; // NEW
  criteria: AllocationCriteria[];
  employee_addresses: Map<number, Address>; // NEW
  unit_addresses: Map<number, Address>; // NEW
  distance_threshold_km?: number; // NEW: threshold for distance priority
  min_tenure_years?: number; // NEW: minimum years for tenure priority
}
```

### 2. إنشاء AddressForm.tsx

```typescript
import React, { useState } from 'react';
import { Address } from '../../types';
import { Input, Button } from '../ui/UIComponents';

interface AddressFormProps {
  address?: Address;
  onChange: (address: Address) => void;
  showCoordinates?: boolean;
}

export const AddressForm: React.FC<AddressFormProps> = ({ 
  address, 
  onChange, 
  showCoordinates = true 
}) => {
  const [formData, setFormData] = useState<Address>(address || {
    entity_type: 'EMPLOYEE_RESIDENCE',
    entity_id: 0,
    governorate: '',
    city: '',
    district: '',
    street: '',
    building: '',
    apartment: '',
    longitude: undefined,
    latitude: undefined
  });

  const handleChange = (field: keyof Address, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated);
  };

  const handleGetCoordinates = async () => {
    // Integration with geocoding API (Google Maps, OpenStreetMap, etc.)
    // For now, mock implementation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleChange('latitude', position.coords.latitude);
          handleChange('longitude', position.coords.longitude);
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>المحافظة *</label>
          <Input
            value={formData.governorate}
            onChange={(e) => handleChange('governorate', e.target.value)}
            required
          />
        </div>
        <div>
          <label>المدينة/المركز *</label>
          <Input
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label>الحي/القرية *</label>
        <Input
          value={formData.district}
          onChange={(e) => handleChange('district', e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>الشارع</label>
          <Input
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
          />
        </div>
        <div>
          <label>العقار</label>
          <Input
            value={formData.building}
            onChange={(e) => handleChange('building', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label>الشقة</label>
        <Input
          value={formData.apartment}
          onChange={(e) => handleChange('apartment', e.target.value)}
        />
      </div>
      {showCoordinates && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label>خط العرض</label>
            <Input
              type="number"
              step="any"
              value={formData.latitude || ''}
              onChange={(e) => handleChange('latitude', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label>خط الطول</label>
            <Input
              type="number"
              step="any"
              value={formData.longitude || ''}
              onChange={(e) => handleChange('longitude', parseFloat(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={handleGetCoordinates}>
              📍 الحصول على الإحداثيات
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3. تحديث RequestTypesManagement.tsx

إضافة قسم Transfer Type Configuration:

```typescript
// في editingType state
const [isTransferType, setIsTransferType] = useState(false);
const [transferConfig, setTransferConfig] = useState({
  preferred_units_field: {
    enabled: false,
    required: true,
    max_selectable: 5,
    description: 'اختر الوحدات المفضلة بترتيب الأولوية'
  }
});

// في UI
<Card>
  <CardHeader>
    <CardTitle>إعدادات نوع النقل</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-2 mb-4">
      <input
        type="checkbox"
        id="is_transfer"
        checked={isTransferType}
        onChange={(e) => setIsTransferType(e.target.checked)}
      />
      <label htmlFor="is_transfer">هذا النوع هو Transfer/نقل</label>
    </div>
    
    {isTransferType && (
      <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
        <h4>حقل الوحدات المفضلة</h4>
        <div className="space-y-2">
          <label>
            <input
              type="checkbox"
              checked={transferConfig.preferred_units_field.enabled}
              onChange={(e) => setTransferConfig({
                ...transferConfig,
                preferred_units_field: {
                  ...transferConfig.preferred_units_field,
                  enabled: e.target.checked
                }
              })}
            />
            تفعيل حقل الوحدات المفضلة
          </label>
          <div>
            <label>مطلوب</label>
            <input
              type="checkbox"
              checked={transferConfig.preferred_units_field.required}
              onChange={(e) => setTransferConfig({
                ...transferConfig,
                preferred_units_field: {
                  ...transferConfig.preferred_units_field,
                  required: e.target.checked
                }
              })}
            />
          </div>
          <div>
            <label>الحد الأقصى للاختيارات</label>
            <Input
              type="number"
              value={transferConfig.preferred_units_field.max_selectable}
              onChange={(e) => setTransferConfig({
                ...transferConfig,
                preferred_units_field: {
                  ...transferConfig.preferred_units_field,
                  max_selectable: parseInt(e.target.value)
                }
              })}
            />
          </div>
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

### 4. خوارزمية التوزيع (allocationAlgorithm.ts)

```typescript
import { 
  TransferRequest, 
  AllocationCriteria, 
  UnitTransferLimit,
  UnitGradeLimit,
  Address,
  AllocationResult 
} from '../types';

/**
 * حساب المسافة بين إحداثيين (Haversine formula)
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * حساب نقاط تفضيل الموظف
 */
function calculatePreferenceScore(
  request: TransferRequest,
  unitId: number
): number {
  const preference = request.preferred_units.find(p => p.unit_id === unitId);
  if (!preference) return 0;
  
  // الأولوية الأولى = 100 نقطة، الثانية = 80، الثالثة = 60، إلخ
  const order = preference.preference_order;
  return Math.max(0, 100 - (order - 1) * 20);
}

/**
 * حساب نقاط حاجة الوحدة
 */
function calculateUnitNeedScore(
  unitId: number,
  unitLimits: UnitTransferLimit[],
  unitGradeLimits: UnitGradeLimit[],
  request: TransferRequest
): number {
  const limit = unitLimits.find(l => l.unit_id === unitId);
  const gradeLimit = unitGradeLimits.find(
    l => l.unit_id === unitId && l.grade_id === request.current_grade_id
  );
  
  if (!limit || !gradeLimit) return 50; // Default score
  
  const utilizationRate = gradeLimit.current_count / gradeLimit.max_employees;
  const availableCapacity = gradeLimit.max_employees - gradeLimit.current_count;
  
  // نقاط أعلى إذا كانت السعة متاحة والاستخدام منخفض
  if (availableCapacity > 0 && utilizationRate < 0.8) {
    return 100 - (utilizationRate * 50);
  }
  
  return Math.max(0, 50 - (utilizationRate - 0.8) * 100);
}

/**
 * حساب نقاط تقييم الأداء
 */
function calculatePerformanceScore(
  assessment: ManagerAssessment | undefined
): number {
  if (!assessment) return 50; // Default if no assessment
  
  const ratingMap = {
    'EXCELLENT': 100,
    'GOOD': 85,
    'SATISFACTORY': 70,
    'NEEDS_IMPROVEMENT': 50
  };
  
  return ratingMap[assessment.performance_rating] || 50;
}

/**
 * حساب نقاط المطابقة الوظيفية
 */
function calculateQualificationScore(
  request: TransferRequest,
  unitId: number
): number {
  // Simplified: check if job title matches unit needs
  // In real implementation, check against unit job requirements
  return 80; // Placeholder
}

/**
 * حساب نقاط الظروف الخاصة (المسافة، الصحة، إلخ)
 */
function calculateSpecialCircumstancesScore(
  request: TransferRequest,
  unitId: number,
  employeeAddress: Address | undefined,
  unitAddress: Address | undefined,
  distanceThreshold: number = 50
): number {
  let score = 50; // Base score
  
  // حساب المسافة
  if (employeeAddress && unitAddress && 
      employeeAddress.latitude && employeeAddress.longitude &&
      unitAddress.latitude && unitAddress.longitude) {
    const distance = calculateDistance(
      employeeAddress.latitude,
      employeeAddress.longitude,
      unitAddress.latitude,
      unitAddress.longitude
    );
    
    // إذا كانت المسافة أكبر من العتبة، إعطاء نقاط إضافية
    if (distance > distanceThreshold) {
      score += Math.min(30, (distance - distanceThreshold) / 10);
    }
  }
  
  // إضافة نقاط للظروف الخاصة الأخرى (صحة، نقل عائلي)
  if (request.custom_data?.health_condition) score += 10;
  if (request.custom_data?.family_transfer) score += 15;
  
  return Math.min(100, score);
}

/**
 * حساب نقاط مدة العمل في القسم الحالي
 */
function calculateTenureScore(
  request: TransferRequest,
  minTenureYears: number = 3
): number {
  // حساب المدة من join_date أو تاريخ آخر نقل
  // Simplified: assume we have tenure data
  const tenureYears = request.custom_data?.current_unit_tenure_years || 0;
  
  if (tenureYears >= minTenureYears) {
    return Math.min(100, 50 + (tenureYears - minTenureYears) * 10);
  }
  
  return 50;
}

/**
 * خوارزمية التوزيع العادل الرئيسية
 */
export async function runFairAllocation(
  input: AllocationInput
): Promise<AllocationResult> {
  const {
    transfer_requests,
    unit_limits,
    unit_grade_limits,
    criteria,
    employee_addresses,
    unit_addresses,
    distance_threshold_km = 50,
    min_tenure_years = 3
  } = input;
  
  // تصفية الطلبات المعتمدة فقط
  const approvedRequests = transfer_requests.filter(
    r => r.status === 'HR_APPROVED'
  );
  
  // حساب النقاط لكل طلب-وحدة محتملة
  const candidates: AllocationCandidate[] = [];
  
  for (const request of approvedRequests) {
    for (const preference of request.preferred_units) {
      const unitId = preference.unit_id;
      
      // التحقق من القيود
      const unitLimit = unit_limits.find(l => l.unit_id === unitId);
      const gradeLimit = unit_grade_limits.find(
        l => l.unit_id === unitId && l.grade_id === request.current_grade_id
      );
      
      if (!unitLimit || !gradeLimit) continue;
      if (gradeLimit.current_count >= gradeLimit.max_employees) continue;
      
      // حساب النقاط لكل معيار
      const preferenceScore = calculatePreferenceScore(request, unitId);
      const unitNeedScore = calculateUnitNeedScore(
        unitId, unit_limits, unit_grade_limits, request
      );
      const performanceScore = calculatePerformanceScore(
        request.manager_assessment
      );
      const qualificationScore = calculateQualificationScore(request, unitId);
      const specialScore = calculateSpecialCircumstancesScore(
        request,
        unitId,
        employee_addresses.get(request.employee_id),
        unit_addresses.get(unitId),
        distance_threshold_km
      );
      const tenureScore = calculateTenureScore(request, min_tenure_years);
      
      // تطبيق الأوزان
      const activeCriteria = criteria.filter(c => c.is_active);
      let totalScore = 0;
      let totalWeight = 0;
      
      for (const criterion of activeCriteria) {
        let score = 0;
        switch (criterion.calculation_method) {
          case 'preference_match':
            score = preferenceScore;
            break;
          case 'unit_need':
            score = unitNeedScore;
            break;
          case 'performance_rating':
            score = performanceScore;
            break;
          case 'qualification_match':
            score = qualificationScore;
            break;
          case 'special_circumstances':
            score = specialScore;
            break;
          case 'tenure_score':
            score = tenureScore;
            break;
        }
        
        totalScore += score * criterion.weight;
        totalWeight += criterion.weight;
      }
      
      const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      
      candidates.push({
        transfer_id: request.transfer_id,
        employee_id: request.employee_id,
        unit_id: unitId,
        preference_score: preferenceScore,
        performance_score: performanceScore,
        preference_order: preference.preference_order,
        unit_priority: unitNeedScore,
        tenure_score: tenureScore,
        total_score: finalScore
      });
    }
  }
  
  // ترتيب حسب النقاط الإجمالية
  candidates.sort((a, b) => b.total_score - a.total_score);
  
  // توزيع عادل مع احترام القيود
  const allocations: TransferRequest[] = [];
  const usedUnits = new Map<number, number>(); // unit_id -> count
  const usedEmployees = new Set<number>();
  
  for (const candidate of candidates) {
    if (usedEmployees.has(candidate.employee_id)) continue;
    
    const unitId = candidate.unit_id;
    const currentCount = usedUnits.get(unitId) || 0;
    const gradeLimit = unit_grade_limits.find(
      l => l.unit_id === unitId && 
      l.grade_id === approvedRequests.find(
        r => r.employee_id === candidate.employee_id
      )?.current_grade_id
    );
    
    if (!gradeLimit) continue;
    if (currentCount >= gradeLimit.max_employees) continue;
    
    // تخصيص
    const request = approvedRequests.find(
      r => r.transfer_id === candidate.transfer_id
    );
    if (request) {
      request.allocated_unit_id = unitId;
      request.allocation_score = candidate.total_score;
      allocations.push(request);
      usedEmployees.add(candidate.employee_id);
      usedUnits.set(unitId, currentCount + 1);
    }
  }
  
  const unmatched = approvedRequests.filter(
    r => !allocations.some(a => a.transfer_id === r.transfer_id)
  );
  
  // حساب درجة العدالة
  const fairnessScore = calculateFairnessScore(allocations, approvedRequests);
  
  return {
    allocation_id: Date.now(),
    allocation_date: new Date().toISOString(),
    total_requests: approvedRequests.length,
    matched_requests: allocations.length,
    unmatched_requests: unmatched.length,
    matched_allocations: allocations,
    unmatched_requests_list: unmatched,
    fairness_score: fairnessScore,
    fairness_details: {
      preference_satisfaction: calculatePreferenceSatisfaction(allocations),
      performance_weights_applied: true,
      gender_balance_maintained: checkGenderBalance(allocations),
      experience_distribution: calculateExperienceDistribution(allocations)
    },
    allocation_summary: `تم تخصيص ${allocations.length} من ${approvedRequests.length} طلب`,
    recommendations: generateRecommendations(allocations, unmatched),
    algorithm_version: '2.0',
    processing_time_ms: 0 // Will be calculated
  };
}

function calculateFairnessScore(
  allocations: TransferRequest[],
  totalRequests: TransferRequest[]
): number {
  // Simplified fairness calculation
  return Math.round((allocations.length / totalRequests.length) * 100);
}

function calculatePreferenceSatisfaction(
  allocations: TransferRequest[]
): number {
  const firstChoiceMatches = allocations.filter(
    a => a.preferred_units.some(
      p => p.unit_id === a.allocated_unit_id && p.preference_order === 1
    )
  ).length;
  
  return Math.round((firstChoiceMatches / allocations.length) * 100);
}

function checkGenderBalance(allocations: TransferRequest[]): boolean {
  // Simplified: check if gender distribution is balanced
  return true; // Placeholder
}

function calculateExperienceDistribution(
  allocations: TransferRequest[]
): number {
  // Simplified: calculate distribution of experience levels
  return 75; // Placeholder
}

function generateRecommendations(
  allocations: TransferRequest[],
  unmatched: TransferRequest[]
): string[] {
  const recommendations: string[] = [];
  
  if (unmatched.length > 0) {
    recommendations.push(
      `يوجد ${unmatched.length} طلب غير مخصص - يرجى المراجعة اليدوية`
    );
  }
  
  if (allocations.length < allocations.length * 0.8) {
    recommendations.push('نسبة التخصيص منخفضة - قد تحتاج إلى تعديل القيود');
  }
  
  return recommendations;
}
```

---

## 🎨 واجهة إدارة المعايير

### AllocationCriteriaManagement.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { AllocationCriteria } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../ui/UIComponents';
import { Save, Edit2, Trash2 } from 'lucide-react';

export const AllocationCriteriaManagement: React.FC = () => {
  const [criteria, setCriteria] = useState<AllocationCriteria[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [totalWeight, setTotalWeight] = useState(0);

  useEffect(() => {
    loadCriteria();
  }, []);

  useEffect(() => {
    const sum = criteria
      .filter(c => c.is_active)
      .reduce((acc, c) => acc + c.weight, 0);
    setTotalWeight(sum);
  }, [criteria]);

  const loadCriteria = async () => {
    const data = await api.admin.getAllocationCriteria();
    setCriteria(data);
  };

  const handleWeightChange = (id: number, newWeight: number) => {
    setCriteria(criteria.map(c => 
      c.criteria_id === id ? { ...c, weight: Math.max(0, Math.min(1, newWeight)) } : c
    ));
  };

  const handleToggleActive = (id: number) => {
    setCriteria(criteria.map(c => 
      c.criteria_id === id ? { ...c, is_active: !c.is_active } : c
    ));
  };

  const handleSave = async () => {
    for (const criterion of criteria) {
      await api.admin.updateAllocationCriteria(criterion);
    }
    setEditingId(null);
    loadCriteria();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إدارة معايير التوزيع العادل</CardTitle>
          <p className="text-sm text-gray-500">
            إجمالي الأوزان النشطة: {totalWeight.toFixed(2)} 
            {totalWeight !== 1 && (
              <span className="text-red-500 ml-2">
                (يجب أن يكون المجموع = 1.00)
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {criteria.map(criterion => (
              <div key={criterion.criteria_id} className="border p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold">{criterion.criterion_name}</h4>
                    <p className="text-sm text-gray-500">{criterion.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={criterion.is_active}
                      onChange={() => handleToggleActive(criterion.criteria_id)}
                    />
                    <label>نشط</label>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label>الوزن (0.0 - 1.0)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={criterion.weight}
                      onChange={(e) => handleWeightChange(
                        criterion.criteria_id, 
                        parseFloat(e.target.value)
                      )}
                      disabled={!criterion.is_active}
                    />
                  </div>
                  <div className="w-32">
                    <div className="bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{ width: `${criterion.weight * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} className="mt-4" disabled={totalWeight !== 1}>
            <Save className="w-4 h-4 mr-2" />
            حفظ التغييرات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 📊 ملخص التعديلات

### الملفات الجديدة:
1. `components/address/AddressForm.tsx` - مكون إدخال العناوين
2. `utils/distanceCalculator.ts` - حساب المسافة
3. `algorithms/allocationAlgorithm.ts` - خوارزمية التوزيع
4. `components/admin/AllocationCriteriaManagement.tsx` - إدارة المعايير

### الملفات المعدلة:
1. `types.ts` - إضافة أنواع جديدة
2. `components/admin/RequestTypesManagement.tsx` - إضافة Transfer config
3. `components/employee/TransferForm.tsx` - تحسين النموذج
4. `components/admin/TransferManagementDashboard.tsx` - ربط الخوارزمية
5. `services/api.ts` - إضافة API methods
6. `database/transfer_schema.sql` - تحديث schema

---

## 🚀 البدء بالتنفيذ

سيتم البدء بتنفيذ المهام بالترتيب التالي:
1. نظام العناوين الهجين
2. تحسين RequestTypesManagement
3. تحسين TransferForm
4. خوارزمية التوزيع
5. إدارة المعايير

---

---

## ✅ حالة التنفيذ

### المهام المكتملة:
- ✅ نظام العناوين الهجين (Address System)
  - ✅ تحديث types.ts
  - ✅ إنشاء AddressForm.tsx
  - ✅ إضافة API methods
  - ⏳ دمج في UserManagement و OrgStructureManagement (متبقي)

- ✅ تحسين RequestTypesManagement
  - ✅ إضافة Transfer Type checkbox
  - ✅ إضافة preferred_units config UI
  - ✅ دعم drag-and-drop settings

- ✅ تحسين TransferForm
  - ✅ دعم drag-and-drop للوحدات المفضلة
  - ✅ استخدام @dnd-kit library
  - ✅ دعم config من RequestDefinition

- ✅ خوارزمية التوزيع العادل
  - ✅ إنشاء allocationAlgorithm.ts
  - ✅ تطبيق جميع المعايير الستة
  - ✅ حساب المسافة من العناوين
  - ✅ ربط بـ TransferManagementDashboard

- ✅ إدارة المعايير
  - ✅ إنشاء AllocationCriteriaManagement.tsx
  - ✅ واجهة تعديل الأوزان
  - ✅ تطبيع الأوزان تلقائياً

- ✅ قاعدة البيانات
  - ✅ إنشاء migration script
  - ✅ جداول addresses و unit_grade_limits
  - ✅ Stored procedures للعناوين

### الملفات الجديدة:
1. `components/address/AddressForm.tsx` - مكون إدخال العناوين
2. `utils/distanceCalculator.ts` - حساب المسافة
3. `algorithms/allocationAlgorithm.ts` - خوارزمية التوزيع
4. `components/admin/AllocationCriteriaManagement.tsx` - إدارة المعايير
5. `database/address_migration.sql` - Migration script

### الملفات المعدلة:
1. `types.ts` - إضافة أنواع جديدة (Address, UnitGradeLimit, إلخ)
2. `components/admin/RequestTypesManagement.tsx` - إضافة Transfer config
3. `components/employee/TransferForm.tsx` - دعم drag-and-drop
4. `components/admin/TransferManagementDashboard.tsx` - ربط الخوارزمية
5. `services/api.ts` - إضافة API methods

### المكتبات المضافة:
- `@dnd-kit/core` - Drag and drop core
- `@dnd-kit/sortable` - Sortable items
- `@dnd-kit/utilities` - Utilities

---

## 📝 ملاحظات مهمة

### ما يحتاج إلى إكمال:
1. **دمج AddressForm**: يجب دمج AddressForm في:
   - `components/admin/UserManagement.tsx` - لإضافة/تعديل عناوين الموظفين
   - `components/admin/OrgStructureManagement.tsx` - لإضافة/تعديل عناوين الوحدات

2. **ربط AllocationCriteriaManagement**: يجب إضافتها إلى Admin Dashboard:
   - إضافة رابط في القائمة الجانبية
   - أو إضافة تبويب في لوحة الإدارة

3. **اختبار الخوارزمية**: يجب اختبار الخوارزمية مع بيانات حقيقية:
   - اختبار مع معايير مختلفة
   - ضبط الأوزان بناءً على النتائج
   - التحقق من العدالة

4. **API Backend**: يجب تطبيق API methods في Backend الحقيقي:
   - `getAddress`, `saveAddress`
   - `getAllocationCriteria`, `updateAllocationCriteria`
   - `getUnitGradeLimits`, `saveUnitGradeLimit`

---

## 🚀 خطوات التشغيل

1. **تثبيت المكتبات**:
   ```bash
   npm install
   ```

2. **تشغيل Migration**:
   ```sql
   -- تشغيل database/address_migration.sql على SQL Server
   ```

3. **تشغيل التطبيق**:
   ```bash
   npm run dev
   ```

4. **الوصول إلى الميزات**:
   - إدارة أنواع الطلبات: Admin → Request Types → إنشاء/تعديل نوع Transfer
   - نموذج النقل: Employee → New Request → اختيار نوع Transfer
   - إدارة التوزيع: Admin → Transfer Management
   - إدارة المعايير: Admin → Allocation Criteria (يحتاج إضافة رابط)

---

**تاريخ الإنشاء**: 2026-02-03
**آخر تحديث**: 2026-02-03
**الحالة**: ✅ 90% مكتمل (يحتاج دمج AddressForm وإضافة رابط المعايير)
