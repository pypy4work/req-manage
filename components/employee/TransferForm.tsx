import React, { useState, useEffect } from 'react';
import { TransferRequest, TransferPreference, RequestDefinition, FormField } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../ui/UIComponents';
import { useNotification } from '../ui/NotificationSystem';
import { api } from '../../services/api';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TransferFormProps {
  employeeId: number;
  onSubmit?: (transferRequest: TransferRequest) => void;
  templateId?: number;
  requestDefinition?: RequestDefinition; // NEW: Transfer request definition with config
}

/**
 * Sortable Preference Item Component
 */
const SortablePreferenceItem: React.FC<{
  preference: TransferPreference;
  index: number;
  units: any[];
  allPreferences: TransferPreference[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}> = ({ preference, index, units, allPreferences, onUpdate, onRemove, canRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: preference.preference_order });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-shrink-0 font-bold text-lg text-purple-600 w-8 h-8 flex items-center justify-center bg-purple-50 dark:bg-purple-900/30 rounded-full">
        {preference.preference_order}
      </div>
      <select
        value={preference.unit_id}
        onChange={(e) => onUpdate(index, 'unit_id', parseInt(e.target.value))}
        className="flex-1 p-2 border rounded-md bg-white dark:bg-slate-700 text-[var(--text-main)]"
        required
      >
        <option value={0}>-- اختر وحدة --</option>
        {units
          .filter(u => !allPreferences.some((p, i) => i !== index && p.unit_id === u.unit_id))
          .map(unit => (
            <option key={unit.unit_id} value={unit.unit_id}>
              {unit.unit_name}
            </option>
          ))}
      </select>
      {canRemove && (
        <Button
          type="button"
          onClick={() => onRemove(index)}
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

const DEFAULT_TRANSFER_FIELDS: FormField[] = [
  { id: 'reason_for_transfer', label: 'سبب التنقل', type: 'textarea', required: true, isVisible: true, isReadOnly: false },
  { id: 'willing_to_relocate', label: 'هل أنت مستعد للانتقال الجغرافي؟', type: 'boolean', required: false, isVisible: true, isReadOnly: false },
  { id: 'desired_start_date', label: 'التاريخ المطلوب للبدء', type: 'date', required: false, isVisible: true, isReadOnly: false },
  { id: 'additional_notes', label: 'ملاحظات إضافية', type: 'textarea', required: false, isVisible: true, isReadOnly: false }
];

/**
 * Transfer Request Form
 * Allows employees to submit transfer requests with multiple preferred units
 * Supports drag-and-drop ordering if enabled in request definition
 */
export const TransferForm: React.FC<TransferFormProps> = ({ 
  employeeId, 
  onSubmit,
  templateId = 9,
  requestDefinition
}) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<TransferPreference[]>([
    { unit_id: 0, preference_order: 1 }
  ]);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const base: Record<string, any> = {};
    DEFAULT_TRANSFER_FIELDS.forEach(f => {
      base[f.id] = f.type === 'boolean' ? false : '';
    });
    return base;
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Check if drag-and-drop is enabled
  const allowDragDrop = requestDefinition?.transfer_config?.preferred_units_field?.allow_drag_drop ?? true;
  const maxSelectable = requestDefinition?.transfer_config?.preferred_units_field?.max_selectable ?? 5;
  const fieldDescription = requestDefinition?.transfer_config?.preferred_units_field?.description || 
    'اختر الوحدات الإدارية المفضلة بترتيب الأولوية';
  const transferFields = (requestDefinition?.fields?.length ? requestDefinition.fields : DEFAULT_TRANSFER_FIELDS)
    .filter(field => field.isVisible !== false);
  const infoBarItems = (requestDefinition?.info_bar_content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  useEffect(() => {
    const base: Record<string, any> = {};
    (requestDefinition?.fields?.length ? requestDefinition.fields : DEFAULT_TRANSFER_FIELDS).forEach(f => {
      if (base[f.id] === undefined) {
        base[f.id] = f.type === 'boolean' ? false : '';
      }
    });
    setFormData(prev => ({ ...base, ...prev }));
  }, [requestDefinition?.id]);

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const unitsData = await api.admin.getOrgUnits(true);
        setUnits(unitsData);
      } catch (error) {
        console.error('Failed to load units', error);
        showNotification('خطأ في تحميل الوحدات الإدارية', 'error');
      }
    };
    loadUnits();
  }, []);

  const handleAddPreference = () => {
    if (preferences.length >= maxSelectable) {
      showNotification(`الحد الأقصى هو ${maxSelectable} وحدات`, 'error');
      return;
    }
    const nextOrder = Math.max(...preferences.map(p => p.preference_order), 0) + 1;
    setPreferences([
      ...preferences,
      { unit_id: 0, preference_order: nextOrder }
    ]);
  };

  const handleRemovePreference = (index: number) => {
    if (preferences.length > 1) {
      const updated = preferences.filter((_, i) => i !== index);
      // Reorder
      updated.forEach((p, i) => (p.preference_order = i + 1));
      setPreferences(updated);
    }
  };

  const handleUpdatePreference = (index: number, field: string, value: any) => {
    const updated = [...preferences];
    updated[index] = { ...updated[index], [field]: value };
    setPreferences(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPreferences(items => {
        const oldIndex = items.findIndex(item => item.preference_order === active.id);
        const newIndex = items.findIndex(item => item.preference_order === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update preference_order
        reordered.forEach((p, i) => (p.preference_order = i + 1));
        return reordered;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // التحقق من أن حقل الوحدات المفضلة مفعّل ومطلوب
      const isPreferredUnitsRequired = requestDefinition?.transfer_config?.preferred_units_field?.required ?? true;
      const isPreferredUnitsEnabled = requestDefinition?.transfer_config?.preferred_units_field?.enabled ?? true;
      
      // Validate preferences
      if (isPreferredUnitsEnabled && isPreferredUnitsRequired && preferences.some(p => p.unit_id === 0)) {
        showNotification('يجب اختيار جميع الوحدات المفضلة', 'error');
        setLoading(false);
        return;
      }

      // التحقق من الحد الأقصى
      if (isPreferredUnitsEnabled && preferences.length > maxSelectable) {
        showNotification(`الحد الأقصى للوحدات المفضلة هو ${maxSelectable}`, 'error');
        setLoading(false);
        return;
      }

      const missingFields = transferFields.filter(f => f.required && (formData[f.id] === '' || formData[f.id] === null || formData[f.id] === undefined));
      if (missingFields.length > 0) {
        showNotification('يرجى استكمال الحقول المطلوبة', 'error');
        setLoading(false);
        return;
      }

      // Call API to submit transfer request
      const response = await api.employee.submitTransferRequest({
        employee_id: employeeId,
        template_id: templateId,
        reason_for_transfer: formData.reason_for_transfer || '',
        willing_to_relocate: !!formData.willing_to_relocate,
        desired_start_date: formData.desired_start_date || undefined,
        additional_notes: formData.additional_notes || undefined,
        custom_dynamic_fields: formData,
        custom_data: { ...formData },
        preferred_units: isPreferredUnitsEnabled ? preferences.filter(p => p.unit_id !== 0) : []
      });

      showNotification('تم تقديم طلب التنقل بنجاح', 'success');
      if (onSubmit) onSubmit(response);
    } catch (error) {
      console.error('Failed to submit transfer request', error);
      showNotification('فشل تقديم الطلب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderTransferField = (field: FormField) => {
    const isWide = field.type === 'textarea' || field.type === 'text';
    const value = formData[field.id] ?? (field.type === 'boolean' ? false : '');

    let inputEl: React.ReactNode;
      if (field.type === 'boolean') {
      inputEl = (
        <select
          className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-[var(--text-main)]"
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value === '' ? undefined : e.target.value === 'true' })}
          disabled={field.isReadOnly}
          required={field.required}
        >
          <option value="">-- اختر --</option>
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      );
    } else if (field.type === 'textarea') {
      inputEl = (
        <div className="sca-textarea-wrapper w-full min-w-0">
          <textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            placeholder={field.label}
            required={field.required}
            readOnly={field.isReadOnly}
            className="sca-textarea w-full min-w-0 max-w-full box-border resize-y p-2 border rounded-md min-h-[120px] border-[var(--border-color)] bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
      );
    } else {
      inputEl = (
        <Input
          type={field.type === 'number' ? 'number' : field.type}
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
          required={field.required}
          readOnly={field.isReadOnly}
        />
      );
    }

    return (
      <div key={field.id} className={`${isWide ? 'md:col-span-2' : ''} w-full min-w-0`}>
        <label className="block text-sm font-medium mb-2">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        {inputEl}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📋 نموذج طلب التنقل</CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            تقديم طلب تنقل إلى وحدات أخرى مع تحديد الأولويات
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dynamic Transfer Fields */}
            {transferFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                {transferFields.filter(f => f.id !== 'preferred_units').map(renderTransferField)}
              </div>
            )}

            {/* Preferred Units - Only show if enabled in config */}
            {requestDefinition?.transfer_config?.preferred_units_field?.enabled !== false && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium">
                    الوحدات المفضلة
                    {requestDefinition?.transfer_config?.preferred_units_field?.required && <span className="text-red-500"> *</span>}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{fieldDescription}</p>
                </div>
                <Button
                  type="button"
                  onClick={handleAddPreference}
                  disabled={preferences.length >= maxSelectable}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  إضافة وحدة
                </Button>
              </div>
              
              {preferences.length >= maxSelectable && (
                <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    ⚠️ تم الوصول للحد الأقصى من الوحدات ({maxSelectable})
                  </p>
                </div>
              )}

              {allowDragDrop ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={preferences.map(p => p.preference_order)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {preferences.map((pref, index) => (
                        <SortablePreferenceItem
                          key={pref.preference_order}
                          preference={pref}
                          index={index}
                          units={units}
                          allPreferences={preferences}
                          onUpdate={handleUpdatePreference}
                          onRemove={handleRemovePreference}
                          canRemove={preferences.length > 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-3">
                  {preferences.map((pref, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex-shrink-0 font-bold text-lg text-purple-600 w-8 h-8 flex items-center justify-center bg-purple-50 dark:bg-purple-900/30 rounded-full">
                        {pref.preference_order}
                      </div>
                      <select
                        value={pref.unit_id}
                        onChange={(e) => handleUpdatePreference(index, 'unit_id', parseInt(e.target.value))}
                        className="flex-1 p-2 border rounded-md bg-white dark:bg-slate-700 text-[var(--text-main)]"
                        required
                      >
                        <option value={0}>-- اختر وحدة --</option>
                        {units
                          .filter(u => !preferences.some((p, i) => i !== index && p.unit_id === u.unit_id))
                          .map(unit => (
                            <option key={unit.unit_id} value={unit.unit_id}>
                              {unit.unit_name}
                            </option>
                          ))}
                      </select>
                      {preferences.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => handleRemovePreference(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {allowDragDrop && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" />
                  اسحب الوحدات لإعادة ترتيب الأولويات
                </p>
              )}
            </div>
            )}

            {/* Additional transfer fields can be configured from request definition */}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'جاري التقديم...' : 'تقديم طلب التنقل'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {infoBarItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">معلومات مهمة:</p>
                <ul className="list-disc list-inside space-y-1">
                  {infoBarItems.map((item, idx) => (
                    <li key={`${idx}-${item.slice(0, 20)}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransferForm;
