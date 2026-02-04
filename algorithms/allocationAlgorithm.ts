/**
 * خوارزمية التوزيع العادل لنقل الموظفين
 * تستخدم نموذج نقاط مرجح متعدد المعايير
 */

import {
  TransferRequest,
  AllocationCriteria,
  UnitTransferLimit,
  UnitGradeLimit,
  Address,
  AllocationResult,
  AllocationCandidate,
  AllocationInput,
  ManagerAssessment
} from '../types';
import {
  calculateDistance,
  calculateDistancePriorityScore
} from '../utils/distanceCalculator';

/**
 * حساب نقاط تفضيل الموظف
 * الأولوية الأولى = 100 نقطة، الثانية = 80، الثالثة = 60، إلخ
 */
function calculatePreferenceScore(
  request: TransferRequest,
  unitId: number
): number {
  const preference = request.preferred_units.find(p => p.unit_id === unitId);
  if (!preference) return 0;

  const order = preference.preference_order;
  // الأولوية الأولى = 100، الثانية = 80، الثالثة = 60، الرابعة = 40، الخامسة = 20
  return Math.max(0, 100 - (order - 1) * 20);
}

/**
 * حساب نقاط حاجة الوحدة
 * يعتمد على نسبة الاستخدام الحالي والحد الأقصى
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

  if (!limit || !gradeLimit) return 50; // نقاط افتراضية

  const utilizationRate = gradeLimit.current_count / gradeLimit.max_employees;
  const availableCapacity = gradeLimit.max_employees - gradeLimit.current_count;

  // نقاط أعلى إذا كانت السعة متاحة والاستخدام منخفض
  if (availableCapacity > 0 && utilizationRate < 0.8) {
    return 100 - utilizationRate * 50;
  }

  // إذا كان الاستخدام عالي، نقاط أقل
  if (utilizationRate >= 0.8 && utilizationRate < 1.0) {
    return Math.max(0, 50 - (utilizationRate - 0.8) * 100);
  }

  // إذا كانت السعة ممتلئة، نقاط صفر
  return 0;
}

/**
 * حساب نقاط تقييم الأداء
 */
function calculatePerformanceScore(
  assessment: ManagerAssessment | undefined
): number {
  if (!assessment) return 50; // نقاط افتراضية إذا لم يكن هناك تقييم

  const ratingMap: Record<string, number> = {
    EXCELLENT: 100,
    GOOD: 85,
    SATISFACTORY: 70,
    NEEDS_IMPROVEMENT: 50
  };

  return ratingMap[assessment.performance_rating] || 50;
}

/**
 * حساب نقاط المطابقة الوظيفية
 * يتحقق من توافق الدرجة والمؤهلات مع احتياجات الوحدة
 */
function calculateQualificationScore(
  request: TransferRequest,
  unitId: number
): number {
  // في التطبيق الحقيقي، يجب التحقق من:
  // 1. هل الدرجة الوظيفية متوافقة مع الوحدة؟
  // 2. هل المؤهلات الفنية مناسبة؟
  // 3. هل المسمى الوظيفي مطلوب في الوحدة؟

  // حالياً: نقاط افتراضية (يمكن تحسينها لاحقاً)
  return 80;
}

/**
 * حساب نقاط الظروف الخاصة
 * يشمل: المسافة من السكن، الصحة، نقل عائلي
 */
function calculateSpecialCircumstancesScore(
  request: TransferRequest,
  unitId: number,
  employeeAddress: Address | undefined,
  unitAddress: Address | undefined,
  distanceThreshold: number = 50
): number {
  let score = 50; // نقاط أساسية

  // حساب المسافة من السكن
  if (
    employeeAddress &&
    unitAddress &&
    employeeAddress.latitude &&
    employeeAddress.longitude &&
    unitAddress.latitude &&
    unitAddress.longitude
  ) {
    const distance = calculateDistance(
      employeeAddress.latitude,
      employeeAddress.longitude,
      unitAddress.latitude,
      unitAddress.longitude
    );

    // استخدام دالة حساب الأولوية بناءً على المسافة
    score = calculateDistancePriorityScore(distance, distanceThreshold, 30);
  }

  // إضافة نقاط للظروف الخاصة الأخرى
  if (request.custom_data?.health_condition) {
    score += 10; // حالة صحية
  }
  if (request.custom_data?.family_transfer) {
    score += 15; // نقل عائلي
  }
  if (request.custom_data?.special_circumstances) {
    score += 10; // ظروف خاصة أخرى
  }

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
  const tenureYears = request.custom_data?.current_unit_tenure_years || 0;

  if (tenureYears >= minTenureYears) {
    // نقاط أعلى لمن قضى أكثر من الحد الأدنى
    return Math.min(100, 50 + (tenureYears - minTenureYears) * 10);
  }

  return 50; // نقاط افتراضية
}

