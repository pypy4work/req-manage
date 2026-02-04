// جداول مبسطة للمحافظات / المدن / الأحياء لتسهيل التجربة في الواجهة فقط
// يمكن لاحقاً ترحيلها لقاعدة البيانات بنفس البنية (governorate -> city -> district)

export interface Governorate {
  id: number;
  name: string;
}

export interface City {
  id: number;
  governorateId: number;
  name: string;
}

export interface District {
  id: number;
  cityId: number;
  name: string;
}

export const GOVERNORATES: Governorate[] = [
  { id: 1, name: 'القاهرة' },
  { id: 2, name: 'الجيزة' },
  { id: 3, name: 'الإسكندرية' },
  { id: 4, name: 'السويس' },
  { id: 5, name: 'الإسماعيلية' },
  { id: 6, name: 'بورسعيد' },
  { id: 7, name: 'شمال سيناء' },
  { id: 8, name: 'جنوب سيناء' }
  // يمكن استكمال باقي المحافظات لاحقاً
];

export const CITIES: City[] = [
  // القاهرة
  { id: 101, governorateId: 1, name: 'مصر الجديدة' },
  { id: 102, governorateId: 1, name: 'مدينة نصر' },
  { id: 103, governorateId: 1, name: 'المعادي' },
  { id: 104, governorateId: 1, name: 'حلوان' },
  // الجيزة
  { id: 201, governorateId: 2, name: 'الجيزة' },
  { id: 202, governorateId: 2, name: 'الدقي' },
  { id: 203, governorateId: 2, name: '6 أكتوبر' },
  { id: 204, governorateId: 2, name: 'الشيخ زايد' },
  // الإسكندرية
  { id: 301, governorateId: 3, name: 'حي شرق' },
  { id: 302, governorateId: 3, name: 'حي وسط' },
  { id: 303, governorateId: 3, name: 'برج العرب' },
  // مدن القناة وسيناء (أمثلة)
  { id: 401, governorateId: 4, name: 'السويس' },
  { id: 501, governorateId: 5, name: 'الإسماعيلية' },
  { id: 601, governorateId: 6, name: 'بورسعيد' },
  { id: 701, governorateId: 7, name: 'العريش' },
  { id: 801, governorateId: 8, name: 'شرم الشيخ' }
];

export const DISTRICTS: District[] = [
  // أحياء / قرى القاهرة
  { id: 1001, cityId: 101, name: 'روكسي' },
  { id: 1002, cityId: 101, name: 'الكوربة' },
  { id: 1003, cityId: 102, name: 'الحي العاشر' },
  { id: 1004, cityId: 102, name: 'الحي السابع' },
  { id: 1005, cityId: 103, name: 'زهراء المعادي' },
  { id: 1006, cityId: 103, name: 'المعادى الجديدة' },
  // الجيزة
  { id: 2001, cityId: 201, name: 'الهرم' },
  { id: 2002, cityId: 201, name: 'فيصل' },
  { id: 2003, cityId: 203, name: 'الحي الاول' },
  { id: 2004, cityId: 203, name: 'الحي الثاني' },
  // الإسكندرية
  { id: 3001, cityId: 301, name: 'سيدي جابر' },
  { id: 3002, cityId: 302, name: 'محطة الرمل' },
  // مدن القناة / سيناء
  { id: 4001, cityId: 501, name: 'التل الكبير' },
  { id: 4002, cityId: 601, name: 'الزهور' },
  { id: 4003, cityId: 701, name: 'بئر العبد' },
  { id: 4004, cityId: 801, name: 'هضبة أم السيد' }
];

export const getCitiesByGovernorate = (governorateName: string): City[] => {
  const gov = GOVERNORATES.find(g => g.name === governorateName);
  if (!gov) return [];
  return CITIES.filter(c => c.governorateId === gov.id);
};

export const getDistrictsByCity = (cityName: string, governorateName?: string): District[] => {
  let city: City | undefined;
  if (governorateName) {
    const gov = GOVERNORATES.find(g => g.name === governorateName);
    if (!gov) return [];
    city = CITIES.find(c => c.name === cityName && c.governorateId === gov.id);
  } else {
    city = CITIES.find(c => c.name === cityName);
  }
  if (!city) return [];
  return DISTRICTS.filter(d => d.cityId === city.id);
};

