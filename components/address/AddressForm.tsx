import React, { useState, useEffect } from 'react';
import { Address } from '../../types';
import { Input, Button } from '../ui/UIComponents';
import { MapPin, Navigation } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GOVERNORATES, getCitiesByGovernorate, getDistrictsByCity } from '../../utils/egyptLocations';

interface AddressFormProps {
  address?: Address;
  onChange: (address: Address) => void;
  showCoordinates?: boolean;
  entityType: 'EMPLOYEE_RESIDENCE' | 'EMPLOYEE_BIRTHPLACE' | 'ORG_UNIT';
  entityId: number;
  required?: boolean;
}

/**
 * مكون إدخال العنوان الهجين
 * يدعم جميع الحقول المطلوبة + إحداثيات GPS
 */
export const AddressForm: React.FC<AddressFormProps> = ({ 
  address, 
  onChange, 
  showCoordinates = true,
  entityType,
  entityId,
  required = false
}) => {
  const { t, dir } = useLanguage();
  const [formData, setFormData] = useState<Address>(address || {
    entity_type: entityType,
    entity_id: entityId,
    governorate: '',
    city: '',
    district: '',
    street: '',
    building: '',
    apartment: '',
    longitude: undefined,
    latitude: undefined
  });

  // قوائم مرتبطة بالمحافظة / المدينة لتسهيل التجربة
  const citiesOptions = getCitiesByGovernorate(formData.governorate);
  const districtsOptions = getDistrictsByCity(formData.city, formData.governorate);

  useEffect(() => {
    if (address) {
      setFormData(address);
    }
  }, [address]);

  const handleChange = (field: keyof Address, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated);
  };

  const handleGetCoordinates = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleChange('latitude', parseFloat(position.coords.latitude.toFixed(7)));
          handleChange('longitude', parseFloat(position.coords.longitude.toFixed(7)));
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('فشل الحصول على الموقع. يرجى إدخال الإحداثيات يدوياً.');
        }
      );
    } else {
      alert('المتصفح لا يدعم تحديد الموقع. يرجى إدخال الإحداثيات يدوياً.');
    }
  };

  const getAddressLabel = () => {
    switch (entityType) {
      case 'EMPLOYEE_RESIDENCE':
        return 'عنوان محل الإقامة';
      case 'EMPLOYEE_BIRTHPLACE':
        return 'محل الميلاد';
      case 'ORG_UNIT':
        return 'عنوان الوحدة الإدارية';
      default:
        return 'العنوان';
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-lg">{getAddressLabel()}</h3>
      </div>

      {/* المحافظة والمدينة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
            المحافظة {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={formData.governorate}
            onChange={(e) => {
              const newGov = e.target.value;
              // عند تغيير المحافظة نفرغ المدينة والحي لتجنب تعارض البيانات
              setFormData(prev => {
                const updated: Address = {
                  ...prev,
                  governorate: newGov,
                  city: '',
                  district: ''
                };
                onChange(updated);
                return updated;
              });
            }}
            required={required}
            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
            المدينة/المركز {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={formData.city}
            onChange={(e) => {
              const newCity = e.target.value;
              setFormData(prev => {
                const updated: Address = {
                  ...prev,
                  city: newCity,
                  district: ''
                };
                onChange(updated);
                return updated;
              });
            }}
            required={required}
            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-slate-900 text-sm"
            disabled={!formData.governorate}
          >
            <option value="">{formData.governorate ? 'اختر المدينة/المركز' : 'اختر المحافظة أولاً'}</option>
            {citiesOptions.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* الحي/القرية */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
          الحي/القرية {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={formData.district}
          onChange={(e) => handleChange('district', e.target.value)}
          required={required}
          className="w-full border rounded-md px-3 py-2 bg-white dark:bg-slate-900 text-sm"
          disabled={!formData.city}
        >
          <option value="">{formData.city ? 'اختر الحي/القرية' : 'اختر المدينة أولاً'}</option>
          {districtsOptions.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* الشارع والعقار */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
            الشارع
          </label>
          <Input
            value={formData.street || ''}
            onChange={(e) => handleChange('street', e.target.value)}
            placeholder="اسم الشارع"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
            العقار
          </label>
          <Input
            value={formData.building || ''}
            onChange={(e) => handleChange('building', e.target.value)}
            placeholder="رقم/اسم العقار"
            className="w-full"
          />
        </div>
      </div>

      {/* الشقة */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">
          الشقة
        </label>
        <Input
          value={formData.apartment || ''}
          onChange={(e) => handleChange('apartment', e.target.value)}
          placeholder="رقم الشقة"
          className="w-full"
        />
      </div>

      {/* الإحداثيات */}
      {showCoordinates && (
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-green-600" />
            <label className="block text-sm font-medium text-[var(--text-main)]">
              إحداثيات الموقع (GPS)
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">خط العرض (Latitude)</label>
              <Input
                type="number"
                step="any"
                value={formData.latitude || ''}
                onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="30.0444"
                className="w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">خط الطول (Longitude)</label>
              <Input
                type="number"
                step="any"
                value={formData.longitude || ''}
                onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="31.2357"
                className="w-full text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleGetCoordinates}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Navigation className="w-4 h-4 mr-2" />
                الحصول على الإحداثيات
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 الإحداثيات تستخدم لحساب المسافة بين موقع العمل ومحل الإقامة
          </p>
        </div>
      )}

      {/* معاينة العنوان الكامل */}
      {(formData.governorate || formData.city || formData.district) && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">معاينة العنوان:</p>
          <p className="text-sm text-blue-900 dark:text-blue-200">
            {[
              formData.governorate,
              formData.city,
              formData.district,
              formData.street,
              formData.building,
              formData.apartment
            ].filter(Boolean).join('، ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressForm;
