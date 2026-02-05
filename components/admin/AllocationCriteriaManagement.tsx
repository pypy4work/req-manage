import React, { useState, useEffect } from 'react';
import { AllocationCriteria, OrganizationalUnit, SystemSettings } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../ui/UIComponents';
import { Save, Edit2, AlertCircle, TrendingUp, Building2 } from 'lucide-react';
import { useNotification } from '../ui/NotificationSystem';

/**
 * نافذة إدارة معايير التوزيع العادل
 * تسمح للمسؤول بتعديل الأوزان وتفعيل/تعطيل المعايير
 */
export const AllocationCriteriaManagement: React.FC = () => {
  const { showNotification } = useNotification();
  const [criteria, setCriteria] = useState<AllocationCriteria[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([]);
  const [savingUnits, setSavingUnits] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMethod, setNewMethod] = useState('custom');
  const [newWeight, setNewWeight] = useState(0.1);

  useEffect(() => {
    loadCriteria();
  }, []);

  useEffect(() => {
    api.admin.getSettings().then(setSettings);
    api.admin.getOrgUnits(false).then((u: any[]) => setOrgUnits(u || []));
  }, []);

  useEffect(() => {
    const sum = criteria
      .filter(c => c.is_active)
      .reduce((acc, c) => acc + c.weight, 0);
    setTotalWeight(sum);
  }, [criteria]);

  const loadCriteria = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getAllocationCriteria();
      setCriteria(data);
    } catch (error) {
      console.error('Failed to load criteria', error);
      showNotification('خطأ في تحميل المعايير', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (id: number, newWeight: number) => {
    const updatedWeight = Math.max(0, Math.min(1, newWeight));
    setCriteria(
      criteria.map(c =>
        c.criteria_id === id ? { ...c, weight: updatedWeight } : c
      )
    );
  };

  const handleToggleActive = (id: number) => {
    setCriteria(
      criteria.map(c =>
        c.criteria_id === id ? { ...c, is_active: !c.is_active } : c
      )
    );
  };

  const handleSave = async () => {
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      showNotification(
        `إجمالي الأوزان يجب أن يكون 1.00 (الحالي: ${totalWeight.toFixed(2)})`,
        'error'
      );
      return;
    }

    try {
      setSaving(true);
      for (const criterion of criteria) {
        await api.admin.updateAllocationCriteria(criterion);
      }
      showNotification('تم حفظ المعايير بنجاح', 'success');
      loadCriteria();
    } catch (error) {
      console.error('Failed to save criteria', error);
      showNotification('فشل حفظ المعايير', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTransferUnits = async () => {
    if (!settings) return;
    try {
      setSavingUnits(true);
      await api.admin.updateSettings(settings);
      showNotification('تم حفظ إعدادات الوحدات بنجاح', 'success');
    } catch (error) {
      console.error('Failed to save transfer units', error);
      showNotification('فشل حفظ إعدادات الوحدات', 'error');
    } finally {
      setSavingUnits(false);
    }
  };

  const normalizeWeights = () => {
    const activeCriteria = criteria.filter(c => c.is_active);
    const currentSum = activeCriteria.reduce((acc, c) => acc + c.weight, 0);
    
    if (currentSum === 0) {
      showNotification('لا يمكن تطبيع الأوزان - لا توجد معايير نشطة', 'error');
      return;
    }

    const normalized = criteria.map(c => {
      if (!c.is_active) return c;
      return {
        ...c,
        weight: c.weight / currentSum
      };
    });

    setCriteria(normalized);
    showNotification('تم تطبيع الأوزان تلقائياً', 'success');
  };

  const handleAddCriterion = async () => {
    if (!newName.trim()) {
      showNotification('أدخل اسم المعيار أولاً', 'error');
      return;
    }
    const base: AllocationCriteria = {
      criteria_id: 0,
      criterion_name: newName.trim(),
      description: newDescription.trim() || undefined,
      calculation_method: newMethod || 'custom',
      weight: Math.max(0, Math.min(1, newWeight || 0)),
      is_active: true
    };
    try {
      const created = await api.admin.updateAllocationCriteria(base);
      setCriteria(prev => [...prev, created]);
      setNewName('');
      setNewDescription('');
      setNewMethod('custom');
      setNewWeight(0.1);
      showNotification('تم إضافة المعيار بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showNotification('فشل إضافة المعيار', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-emerald-500 shadow-lg">
        <CardHeader className="bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Building2 className="w-5 h-5" /> الوحدات المتاحة للنقل
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            حدد الوحدات الإدارية التي تظهر للموظف عند تقديم طلب النقل. إذا لم تختر أي وحدة، تظهر جميع الوحدات.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {!settings ? (
            <div className="text-sm text-[var(--text-muted)]">جاري تحميل إعدادات النقل...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto custom-scrollbar p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-body)]/50">
                {orgUnits.map((u) => {
                  const ids = settings?.transfer_eligible_unit_ids ?? [];
                  const checked = ids.length === 0 || ids.includes(u.unit_id);
                  const toggle = () => {
                    if (!settings) return;
                    const currentSet = ids.length === 0 ? orgUnits.map(x => x.unit_id) : ids;
                    const next = checked
                      ? currentSet.filter(id => id !== u.unit_id)
                      : [...currentSet, u.unit_id];
                    setSettings({ ...settings, transfer_eligible_unit_ids: next.length === 0 ? undefined : next });
                  };
                  return (
                    <label key={u.unit_id} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                      <input type="checkbox" checked={checked} onChange={toggle} className="rounded" />
                      <span className="text-sm font-medium">{u.unit_name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveTransferUnits} isLoading={savingUnits}>
                  حفظ إعدادات الوحدات
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            إدارة معايير التوزيع العادل
          </CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            قم بتعديل أوزان المعايير لتحسين نتائج التوزيع. يجب أن يكون مجموع الأوزان النشطة = 1.00
          </p>
        </CardHeader>
        <CardContent>
          {/* إضافة معيار جديد */}
          <div className="mb-8 p-4 border border-dashed border-purple-300 rounded-xl bg-purple-50/40 dark:bg-purple-900/10 space-y-3">
            <div className="font-bold text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              إضافة معيار توزيع جديد
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">اسم المعيار</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: استيعاب الاستراحات"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">طريقة الحساب</label>
                <Input
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value)}
                  placeholder="مثال: rest_capacity_score"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">الوزن الابتدائي</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={newWeight}
                  onChange={(e) => setNewWeight(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">وصف مختصر (اختياري)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="شرح كيفية حساب هذا المعيار"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddCriterion}>
                إضافة معيار
              </Button>
            </div>
          </div>

          {/* مؤشر الأوزان */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[var(--text-main)]">
                إجمالي الأوزان النشطة:
              </span>
              <span
                className={`text-2xl font-bold ${
                  Math.abs(totalWeight - 1.0) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {totalWeight.toFixed(2)}
              </span>
            </div>
            {Math.abs(totalWeight - 1.0) > 0.01 && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>
                  يجب أن يكون المجموع = 1.00 (الفرق: {(totalWeight - 1.0).toFixed(2)})
                </span>
              </div>
            )}
            <div className="mt-3">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    Math.abs(totalWeight - 1.0) < 0.01
                      ? 'bg-green-500'
                      : totalWeight > 1.0
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min(100, totalWeight * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* قائمة المعايير */}
          <div className="space-y-4">
            {criteria.map(criterion => (
              <div
                key={criterion.criteria_id}
                className={`border rounded-lg p-4 transition-all ${
                  criterion.is_active
                    ? 'bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[var(--text-main)]">
                        {criterion.criterion_name}
                      </h4>
                      {!criterion.is_active && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                          معطّل
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {criterion.description || 'لا يوجد وصف'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      طريقة الحساب: {criterion.calculation_method}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={criterion.is_active}
                      onChange={() => handleToggleActive(criterion.criteria_id)}
                      className="w-5 h-5 rounded text-purple-600 cursor-pointer"
                    />
                    <label className="text-sm cursor-pointer">نشط</label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                      الوزن (0.0 - 1.0)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={criterion.weight}
                        onChange={e =>
                          handleWeightChange(
                            criterion.criteria_id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={!criterion.is_active}
                        className="w-32"
                      />
                      <span className="text-sm text-gray-500">
                        ({Math.round(criterion.weight * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${
                          criterion.is_active
                            ? 'bg-purple-600'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${criterion.weight * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSave}
              disabled={saving || Math.abs(totalWeight - 1.0) > 0.01}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
            <Button
              onClick={normalizeWeights}
              variant="outline"
              className="flex-1"
            >
              تطبيع الأوزان تلقائياً
            </Button>
          </div>

          {/* معلومات إضافية */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h5 className="font-bold text-sm text-blue-900 dark:text-blue-200 mb-2">
              💡 نصائح:
            </h5>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>تأكد من أن مجموع الأوزان النشطة = 1.00 قبل الحفظ</li>
              <li>استخدم "تطبيع الأوزان" لتوزيع الأوزان تلقائياً</li>
              <li>يمكنك تعطيل معايير غير مرغوبة بدلاً من حذفها</li>
              <li>الأوزان الأعلى تعطي أولوية أكبر لذلك المعيار</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AllocationCriteriaManagement;
