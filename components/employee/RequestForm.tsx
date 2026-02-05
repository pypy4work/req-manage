
import React, { useState, useEffect } from 'react';
import { User, RequestDefinition, UploadedFile, FormField, ComputedOperandDef, GenericRequest, TransferPreference } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, Button, Input } from '../../components/ui/UIComponents';
import { useNotification } from '../../components/ui/NotificationSystem';
import { AlertCircle, Calculator, FileText, UploadCloud, X, CheckCircle2, Calendar, Clock, Edit2, Plus, Trash2, GripVertical } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
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

interface Props {
  user: User;
  requestTypes: RequestDefinition[];
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: GenericRequest; // NEW: Support editing mode
}

  // Sortable Preference Item Component (for use inside RequestForm)
  const SortablePreferenceItemInForm = React.memo<{
    preference: TransferPreference;
    index: number;
    units: any[];
    allPreferences: TransferPreference[];
    onUpdate: (index: number, field: string, value: any) => void;
    onRemove: (index: number) => void;
    canRemove: boolean;
    required: boolean;
  }>(({ preference, index, units, allPreferences, onUpdate, onRemove, canRemove, required }) => {
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
        required={required}
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
  });

export const RequestForm: React.FC<Props> = ({ user, requestTypes, onSuccess, onCancel, initialData }) => {
  const [selectedTypeId, setSelectedTypeId] = useState<number>(requestTypes.length > 0 ? requestTypes[0].id : 0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [calculatedDuration, setCalculatedDuration] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Transfer-specific fields
  const [preferredUnits, setPreferredUnits] = useState<TransferPreference[]>([
    { unit_id: 0, preference_order: 1 }
  ]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [transferFormData, setTransferFormData] = useState({
    reason_for_transfer: '',
    willing_to_relocate: false,
    desired_start_date: '',
    additional_notes: ''
  });
  
  const { notify } = useNotification();
  const { t, dir } = useLanguage();

  const isEditMode = !!initialData;
  const currentType = requestTypes.find(t => t.id === Number(selectedTypeId));
  const isTransferType = currentType?.is_transfer_type === true;
  const transferFieldIds = new Set(['reason_for_transfer', 'willing_to_relocate', 'desired_start_date', 'additional_notes']);
  const hasTransferFieldsInConfig = isTransferType && (currentType?.fields || []).some(f => transferFieldIds.has(f.id));
  const infoBarItems = (currentType?.info_bar_content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const SELECT_BASE_CLASS = "w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30";
  
  // Drag and drop sensors for transfer preferences
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Reset transfer fields when type changes
  useEffect(() => {
    if (!isTransferType) {
      setPreferredUnits([{ unit_id: 0, preference_order: 1 }]);
      setTransferFormData({
        reason_for_transfer: '',
        willing_to_relocate: false,
        desired_start_date: '',
        additional_notes: ''
      });
    }
  }, [isTransferType]);

  // Init Data for Edit Mode
  useEffect(() => {
      if (initialData) {
          setSelectedTypeId(Number(initialData.leave_type_id || initialData.type_id));
          setStartDate(initialData.start_date || '');
          setEndDate(initialData.end_date || '');
          setStartTime(initialData.start_time || '');
          setEndTime(initialData.end_time || '');
          setCustomData(initialData.custom_data || {});
          setCalculatedDuration(initialData.duration || 0);
          const data = initialData as any;
          const cd = data.custom_data || {};
          if (data.transfer_id != null || (cd.preferred_units && Array.isArray(cd.preferred_units))) {
              const prefs = cd.preferred_units && cd.preferred_units.length
                  ? cd.preferred_units.map((p: any, i: number) => ({ unit_id: p.unit_id || 0, preference_order: p.preference_order ?? i + 1 }))
                  : [{ unit_id: 0, preference_order: 1 }];
              setPreferredUnits(prefs);
              setTransferFormData({
                  reason_for_transfer: cd.reason_for_transfer ?? data.reason_for_transfer ?? '',
                  willing_to_relocate: cd.willing_to_relocate ?? data.willing_to_relocate ?? false,
                  desired_start_date: cd.desired_start_date ?? data.desired_start_date ?? '',
                  additional_notes: cd.additional_notes ?? data.additional_notes ?? ''
              });
          }
      } else {
          // Reset fields when type changes IF not in edit mode (or clean slate)
          setStartDate('');
          setEndDate('');
          setStartTime('');
          setEndTime('');
          setCalculatedDuration(0);
          setCustomData({});
          setUploadedFiles([]);
      }
  }, [initialData, selectedTypeId]); // React to type change or init data

  // Load org units when transfer type is selected (filtered by admin selection)
  useEffect(() => {
    if (isTransferType && orgUnits.length === 0) {
      const loadUnits = async () => {
        try {
          const unitsData = await api.admin.getOrgUnits(true);
          setOrgUnits(unitsData);
        } catch (error) {
          console.error('Failed to load units', error);
        }
      };
      loadUnits();
    }
  }, [isTransferType]);

  useEffect(() => {
    if (!currentType) return;
    
    // --- Duration Logic (Core Fields) ---
    let currentCalcDuration = 0;
    
    if (currentType.unit === 'days') {
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          // Inclusive calculation: (End - Start) + 1 day
          const diffTime = Math.abs(end.getTime() - start.getTime());
          currentCalcDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
      } else if (startDate && !endDate) {
          // If end date missing, assume 1 day visually, but validation handles requirement
          currentCalcDuration = 1;
      }
    } else if (currentType.unit === 'hours') {
      if (startDate && startTime && endTime) { // Date is required for hours too
        const [h1, m1] = startTime.split(':').map(Number);
        const [h2, m2] = endTime.split(':').map(Number);
        const dateBase = new Date(startDate);
        
        const d1 = new Date(dateBase.setHours(h1, m1));
        const d2 = new Date(dateBase.setHours(h2, m2));
        
        if(d2 > d1) {
            const diffMs = d2.getTime() - d1.getTime();
            currentCalcDuration = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }
      }
    }
    setCalculatedDuration(currentCalcDuration);

    // --- Dynamic Fields Calculation Logic ---
    // (Existing logic for computed fields remains here...)
    // ...
  }, [startDate, endDate, startTime, endTime, currentType, customData, user]);

  const handleFileUpload = (docId: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) {
              const newFile: UploadedFile = {
                  fileId: `file_${Date.now()}`,
                  documentId: docId,
                  fileName: file.name,
                  fileUrl: ev.target.result as string,
                  mimeType: file.type
              };
              setUploadedFiles(prev => [...prev.filter(f => f.documentId !== docId), newFile]);
          }
      };
      reader.readAsDataURL(file);
  };

  const removeFile = (docId: number) => {
      setUploadedFiles(prev => prev.filter(f => f.documentId !== docId));
  };

  // Transfer-specific handlers
  const handleAddPreference = () => {
    const maxSelectable = currentType?.transfer_config?.preferred_units_field?.max_selectable ?? 5;
    if (preferredUnits.length >= maxSelectable) {
      notify({ type: 'warning', title: 'حد أقصى', message: `الحد الأقصى هو ${maxSelectable} وحدات` });
      return;
    }
    const nextOrder = Math.max(...preferredUnits.map(p => p.preference_order), 0) + 1;
    setPreferredUnits([...preferredUnits, { unit_id: 0, preference_order: nextOrder }]);
  };

  const handleRemovePreference = (index: number) => {
    if (preferredUnits.length > 1) {
      const updated = preferredUnits.filter((_, i) => i !== index);
      updated.forEach((p, i) => (p.preference_order = i + 1));
      setPreferredUnits(updated);
    }
  };

  const handleUpdatePreference = (index: number, field: string, value: any) => {
    const updated = [...preferredUnits];
    updated[index] = { ...updated[index], [field]: value };
    setPreferredUnits(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPreferredUnits(items => {
        const oldIndex = items.findIndex(item => item.preference_order === active.id);
        const newIndex = items.findIndex(item => item.preference_order === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        reordered.forEach((p, i) => (p.preference_order = i + 1));
        return reordered;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentType) return;
    
    // Validation for transfer type
    if (isTransferType) {
      const isPreferredUnitsRequired = currentType.transfer_config?.preferred_units_field?.required ?? true;
      const isPreferredUnitsEnabled = currentType.transfer_config?.preferred_units_field?.enabled ?? true;
      
      if (isPreferredUnitsEnabled && isPreferredUnitsRequired && preferredUnits.some(p => p.unit_id === 0)) {
        notify({ type: 'warning', title: 'تحذير', message: 'يجب اختيار جميع الوحدات المفضلة' });
        return;
      }
      
      if (hasTransferFieldsInConfig) {
        const requiredFields = (currentType.fields || []).filter(f => transferFieldIds.has(f.id) && f.required);
        const missingTransfer = requiredFields.filter(f => customData[f.id] === '' || customData[f.id] === null || customData[f.id] === undefined);
        if (missingTransfer.length > 0) {
          notify({ type: 'warning', title: 'تحذير', message: 'يرجى استكمال الحقول المطلوبة في طلب النقل' });
          return;
        }
      } else if (!transferFormData.reason_for_transfer.trim()) {
        notify({ type: 'warning', title: 'تحذير', message: 'يجب إدخال سبب التنقل' });
        return;
      }
    }
    
    // Validation
    if (currentType.unit === 'days' && (!startDate || !endDate)) {
        notify({ type: 'warning', title: t('warning'), message: 'Please select Start and End dates.' });
        return;
    }
    if (currentType.unit === 'hours' && (!startDate || !startTime || !endTime)) {
        notify({ type: 'warning', title: t('warning'), message: 'Please select Date, Start Time and End Time.' });
        return;
    }
    if ((currentType.unit === 'days' || currentType.unit === 'hours') && calculatedDuration <= 0) { 
        notify({ type: 'warning', title: t('warning'), message: 'Invalid Duration.' }); 
        return; 
    }
    
    const missingDocs = (currentType.documents || []).filter(doc => doc.required && !uploadedFiles.some(f => f.documentId === doc.id) && !isEditMode);
    if (missingDocs.length > 0) {
        notify({ type: 'warning', title: 'Missing Documents', message: `Please upload: ${missingDocs.map(d => d.label).join(', ')}` });
        return;
    }

    setIsSubmitting(true);
    
    try {
        // For transfer type, use transfer API or update
        if (isTransferType) {
          const preferredUnitsFiltered = preferredUnits.filter(p => p.unit_id !== 0);
          const transferDataSource = hasTransferFieldsInConfig ? customData : transferFormData;
          if (isEditMode && initialData) {
            await api.employee.updateRequest(initialData.request_id, {
              reason_for_transfer: transferDataSource.reason_for_transfer || '',
              willing_to_relocate: !!transferDataSource.willing_to_relocate,
              desired_start_date: transferDataSource.desired_start_date || undefined,
              additional_notes: transferDataSource.additional_notes || undefined,
              preferred_units: preferredUnitsFiltered,
              custom_data: {
                ...(initialData.custom_data || {}),
                ...transferDataSource,
                preferred_units: preferredUnitsFiltered
              }
            });
            notify({ type: 'success', title: 'نجح', message: 'تم تحديث طلب التنقل بنجاح' });
          } else {
            const transferPayload = {
              employee_id: user.employee_id || user.user_id,
              template_id: currentType.id,
              reason_for_transfer: transferDataSource.reason_for_transfer || '',
              willing_to_relocate: !!transferDataSource.willing_to_relocate,
              desired_start_date: transferDataSource.desired_start_date || undefined,
              additional_notes: transferDataSource.additional_notes || undefined,
              preferred_units: preferredUnitsFiltered,
              custom_dynamic_fields: transferDataSource,
              custom_data: { ...transferDataSource, preferred_units: preferredUnitsFiltered }
            };
            await api.employee.submitTransferRequest(transferPayload);
            notify({ type: 'success', title: 'نجح', message: 'تم تقديم طلب التنقل بنجاح' });
          }
          onSuccess();
          return;
        }
        
        // Regular request submission
        const payload = {
          user_id: user.user_id,
          employee_id: user.employee_id,
          employee_name: user.full_name,
          leave_type_id: currentType.id, 
          leave_name: currentType.name,
          duration: calculatedDuration,
          unit: currentType.unit,
          start_date: startDate, 
          end_date: currentType.unit === 'days' ? endDate : undefined,
          start_time: currentType.unit === 'hours' ? startTime : undefined, 
          end_time: currentType.unit === 'hours' ? endTime : undefined, 
          custom_data: customData,
          attachments: uploadedFiles
        };

        let submittedReq;
        if (isEditMode && initialData) {
            submittedReq = await api.employee.updateRequest(initialData.request_id, payload);
            notify({ type: 'success', title: 'Request Updated', message: 'Changes saved successfully.' });
        } else {
            submittedReq = await api.employee.submitRequest(payload);
            
            if (submittedReq.status === 'REJECTED') {
                const errorMsg = submittedReq.rejection_reason || 'System rejected the request.';
                notify({ type: 'error', title: t('status_Rejected'), message: errorMsg, source: 'System_Rule', duration: 8000 });
            } else if (submittedReq.status === 'APPROVED') {
                notify({ type: 'success', title: t('status_Approved'), message: t('submitSuccess'), source: 'System_Decision' });
            } else {
                notify({ type: 'info', title: t('status_Pending'), message: t('submitSuccess'), source: 'Human_Manager' });
            }
        }
        onSuccess();
    } catch (error: any) {
        notify({ type: 'error', title: 'Submission Error', message: error.message || 'Failed to submit.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  // Render Custom/Dynamic Fields only (exclude system timing fields)
  const renderDynamicField = (field: FormField) => {
      // Skip system fields as they are handled explicitly at the top
      if (field.id.startsWith('system_')) return null;

      const commonProps = {
          required: field.required,
          readOnly: field.isReadOnly,
          disabled: field.isReadOnly,
          className: `${field.isReadOnly ? 'bg-[var(--bg-body)] text-[var(--text-muted)] cursor-not-allowed' : '!text-black dark:!text-[var(--text-main)]'} ${field.type === 'computed' ? 'pl-8' : ''}`
      };

      // Special handling for list-backed select fields
      if (field.type === 'select-list') {
          const cfg = field.listConfig;

          const SelectListField: React.FC<{ field: FormField }> = ({ field }) => {
              const cfg = field.listConfig;
              const [options, setOptions] = useState<any[]>([]);
              const [parentOptions, setParentOptions] = useState<any[]>([]);
              const [childOptions, setChildOptions] = useState<any[]>([]);
              const [selectedParent, setSelectedParent] = useState<number | null>(null);

              useEffect(() => {
                  let mounted = true;
                  const load = async () => {
                      if (!cfg) return;
                      if (cfg.source === 'ORG_UNITS') {
                          const units = await api.admin.getOrgUnits();
                          if (!mounted) return;
                          setOptions(units || []);
                          if (cfg.hierarchical) {
                              const parents = units.filter((u: any) => !u.parent_unit_id);
                              setParentOptions(parents);
                              setSelectedParent(parents[0]?.unit_id || null);
                              setChildOptions(units.filter((u: any) => u.parent_unit_id === (parents[0]?.unit_id || null)));
                          }
                      } else if (cfg.source === 'DB_TABLE' && cfg.tableName) {
                          const rows = await api.admin.getTableData(cfg.tableName);
                          if (!mounted) return;
                          setOptions(rows || []);
                      } else if (cfg.source === 'STATIC') {
                          setOptions(cfg.staticOptions || []);
                      } else if (cfg.source === 'ADMIN_LIST' && cfg.adminListId) {
                          // For now try to read from a custom table name using adminListId as fallback key
                          const tableName = `admin_list_${cfg.adminListId}`;
                          const rows = await api.admin.getTableData(tableName);
                          if (!mounted) return;
                          setOptions(rows || []);
                      }
                  };
                  load();
                  return () => { mounted = false; };
              }, [field.id]);

              useEffect(() => {
                  if (!cfg || !cfg.hierarchical) return;
                  // update child options when parent changes
                  const children = options.filter((u: any) => u.parent_unit_id === selectedParent);
                  setChildOptions(children);
              }, [selectedParent, options, cfg]);

              const handleSingleChange = (val: any) => {
                  setCustomData({ ...customData, [field.id]: val });
              };

              const handleMultiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
                  const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                  let vals: any[] = selected;
                  if (cfg?.maxSelectable && vals.length > cfg.maxSelectable) {
                      vals = vals.slice(0, cfg.maxSelectable);
                  }
                  setCustomData({ ...customData, [field.id]: vals });
              };

              // Render hierarchical org-unit pickers
              if (cfg?.source === 'ORG_UNITS' && cfg.hierarchical) {
                  return (
                      <div className="space-y-2">
                          <select className={SELECT_BASE_CLASS} value={selectedParent || ''} onChange={e => setSelectedParent(Number(e.target.value) || null)}>
                              <option value="">-- اختر القسم الأعلى --</option>
                              {parentOptions.map(p => <option key={p.unit_id} value={p.unit_id}>{p.unit_name}</option>)}
                          </select>
                          <select className={SELECT_BASE_CLASS} value={customData[field.id] || ''} onChange={e => handleSingleChange(e.target.value)}>
                              <option value="">-- اختر الوحدة الفرعية --</option>
                              {childOptions.map(c => <option key={c.unit_id} value={c.unit_id}>{c.unit_name}</option>)}
                          </select>
                      </div>
                  );
              }

              // Render simple options (single or multiple)
              if (cfg?.allowMultiple) {
                  const opts = options.map(o => ({ label: cfg.displayField ? o[cfg.displayField] : (o.label || o.unit_name || String(o)), value: cfg.valueField ? o[cfg.valueField] : (o.unit_id ?? o.id ?? o.value) }));
                  return (
                      <select multiple className={SELECT_BASE_CLASS} value={customData[field.id] || []} onChange={handleMultiChange}>
                          {opts.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                      </select>
                  );
              }

              // Single select
              const opts = options.map(o => ({ label: cfg?.displayField ? o[cfg.displayField] : (o.label || o.unit_name || String(o)), value: cfg?.valueField ? o[cfg.valueField] : (o.unit_id ?? o.id ?? o.value) }));
              return (
                  <select className={SELECT_BASE_CLASS} value={customData[field.id] || ''} onChange={e => handleSingleChange(e.target.value)}>
                      <option value="">-- اختر --</option>
                      {opts.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                  </select>
              );
          };

          return (
              <div key={field.id} className={`${field.type === 'textarea' ? 'md:col-span-2' : ''} w-full min-w-0`}>
                  <label className="block text-sm font-bold text-[var(--text-main)] mb-1.5">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <SelectListField field={field} />
              </div>
          );
      }

      let inputEl;
      if (field.type === 'boolean') {
          const currentVal = customData[field.id];
          inputEl = (
              <select
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-sm text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  value={currentVal === true ? 'true' : currentVal === false ? 'false' : ''}
                  onChange={e => !field.isReadOnly && setCustomData({ ...customData, [field.id]: e.target.value === '' ? undefined : e.target.value === 'true' })}
                  required={field.required}
                  disabled={field.isReadOnly}
              >
                  <option value="">-- اختر --</option>
                  <option value="true">نعم</option>
                  <option value="false">لا</option>
              </select>
          );
      } else if (field.type === 'textarea') {
          inputEl = (
            <div className="sca-textarea-wrapper w-full min-w-0">
              <textarea className="sca-textarea w-full min-w-0 max-w-full box-border resize-y rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-sm text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)] min-h-[120px]" rows={3} value={customData[field.id] || ''} onChange={e => !field.isReadOnly && setCustomData({ ...customData, [field.id]: e.target.value })} {...commonProps} />
            </div>
          );
      } else {
          inputEl = (
            <div className="relative">
                {field.type === 'computed' && <Calculator className="w-4 h-4 absolute top-3.5 left-2 text-[var(--text-muted)] z-10" />}
                <Input 
                    type={field.type === 'computed' ? 'number' : field.type} 
                    value={customData[field.id] || ''} 
                    onChange={e => !field.isReadOnly && setCustomData({ ...customData, [field.id]: e.target.value })} 
                    {...commonProps} 
                />
            </div>
          );
      }

      return (
        <div key={field.id} className={`${field.type === 'textarea' || field.type === 'text' ? 'md:col-span-2' : ''} w-full min-w-0`}>
            <label className="block text-sm font-bold text-[var(--text-main)] mb-1.5">
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {inputEl}
        </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <style>{`
          .date-input-fix { color-scheme: light; }
          .dark .date-input-fix { color-scheme: dark; }
          .date-input-fix::-webkit-calendar-picker-indicator { filter: none; }
          .dark .date-input-fix::-webkit-calendar-picker-indicator { filter: invert(1); }
        `}</style>
        
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                {isEditMode ? <Edit2 className="w-6 h-6 text-[var(--primary)]" /> : null}
                {isEditMode ? t('editRecord') : t('newRequest')}
            </h2>
            <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
        </div>
        
        <Card><CardContent className="pt-6"><form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Request Type Selection - Disabled in Edit Mode */}
            <div>
                <label className="block text-sm font-bold text-[var(--text-main)] mb-2">{t('requestType')}</label>
                <select 
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-60 disabled:cursor-not-allowed" 
                    value={selectedTypeId} 
                    onChange={(e) => setSelectedTypeId(Number(e.target.value))}
                    disabled={isEditMode}
                >
                    {requestTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
                {currentType?.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{currentType.description}</p>}
            </div>
            
            <div className="border-t border-[var(--border-color)] my-4"></div>
            
            {/* EXPLICIT TIMING SECTION: Guarantees fields appear based on Unit */}
            {currentType && currentType.unit !== 'none' && (
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4">
                    <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {t('duration')} & Timing
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Common Date Field (Start Date) */}
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-main)] mb-1 uppercase">{currentType.unit === 'hours' ? 'Date' : t('joinDate') /* Using joinDate as generic Start label */}</label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="date-input-fix bg-white dark:bg-black/20" />
                        </div>

                        {/* End Date (Only for Days) */}
                        {currentType.unit === 'days' && (
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-main)] mb-1 uppercase">End Date</label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="date-input-fix bg-white dark:bg-black/20" />
                            </div>
                        )}

                        {/* Time Fields (Only for Hours) */}
                        {currentType.unit === 'hours' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1 uppercase">Start Time</label>
                                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="date-input-fix bg-white dark:bg-black/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1 uppercase">End Time</label>
                                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="date-input-fix bg-white dark:bg-black/20" />
                                </div>
                            </>
                        )}

                        {/* Duration Display */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-[var(--text-main)] mb-1 uppercase">Calculated Duration</label>
                            <div className="flex items-center gap-2">
                                <Input value={calculatedDuration > 0 ? calculatedDuration : '-'} readOnly className="bg-gray-100 dark:bg-gray-800 text-center font-bold text-lg" />
                                <span className="text-sm font-bold text-[var(--text-muted)]">{currentType.unit === 'days' ? t('unitDays') : t('unitHours')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer-Specific Fields */}
            {isTransferType && currentType.transfer_config?.preferred_units_field?.enabled !== false && (
                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-200 dark:border-purple-800 space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                <GripVertical className="w-4 h-4" />
                                الوحدات الإدارية المفضلة
                                {currentType.transfer_config?.preferred_units_field?.required && <span className="text-red-500">*</span>}
                            </h3>
                            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                                {currentType.transfer_config?.preferred_units_field?.description || 'اختر الوحدات الإدارية المفضلة بترتيب الأولوية'}
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={handleAddPreference}
                            disabled={preferredUnits.length >= (currentType.transfer_config?.preferred_units_field?.max_selectable ?? 5)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <Plus className="w-3 h-3" />
                            إضافة وحدة
                        </Button>
                    </div>
                    
                    {currentType.transfer_config?.preferred_units_field?.allow_drag_drop !== false ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={preferredUnits.map(p => p.preference_order)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {preferredUnits.map((pref, index) => (
                                        <SortablePreferenceItemInForm
                                            key={pref.preference_order}
                                            preference={pref}
                                            index={index}
                                            units={orgUnits}
                                            allPreferences={preferredUnits}
                                            onUpdate={handleUpdatePreference}
                                            onRemove={handleRemovePreference}
                                            canRemove={preferredUnits.length > 1}
                                            required={currentType.transfer_config?.preferred_units_field?.required ?? true}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="space-y-3">
                            {preferredUnits.map((pref, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex-shrink-0 font-bold text-lg text-purple-600 w-8 h-8 flex items-center justify-center bg-purple-50 dark:bg-purple-900/30 rounded-full">
                                        {pref.preference_order}
                                    </div>
                                    <select
                                        value={pref.unit_id}
                                        onChange={(e) => handleUpdatePreference(index, 'unit_id', parseInt(e.target.value))}
                                        className="flex-1 p-2 border rounded-md bg-white dark:bg-slate-700 text-[var(--text-main)]"
                                        required={currentType.transfer_config?.preferred_units_field?.required}
                                    >
                                        <option value={0}>-- اختر وحدة --</option>
                                        {orgUnits
                                            .filter(u => !preferredUnits.some((p, i) => i !== index && p.unit_id === u.unit_id))
                                            .map(unit => (
                                                <option key={unit.unit_id} value={unit.unit_id}>
                                                    {unit.unit_name}
                                                </option>
                                            ))}
                                    </select>
                                    {preferredUnits.length > 1 && (
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
                    
                    {currentType.transfer_config?.preferred_units_field?.allow_drag_drop !== false && (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <GripVertical className="w-3 h-3" />
                            اسحب الوحدات لإعادة ترتيب الأولويات
                        </p>
                    )}
                </div>
            )}

            {/* Transfer Form Data Fields (fallback for legacy transfer config) */}
            {isTransferType && !hasTransferFieldsInConfig && (
                <div className="space-y-4 mt-6 pt-4 border-t border-[var(--border-color)]">
                    <div className="sca-textarea-wrapper w-full min-w-0">
                        <label className="block text-sm font-medium mb-2">
                            سبب التنقل <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={transferFormData.reason_for_transfer}
                            onChange={(e) => setTransferFormData({ ...transferFormData, reason_for_transfer: e.target.value })}
                            placeholder="شرح أسباب رغبتك في التنقل..."
                            required
                            className="sca-textarea w-full min-w-0 max-w-full box-border resize-y p-2 border rounded-md min-h-[100px] border-[var(--border-color)] bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="willing_relocate"
                            checked={transferFormData.willing_to_relocate}
                            onChange={(e) => setTransferFormData({ ...transferFormData, willing_to_relocate: e.target.checked })}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="willing_relocate" className="text-sm cursor-pointer">
                            ✈️ أنا مستعد للانتقال الجغرافي (تغيير مقر العمل)
                        </label>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">التاريخ المطلوب للبدء</label>
                        <Input
                            type="date"
                            value={transferFormData.desired_start_date}
                            onChange={(e) => setTransferFormData({ ...transferFormData, desired_start_date: e.target.value })}
                        />
                    </div>
                    
                    <div className="sca-textarea-wrapper w-full min-w-0">
                        <label className="block text-sm font-medium mb-2">ملاحظات إضافية</label>
                        <textarea
                            value={transferFormData.additional_notes}
                            onChange={(e) => setTransferFormData({ ...transferFormData, additional_notes: e.target.value })}
                            placeholder="أي معلومات إضافية أو ظروف خاصة..."
                            className="sca-textarea w-full min-w-0 max-w-full box-border resize-y p-2 border rounded-md min-h-[80px] border-[var(--border-color)] bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--primary)]"
                        />
                    </div>
                </div>
            )}

            {/* Dynamic Custom Fields */}
            {currentType && currentType.fields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                    {currentType.fields.map(field => {
                        if (!field.isVisible) return null;
                        return renderDynamicField(field);
                    })}
                </div>
            )}

             {/* Document Upload Section */}
            {currentType && currentType.documents && currentType.documents.length > 0 && (
                <div className="space-y-4 animate-in fade-in mt-6 pt-4 border-t border-[var(--border-color)]">
                    <h3 className="font-semibold text-sm pb-2 text-[var(--text-main)] flex items-center gap-2">
                        <FileText className="w-4 h-4" /> {t('requiredDocuments')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {currentType.documents.map(doc => {
                            const existingFile = uploadedFiles.find(f => f.documentId === doc.id);
                            return (
                                <div key={doc.id} className="border border-dashed border-[var(--border-color)] rounded-xl p-4 flex items-center justify-between bg-[var(--bg-body)]/50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-[var(--text-main)]">{doc.label}</span>
                                            {doc.required && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Required</span>}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">Type: {doc.type} | {doc.allowedTypes.join(', ').toUpperCase()}</div>
                                    </div>
                                    
                                    {existingFile ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="text-sm font-medium truncate max-w-[150px]">{existingFile.fileName}</span>
                                            </div>
                                            <button type="button" onClick={() => removeFile(doc.id)} className="p-1.5 rounded-full hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <input type="file" className="hidden" accept={doc.allowedTypes.map(t => `.${t}`).join(',')} onChange={(e) => handleFileUpload(doc.id, e)} />
                                            <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--primary)] text-[var(--text-main)] px-4 py-2 rounded-lg shadow-sm transition-all text-sm font-bold">
                                                <UploadCloud className="w-4 h-4" /> Upload
                                            </div>
                                        </label>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {infoBarItems.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 flex gap-3 shadow-sm items-start mt-6">
                    <AlertCircle className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium mb-2">معلومات مهمة:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {infoBarItems.map((item, idx) => (
                                <li key={`${idx}-${item.slice(0, 20)}`}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <Button type="submit" className="w-full shadow-lg h-12 text-base" isLoading={isSubmitting}>
                {isEditMode ? t('saveChanges') : t('submitRequest')}
            </Button>
        </form></CardContent></Card>
    </div>
  );
};
