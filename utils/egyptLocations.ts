
// جداول مبسطة للمحافظات / المدن / الأحياء لتسهيل التجربة في الواجهة فقط
// يمكن لاحقاً ترحيلها لقاعدة البيانات بنفس البنية (governorate -> city -> district)

export interface Governorate {
  id: number;
  name_ar: string;
  name_en: string;
  code: string;
}

export interface City {
  id: number;
  governorateId: number;
  name_ar: string;
  name_en: string;
}

export interface District {
  id: number;
  cityId: number;
  name_ar: string;
  name_en: string;
}

export const GOVERNORATES: Governorate[] = [
  { id: 1, name_ar: 'القاهرة', name_en: 'Cairo', code: '11' },
  { id: 2, name_ar: 'الجيزة', name_en: 'Giza', code: '08' },
  { id: 3, name_ar: 'الإسكندرية', name_en: 'Alexandria', code: '06' },
  { id: 4, name_ar: 'السويس', name_en: 'Suez', code: '15' },
  { id: 5, name_ar: 'الإسماعيلية', name_en: 'Ismailia', code: '07' },
  { id: 6, name_ar: 'بورسعيد', name_en: 'Port Said', code: '19' },
  { id: 7, name_ar: 'شمال سيناء', name_en: 'North Sinai', code: '27' },
  { id: 8, name_ar: 'جنوب سيناء', name_en: 'South Sinai', code: '26' },
  { id: 9, name_ar: 'الدقهلية', name_en: 'Dakahlia', code: '01' },
  { id: 10, name_ar: 'البحر الأحمر', name_en: 'Red Sea', code: '02' },
  { id: 11, name_ar: 'البحيرة', name_en: 'Beheira', code: '03' },
  { id: 12, name_ar: 'الفيوم', name_en: 'Faiyum', code: '04' },
  { id: 13, name_ar: 'الغربية', name_en: 'Gharbia', code: '05' },
  { id: 14, name_ar: 'المنوفية', name_en: 'Monufia', code: '09' },
  { id: 15, name_ar: 'المنيا', name_en: 'Minya', code: '10' },
  { id: 16, name_ar: 'القليوبية', name_en: 'Qalyubia', code: '12' },
  { id: 17, name_ar: 'الوادي الجديد', name_en: 'New Valley', code: '13' },
  { id: 18, name_ar: 'الشرقية', name_en: 'Sharqia', code: '14' },
  { id: 19, name_ar: 'أسوان', name_en: 'Aswan', code: '16' },
  { id: 20, name_ar: 'أسيوط', name_en: 'Asyut', code: '17' },
  { id: 21, name_ar: 'بني سويف', name_en: 'Beni Suweif', code: '18' },
  { id: 22, name_ar: 'دمياط', name_en: 'Damietta', code: '20' },
  { id: 23, name_ar: 'كفر الشيخ', name_en: 'Kafr el-Sheikh', code: '21' },
  { id: 24, name_ar: 'مطروح', name_en: 'Matruh', code: '22' },
  { id: 25, name_ar: 'قنا', name_en: 'Qena', code: '23' },
  { id: 26, name_ar: 'سوهاج', name_en: 'Sohag', code: '24' },
  { id: 27, name_ar: 'الأقصر', name_en: 'Luxor', code: '28' }
];

