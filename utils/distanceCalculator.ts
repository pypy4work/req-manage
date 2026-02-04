/**
 * Utility functions for calculating distances between geographic coordinates
 * Uses Haversine formula for great-circle distance calculation
 */

/**
 * حساب المسافة بين إحداثيين جغرافيين باستخدام صيغة Haversine
 * @param lat1 خط عرض النقطة الأولى
 * @param lon1 خط طول النقطة الأولى
 * @param lat2 خط عرض النقطة الثانية
 * @param lon2 خط طول النقطة الثانية
 * @returns المسافة بالكيلومترات
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // التحقق من صحة الإحداثيات
  if (
    !lat1 || !lon1 || !lat2 || !lon2 ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return 0;
  }

  // نصف قطر الأرض بالكيلومترات
  const R = 6371;

  // تحويل الدرجات إلى راديان
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  // صيغة Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // تقريب إلى رقمين عشريين
}

/**
 * تحويل الدرجات إلى راديان
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * حساب المسافة بين عنوانين
 * @param address1 العنوان الأول
 * @param address2 العنوان الثاني
 * @returns المسافة بالكيلومترات، أو null إذا لم تكن الإحداثيات متوفرة
 */
export function calculateAddressDistance(
  address1: { latitude?: number; longitude?: number },
  address2: { latitude?: number; longitude?: number }
): number | null {
  if (
    !address1.latitude ||
    !address1.longitude ||
    !address2.latitude ||
    !address2.longitude
  ) {
    return null;
  }

  return calculateDistance(
    address1.latitude,
    address1.longitude,
    address2.latitude,
    address2.longitude
  );
}

/**
 * تحديد ما إذا كانت المسافة تتجاوز العتبة المحددة
 * @param distance المسافة بالكيلومترات
 * @param threshold العتبة بالكيلومترات (افتراضي: 50)
 * @returns true إذا تجاوزت المسافة العتبة
 */
export function exceedsDistanceThreshold(
  distance: number | null,
  threshold: number = 50
): boolean {
  if (distance === null) return false;
  return distance > threshold;
}

/**
 * حساب نقاط الأولوية بناءً على المسافة
 * @param distance المسافة بالكيلومترات
 * @param threshold العتبة بالكيلومترات
 * @param maxBonus النقاط الإضافية القصوى (افتراضي: 30)
 * @returns نقاط الأولوية (0-100)
 */
export function calculateDistancePriorityScore(
  distance: number | null,
  threshold: number = 50,
  maxBonus: number = 30
): number {
  if (distance === null) return 50; // نقاط افتراضية

  if (distance <= threshold) {
    return 50; // لا توجد أولوية إضافية
  }

  // حساب النقاط الإضافية بناءً على المسافة الزائدة
  const excessDistance = distance - threshold;
  const bonus = Math.min(maxBonus, (excessDistance / 10) * 5); // 5 نقاط لكل 10 كيلومترات

  return Math.min(100, 50 + bonus);
}