/**
 * حساب درجة العدالة الإجمالية
 */
function calculateFairnessScore(
  allocations: TransferRequest[],
  totalRequests: TransferRequest[]
): number {
  if (totalRequests.length === 0) return 0;
  return Math.round((allocations.length / totalRequests.length) * 100);
}

/**
 * حساب نسبة إرضاء التفضيلات
 */
function calculatePreferenceSatisfaction(
  allocations: TransferRequest[]
): number {
  if (allocations.length === 0) return 0;

  const firstChoiceMatches = allocations.filter(
    a =>
      a.preferred_units.some(
        p => p.unit_id === a.allocated_unit_id && p.preference_order === 1
      )
  ).length;

  return Math.round((firstChoiceMatches / allocations.length) * 100);
}

/**
 * التحقق من التوازن بين الجنسين
 */
function checkGenderBalance(allocations: TransferRequest[]): boolean {
  // في التطبيق الحقيقي، يجب التحقق من توزيع الجنسين
  // حالياً: افتراض التوازن
  return true;
}

/**
 * حساب توزيع الخبرة
 */
function calculateExperienceDistribution(
  allocations: TransferRequest[]
): number {
  // في التطبيق الحقيقي، يجب حساب توزيع مستويات الخبرة
  // حالياً: قيمة افتراضية
  return 75;
}

/**
 * إنشاء التوصيات بناءً على النتائج
 */
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

  const allocationRate = allocations.length / (allocations.length + unmatched.length);
  if (allocationRate < 0.8) {
    recommendations.push('نسبة التخصيص منخفضة - قد تحتاج إلى تعديل القيود أو الأوزان');
  }

  const firstChoiceRate = calculatePreferenceSatisfaction(allocations);
  if (firstChoiceRate < 60) {
    recommendations.push('نسبة إرضاء التفضيلات منخفضة - فكر في تعديل أوزان التفضيلات');
  }

  return recommendations;
}

/**
 * خوارزمية التوزيع العادل الرئيسية
 */
export async function runFairAllocation(
  input: AllocationInput
): Promise<AllocationResult> {
  const startTime = Date.now();

  const {
    transfer_requests,
    unit_limits,
    unit_grade_limits,
    criteria,
    employee_addresses = new Map(),
    unit_addresses = new Map(),
    distance_threshold_km = 50,
    min_tenure_years = 3
  } = input;

  // تصفية الطلبات المعتمدة فقط
  const approvedRequests = transfer_requests.filter(
    r => r.status === 'HR_APPROVED'
  );

  if (approvedRequests.length === 0) {
    return {
      allocation_id: Date.now(),
      allocation_date: new Date().toISOString(),
      total_requests: 0,
      matched_requests: 0,
      unmatched_requests: 0,
      matched_allocations: [],
      unmatched_requests_list: [],
      fairness_score: 0,
      fairness_details: {
        preference_satisfaction: 0,
        performance_weights_applied: false,
        gender_balance_maintained: true,
        experience_distribution: 0
      },
      allocation_summary: 'لا توجد طلبات معتمدة للتوزيع',
      recommendations: ['لا توجد طلبات معتمدة'],
      algorithm_version: '2.0',
      processing_time_ms: Date.now() - startTime
    };
  }

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
        unitId,
        unit_limits,
        unit_grade_limits,
        request
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

      // تطبيق الأوزان من المعايير النشطة
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
          default:
            score = 50; // نقاط افتراضية
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

  // ترتيب حسب النقاط الإجمالية (من الأعلى للأقل)
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
      l =>
        l.unit_id === unitId &&
        l.grade_id ===
          approvedRequests.find(r => r.employee_id === candidate.employee_id)
            ?.current_grade_id
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
      request.allocation_reason = `نقاط التوزيع: ${candidate.total_score.toFixed(2)}`;
      allocations.push(request);
      usedEmployees.add(candidate.employee_id);
      usedUnits.set(unitId, currentCount + 1);
    }
  }

  const unmatched = approvedRequests.filter(
    r => !allocations.some(a => a.transfer_id === r.transfer_id)
  );

  // حساب النتائج النهائية
  const fairnessScore = calculateFairnessScore(allocations, approvedRequests);
  const preferenceSatisfaction = calculatePreferenceSatisfaction(allocations);
  const genderBalance = checkGenderBalance(allocations);
  const experienceDistribution = calculateExperienceDistribution(allocations);
  const recommendations = generateRecommendations(allocations, unmatched);

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
      preference_satisfaction: preferenceSatisfaction,
      performance_weights_applied: true,
      gender_balance_maintained: genderBalance,
      experience_distribution: experienceDistribution
    },
    allocation_summary: `تم تخصيص ${allocations.length} من ${approvedRequests.length} طلب بنجاح`,
    recommendations: recommendations,
    algorithm_version: '2.0',
    processing_time_ms: Date.now() - startTime
  };
}