export const CITIES: City[] = [
  // القاهرة
  { id: 101, governorateId: 1, name_ar: 'مصر الجديدة', name_en: 'Heliopolis' },
  { id: 102, governorateId: 1, name_ar: 'مدينة نصر', name_en: 'Nasr City' },
  { id: 103, governorateId: 1, name_ar: 'المعادي', name_en: 'Maadi' },
  { id: 104, governorateId: 1, name_ar: 'حلوان', name_en: 'Helwan' },
  // الجيزة
  { id: 201, governorateId: 2, name_ar: 'الجيزة', name_en: 'Giza' },
  { id: 202, governorateId: 2, name_ar: 'الدقي', name_en: 'Dokki' },
  { id: 203, governorateId: 2, name_ar: '6 أكتوبر', name_en: '6th of October' },
  { id: 204, governorateId: 2, name_ar: 'الشيخ زايد', name_en: 'Sheikh Zayed' },
  // الإسكندرية
  { id: 301, governorateId: 3, name_ar: 'حي شرق', name_en: 'East District' },
  { id: 302, governorateId: 3, name_ar: 'حي وسط', name_en: 'Central District' },
  { id: 303, governorateId: 3, name_ar: 'برج العرب', name_en: 'Borg El Arab' },
  // مدن القناة وسيناء
  { id: 401, governorateId: 4, name_ar: 'السويس', name_en: 'Suez' },
  { id: 501, governorateId: 5, name_ar: 'الإسماعيلية', name_en: 'Ismailia' },
  { id: 601, governorateId: 6, name_ar: 'بورسعيد', name_en: 'Port Said' },
  { id: 701, governorateId: 7, name_ar: 'العريش', name_en: 'Arish' },
  { id: 801, governorateId: 8, name_ar: 'شرم الشيخ', name_en: 'Sharm El Sheikh' }
];

export const DISTRICTS: District[] = [
  // أحياء / قرى القاهرة
  { id: 1001, cityId: 101, name_ar: 'روكسي', name_en: 'Roxy' },
  { id: 1002, cityId: 101, name_ar: 'الكوربة', name_en: 'Korba' },
  { id: 1003, cityId: 102, name_ar: 'الحي العاشر', name_en: '10th District' },
  { id: 1004, cityId: 102, name_ar: 'الحي السابع', name_en: '7th District' },
  { id: 1005, cityId: 103, name_ar: 'زهراء المعادي', name_en: 'Zahraa Maadi' },
  { id: 1006, cityId: 103, name_ar: 'المعادى الجديدة', name_en: 'New Maadi' },
  // الجيزة
  { id: 2001, cityId: 201, name_ar: 'الهرم', name_en: 'Haram' },
  { id: 2002, cityId: 201, name_ar: 'فيصل', name_en: 'Faisal' },
  { id: 2003, cityId: 203, name_ar: 'الحي الاول', name_en: '1st District' },
  { id: 2004, cityId: 203, name_ar: 'الحي الثاني', name_en: '2nd District' },
  // الإسكندرية
  { id: 3001, cityId: 301, name_ar: 'سيدي جابر', name_en: 'Sidi Gaber' },
  { id: 3002, cityId: 302, name_ar: 'محطة الرمل', name_en: 'Raml Station' },
  // مدن القناة / سيناء
  { id: 4001, cityId: 501, name_ar: 'التل الكبير', name_en: 'El Tell El Kebir' },
  { id: 4002, cityId: 601, name_ar: 'الزهور', name_en: 'El Zohour' },
  { id: 4003, cityId: 701, name_ar: 'بئر العبد', name_en: 'Bir El Abd' },
  { id: 4004, cityId: 801, name_ar: 'هضبة أم السيد', name_en: 'Hadaba Um Sid' }
];

export const getCitiesByGovernorate = (govName: string): City[] => {
  const gov = GOVERNORATES.find(g => g.name_ar === govName || g.name_en === govName);
  if (!gov) return [];
  return CITIES.filter(c => c.governorateId === gov.id);
};

export const getDistrictsByCity = (cityName: string, govName?: string): District[] => {
  let city: City | undefined;
  if (govName) {
    const gov = GOVERNORATES.find(g => g.name_ar === govName || g.name_en === govName);
    if (!gov) return [];
    city = CITIES.find(c => (c.name_ar === cityName || c.name_en === cityName) && c.governorateId === gov.id);
  } else {
    city = CITIES.find(c => c.name_ar === cityName || c.name_en === cityName);
  }
  if (!city) return [];
  return DISTRICTS.filter(d => d.cityId === city.id);
};
